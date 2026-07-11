import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAgentTask } from "@/lib/agent";
import { TEMPLATE_KEYS, TEMPLATE_MAP } from "@/lib/agent-templates";
import { requireRole, getAuthContext } from "@/lib/auth";

// Agent tasks run a multi-step ReAct loop (up to maxSteps LLM calls in a
// single HTTP request). Bump the Vercel function timeout from the default
// 10s to 300s so a 6-8 step task with 30-45s per step can complete.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * GET /api/agent/tasks
 * List agent tasks for the active org, newest first.
 * Optional query params:
 *   ?status=running          — filter by status
 *   ?agentType=fullstack_dev — filter by agent type
 *
 * Falls back to unscoped listing only if there is NO auth context (used by
 * the local stress-test script). Production always authenticates.
 */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const agentType = req.nextUrl.searchParams.get("agentType");
  const ctx = await getAuthContext();

  const tasks = await db.agentTask.findMany({
    where: {
      ...(ctx ? { orgId: ctx.org.id } : {}),
      ...(status ? { status } : {}),
      ...(agentType ? { agentType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      _count: { select: { steps: true } },
      steps: {
        orderBy: { stepNumber: "desc" },
        take: 1,
      },
    },
  });

  const enriched = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    goal: t.goal,
    agentType: t.agentType,
    status: t.status,
    maxSteps: t.maxSteps,
    primaryProviderId: t.primaryProviderId,
    finalAnswer: t.finalAnswer,
    errorMessage: t.errorMessage,
    totalLatencyMs: t.totalLatencyMs,
    totalTokensUsed: t.totalTokensUsed,
    failedOverCount: t.failedOverCount,
    stepCount: t._count.steps,
    lastAction: t.steps[0]?.action ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));

  return NextResponse.json({ tasks: enriched });
}

/**
 * POST /api/agent/tasks
 * Create a new agent task in the active org and optionally run it.
 *
 * Body:
 *   goal: string
 *   title?: string
 *   agentType?: string            — template key (default "general")
 *   maxSteps?: number
 *   primaryProviderId?: string
 *   runImmediately?: boolean      — default true
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { goal, title, agentType, maxSteps, primaryProviderId, runImmediately = true } = body ?? {};

  if (!goal || typeof goal !== "string") {
    return NextResponse.json({ error: "goal is required" }, { status: 400 });
  }

  const typeKey = (typeof agentType === "string" && TEMPLATE_KEYS.includes(agentType))
    ? agentType
    : "general";
  const template = TEMPLATE_MAP[typeKey];

  const requestedSteps = Number(maxSteps);
  const stepCap = Number.isFinite(requestedSteps) && requestedSteps > 0
    ? Math.min(Math.max(requestedSteps, 1), 15)
    : template.defaultMaxSteps;

  const taskTitle = title?.trim() || goal.slice(0, 60) + (goal.length > 60 ? "…" : "");

  const task = await db.agentTask.create({
    data: {
      orgId: ctx.org.id,
      title: taskTitle,
      goal,
      agentType: typeKey,
      maxSteps: stepCap,
      primaryProviderId: primaryProviderId || null,
      status: runImmediately ? "running" : "pending",
    },
  });

  if (!runImmediately) {
    return NextResponse.json({ task, steps: [] }, { status: 201 });
  }

  try {
    const result = await runAgentTask({
      taskId: task.id,
      maxSteps: stepCap,
      timeoutMs: 45000,
    });

    const finalTask = await db.agentTask.findUnique({
      where: { id: task.id },
      include: {
        steps: { orderBy: { stepNumber: "asc" }, include: { provider: true } },
      },
    });

    return NextResponse.json({
      task: finalTask,
      result,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await db.agentTask.update({
      where: { id: task.id },
      data: { status: "failed", errorMessage },
    });
    return NextResponse.json(
      { error: "Agent run failed", detail: errorMessage, taskId: task.id },
      { status: 500 },
    );
  }
}
