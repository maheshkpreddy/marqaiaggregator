import { NextRequest, NextResponse } from "next/server";
import { runAgentChatTurn } from "@/lib/agent-chat";
import { TEMPLATE_KEYS } from "@/lib/agent-templates";
import { requireRole } from "@/lib/auth";

// Multi-turn agent chat can run several ReAct iterations per turn. Bump
// the Vercel function timeout so a 6-8 step turn with 30-45s per step can
// complete.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/agent/chat
 *
 * Body:
 *   message: string                 — the user's message for this turn
 *   agentType?: string              — template key (defaults to "general")
 *   sessionId?: string              — existing session id (omit to create new)
 *   primaryProviderId?: string      — pinned primary provider
 *   maxSteps?: number               — ReAct iteration cap (default 6)
 *
 * Returns:
 *   {
 *     sessionId, content, steps, ok, errorMessage,
 *     totalLatencyMs, totalTokensUsed, failedOverCount,
 *     finalProviderName, finalModel
 *   }
 *
 * The session is created on the first turn (when sessionId is null) and
 * reused on subsequent turns, giving full conversation continuity. The
 * agent's ReAct step trace is included in the response so the UI can
 * render the "show steps" expander under the assistant bubble.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { message, agentType, sessionId, primaryProviderId, maxSteps } = body ?? {};

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const typeKey = (typeof agentType === "string" && TEMPLATE_KEYS.includes(agentType))
    ? agentType
    : "general";

  const stepCap = (typeof maxSteps === "number" && Number.isFinite(maxSteps) && maxSteps > 0)
    ? Math.min(Math.max(Math.floor(maxSteps), 1), 12)
    : 6;

  try {
    const result = await runAgentChatTurn({
      message,
      agentType: typeKey,
      sessionId: sessionId || null,
      orgId: ctx.org.id,
      primaryProviderId: primaryProviderId || null,
      maxSteps: stepCap,
      timeoutMs: 45000,
    });
    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Agent chat failed", detail: errorMessage },
      { status: 500 },
    );
  }
}
