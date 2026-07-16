import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runWithFailover } from "@/lib/failover";
import { requireRole } from "@/lib/auth";
import type { ChatMessage } from "@/lib/providers";
import { reorderProvidersOpenSourceFirst } from "@/lib/providers";

/**
 * POST /api/chat
 * Unified chat endpoint with automatic failover across providers.
 * Authenticated: requires `member` role on the active org. Sessions are
 * scoped by orgId.
 *
 * Body:
 *   sessionId?: string
 *   message: string
 *   model?: string
 *   primaryProviderId?: string
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { sessionId, message, model, primaryProviderId } = body ?? {};

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Load active providers ordered by priority, then apply the "open source
  // first" auto-mode policy: free providers (marq_free, HuggingFace, Ollama,
  // frameworks) are tried before chargeable APIs so the user gets fast
  // responses with no failover lag. A pinned primary, if provided, is moved
  // to the front AFTER the tier reorder so the user's explicit choice wins.
  let providers = await db.provider.findMany({
    where: { active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  providers = reorderProvidersOpenSourceFirst(providers);

  if (providers.length === 0) {
    return NextResponse.json({ error: "No active providers configured" }, { status: 503 });
  }

  if (primaryProviderId) {
    const primary = providers.find((p) => p.id === primaryProviderId);
    if (primary) {
      providers = [primary, ...providers.filter((p) => p.id !== primaryProviderId)];
    }
  }

  // Resolve or create session — scoped to the org.
  let session = sessionId
    ? await db.chatSession.findUnique({ where: { id: sessionId } })
    : null;
  if (session && session.orgId && session.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "Session belongs to a different organization" }, { status: 403 });
  }
  if (!session) {
    const title = message.slice(0, 50) + (message.length > 50 ? "…" : "");
    session = await db.chatSession.create({ data: { orgId: ctx.org.id, title } });
  }

  const userMessage = await db.message.create({
    data: { sessionId: session.id, role: "user", content: message },
  });

  const priorMessages = await db.message.findMany({
    where: { sessionId: session.id, createdAt: { lt: userMessage.createdAt } },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const history: ChatMessage[] = priorMessages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  history.push({ role: "user", content: message });

  try {
    const outcome = await runWithFailover({
      providers,
      messages: history,
      model,
      sessionId: session.id,
      // 10s per provider (down from 18s). The failover engine skips
      // providers with no API key instantly, so the chain completes
      // fast: open-source providers (marq_free) respond in 1-5s, and
      // if they fail, the next provider is tried immediately. With
      // 10s per provider and Vercel's 60s function limit (see
      // vercel.json), we can try up to 5 providers before hitting
      // the limit — plenty for a reliable response. This fixes the
      // "Marq AI fall over" issue where multiple 18s timeouts
      // exceeded the old 30s Vercel limit.
      timeoutMs: 10000,
    });

    const finalProvider = providers.find((p) => p.id === outcome.finalProviderId)!;

    const assistantMessage = await db.message.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: outcome.result.content,
        providerId: finalProvider.id,
        model: outcome.result.model,
        latencyMs: outcome.result.latencyMs,
        tokensUsed: outcome.result.tokensUsed ?? null,
        failedOver: outcome.failedOver,
        originalProviderId: outcome.originalProviderId,
      },
    });

    await db.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    // Tag failover log entries with the org (best-effort).
    if (outcome.failedOver) {
      await db.failoverLog.updateMany({
        where: { sessionId: session.id },
        data: { orgId: ctx.org.id },
      }).catch(() => {});
    }

    return NextResponse.json({
      message: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        latencyMs: assistantMessage.latencyMs,
        tokensUsed: assistantMessage.tokensUsed,
        failedOver: assistantMessage.failedOver,
        createdAt: assistantMessage.createdAt,
      },
      provider: {
        id: finalProvider.id,
        name: finalProvider.name,
        displayName: finalProvider.displayName,
        color: finalProvider.color,
        icon: finalProvider.icon,
      },
      originalProvider: outcome.failedOver
        ? (() => {
            const orig = providers.find((p) => p.id === outcome.originalProviderId);
            return orig
              ? { id: orig.id, name: orig.name, displayName: orig.displayName, color: orig.color, icon: orig.icon }
              : null;
          })()
        : null,
      model: outcome.result.model,
      attempts: outcome.attempts,
      failedOver: outcome.failedOver,
      fallback: outcome.fallback ?? false,
      sessionId: session.id,
      userMessageId: userMessage.id,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "All providers failed", detail: errorMessage },
      { status: 502 },
    );
  }
}
