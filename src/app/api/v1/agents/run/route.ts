import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authApiKey } from "@/lib/auth";
import { runAgentTask } from "@/lib/agent";
import { getTemplate } from "@/lib/agent-templates";

/**
 * POST /api/v1/agents/run
 *
 * Synchronously run an agent task. Body:
 *   goal: string                — what the agent should accomplish
 *   agent_type?: string         — template key (default "general")
 *   primary_provider?: string   — provider name to pin as primary
 *   max_steps?: number          — default 8
 *
 * Returns the completed task (including all steps).
 *
 * Note: this is a long-running endpoint (can take 30-90s). For async use,
 * use the in-app Agents tab which creates a task in pending state and
 * polls for completion.
 */
export async function POST(req: NextRequest) {
  const auth = await authApiKey(req, "agents");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const { goal, agent_type, primary_provider, max_steps } = body ?? {};

  if (!goal || typeof goal !== "string" || goal.trim().length < 1) {
    return NextResponse.json({ error: "goal is required" }, { status: 400 });
  }

  const templateKey = typeof agent_type === "string" ? agent_type : "general";
  const template = getTemplate(templateKey);
  if (!template) {
    return NextResponse.json({ error: `Unknown agent_type: ${templateKey}` }, { status: 400 });
  }

  // Resolve the primary provider id (if specified).
  let primaryProviderId: string | undefined;
  if (typeof primary_provider === "string") {
    const p = await db.provider.findUnique({ where: { name: primary_provider } });
    if (!p) {
      return NextResponse.json({ error: `Unknown provider: ${primary_provider}` }, { status: 400 });
    }
    primaryProviderId = p.id;
  }

  const title = goal.slice(0, 60) + (goal.length > 60 ? "…" : "");

  const task = await db.agentTask.create({
    data: {
      orgId: auth.orgId,
      title,
      goal,
      agentType: templateKey,
      maxSteps: typeof max_steps === "number" && max_steps > 0 ? max_steps : template.defaultMaxSteps,
      primaryProviderId: primaryProviderId ?? null,
      status: "pending",
    },
  });

  // Run synchronously.
  const result = await runAgentTask({ taskId: task.id, maxSteps: task.maxSteps, timeoutMs: 25000 });

  const finalTask = await db.agentTask.findUnique({
    where: { id: task.id },
    include: {
      steps: { orderBy: { stepNumber: "asc" }, include: { provider: { select: { id: true, name: true, displayName: true, color: true } } } },
    },
  });

  return NextResponse.json({
    object: "marq.agent.run",
    id: task.id,
    agent_type: templateKey,
    status: result.status,
    final_answer: result.finalAnswer,
    error: result.errorMessage,
    steps: finalTask?.steps.map((s) => ({
      step_number: s.stepNumber,
      thought: s.thought,
      action: s.action,
      action_input: s.actionInput,
      observation: s.observation,
      provider: s.provider ? { name: s.provider.name, displayName: s.provider.displayName } : null,
      model: s.model,
      latency_ms: s.latencyMs,
      tokens_used: s.tokensUsed,
      failed_over: s.failedOver,
      error: s.errorMessage,
    })) ?? [],
    stats: {
      steps_taken: result.stepsTaken,
      failed_over_count: result.failedOverCount,
      total_latency_ms: result.totalLatencyMs,
      total_tokens_used: result.totalTokensUsed,
    },
  });
}
