import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runWithFailover } from "@/lib/failover";
import { authApiKey } from "@/lib/auth";
import type { ChatMessage } from "@/lib/providers";
import { reorderProvidersOpenSourceFirst } from "@/lib/providers";

/**
 * POST /api/v1/chat/completions
 *
 * OpenAI-compatible chat completions endpoint. Authenticates via Bearer
 * `marq_live_...` API key (not session cookie).
 *
 * Request body (OpenAI-compatible subset):
 *   messages: [{ role: "system"|"user"|"assistant", content: string }, ...]
 *   model?: string                 — ignored, failover picks per-provider
 *   provider?: string              — "openai" | "gemini" | "claude" (pins primary)
 *   session_id?: string            — optional Marq session to write into
 *   stream?: boolean               — not supported yet, returns 400 if true
 *
 * Response (OpenAI shape):
 *   {
 *     id: "chatcmpl-...",
 *     object: "chat.completion",
 *     created: 1234567890,
 *     model: "marq-failover",
 *     choices: [{ index: 0, message: { role: "assistant", content: "..." }, finish_reason: "stop" }],
 *     usage: { prompt_tokens, completion_tokens, total_tokens },
 *     marq: { provider, originalProvider?, failedOver, attempts, latencyMs, sessionId }
 *   }
 */
export async function POST(req: NextRequest) {
  const auth = await authApiKey(req, "chat");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const { messages, provider: providerName, session_id, stream } = body ?? {};

  if (stream) {
    return NextResponse.json({ error: "Streaming not yet supported by the unified API" }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages must be a non-empty array" }, { status: 400 });
  }

  // Map to internal ChatMessage type.
  const mapped: ChatMessage[] = [];
  for (const m of messages) {
    if (m?.role && m?.content != null && ["system", "user", "assistant"].includes(m.role)) {
      mapped.push({ role: m.role, content: String(m.content) });
    }
  }
  if (mapped.length === 0) {
    return NextResponse.json({ error: "No valid messages found" }, { status: 400 });
  }

  // Load active providers, optionally pinned to the requested primary.
  // Apply the "open source first" auto-mode policy: free providers are
  // tried before chargeable APIs so responses stay fast and don't hit the
  // paid-provider failure path. A pinned primary, if set, is moved to the
  // front AFTER the tier reorder.
  let providers = await db.provider.findMany({
    where: { active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  providers = reorderProvidersOpenSourceFirst(providers);
  if (providers.length === 0) {
    return NextResponse.json({ error: "No active providers configured" }, { status: 503 });
  }
  if (providerName) {
    const primary = providers.find((p) => p.name === providerName);
    if (primary) providers = [primary, ...providers.filter((p) => p.id !== primary.id)];
  }

  // Resolve / create a Marq session (scoped to the org).
  let session = session_id ? await db.chatSession.findUnique({ where: { id: session_id } }) : null;
  if (session && session.orgId && session.orgId !== auth.orgId) {
    return NextResponse.json({ error: "session_id belongs to a different org" }, { status: 403 });
  }
  if (!session) {
    const title = (mapped[mapped.length - 1]?.content ?? "API conversation").slice(0, 50);
    session = await db.chatSession.create({ data: { orgId: auth.orgId, title } });
  }

  // Persist the user message(s) — only the last one is new typically, but
  // we record every message in the request for full audit trail.
  for (const m of mapped) {
    if (m.role !== "assistant") {
      await db.message.create({ data: { sessionId: session.id, role: m.role, content: m.content } });
    }
  }

  try {
    const outcome = await runWithFailover({
      providers,
      messages: mapped,
      sessionId: session.id,
      timeoutMs: 25000,
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

    // Tag the failover log entries with the org (best-effort).
    if (outcome.failedOver) {
      await db.failoverLog.updateMany({
        where: { sessionId: session.id },
        data: { orgId: auth.orgId },
      }).catch(() => {});
    }

    return NextResponse.json({
      id: `chatcmpl-${assistantMessage.id}`,
      object: "chat.completion",
      created: Math.floor(assistantMessage.createdAt.getTime() / 1000),
      model: outcome.result.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: outcome.result.content },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: Math.ceil(mapped.map((m) => m.content).join("").length / 4),
        completion_tokens: outcome.result.tokensUsed ?? Math.ceil(outcome.result.content.length / 4),
        total_tokens: (outcome.result.tokensUsed ?? Math.ceil(outcome.result.content.length / 4)) +
          Math.ceil(mapped.map((m) => m.content).join("").length / 4),
      },
      marq: {
        provider: { id: finalProvider.id, name: finalProvider.name, displayName: finalProvider.displayName },
        originalProvider: outcome.failedOver
          ? (() => {
              const o = providers.find((p) => p.id === outcome.originalProviderId);
              return o ? { id: o.id, name: o.name, displayName: o.displayName } : null;
            })()
          : null,
        failedOver: outcome.failedOver,
        fallback: outcome.fallback ?? false,
        attempts: outcome.attempts,
        latencyMs: outcome.result.latencyMs,
        sessionId: session.id,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          message: err instanceof Error ? err.message : "All providers failed",
          type: "upstream_error",
        },
      },
      { status: 502 },
    );
  }
}
