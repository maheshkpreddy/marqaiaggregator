import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runWithFailover } from "@/lib/failover";
import type { ChatMessage } from "@/lib/providers";

/**
 * POST /api/chat
 * Unified chat endpoint with automatic failover across providers.
 *
 * Body:
 *   sessionId?: string     // if omitted, a new session is created
 *   message: string        // the user's message
 *   model?: string         // optional model override
 *   primaryProviderId?: string  // explicit primary; otherwise uses priority order
 *
 * Returns:
 *   {
 *     message: { id, role, content, ... },
 *     provider: { id, name, displayName, color, icon },
 *     model: string,
 *     attempts: FailoverAttempt[],
 *     failedOver: boolean,
 *     sessionId: string,
 *   }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, message, model, primaryProviderId } = body ?? {};

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Load active providers, ordered by priority (or pinned to the requested primary).
  let providers = await db.provider.findMany({
    where: { active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  if (providers.length === 0) {
    return NextResponse.json({ error: "No active providers configured" }, { status: 503 });
  }

  if (primaryProviderId) {
    const primary = providers.find((p) => p.id === primaryProviderId);
    if (primary) {
      providers = [primary, ...providers.filter((p) => p.id !== primaryProviderId)];
    }
  }

  // Resolve or create session.
  let session = sessionId
    ? await db.chatSession.findUnique({ where: { id: sessionId } })
    : null;
  if (!session) {
    const title = message.slice(0, 50) + (message.length > 50 ? "…" : "");
    session = await db.chatSession.create({ data: { title } });
  }

  // Persist the user's message.
  const userMessage = await db.message.create({
    data: { sessionId: session.id, role: "user", content: message },
  });

  // Build the conversation history for context.
  const priorMessages = await db.message.findMany({
    where: { sessionId: session.id, createdAt: { lt: userMessage.createdAt } },
    orderBy: { createdAt: "asc" },
    take: 20, // keep context bounded
  });

  const history: ChatMessage[] = priorMessages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  history.push({ role: "user", content: message });

  // Run the failover loop.
  try {
    const outcome = await runWithFailover({
      providers,
      messages: history,
      model,
      sessionId: session.id,
      timeoutMs: 20000,
    });

    const finalProvider = providers.find((p) => p.id === outcome.finalProviderId)!;

    // Persist assistant response.
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

    // Update session timestamp.
    await db.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

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
