import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAgentTask } from "@/lib/agent";
import { TEMPLATE_KEYS, TEMPLATE_MAP } from "@/lib/agent-templates";

/**
 * GET /api/agent/tasks
 * List all agent tasks, newest first.
 * Optional query params:
 *   ?status=running          — filter by status
 *   ?agentType=fullstack_dev — filter by agent type
 */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const agentType = req.nextUrl.searchParams.get("agentType");
  const tasks = await db.agentTask.findMany({
    where: {
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
 * Create a new agent task and immediately run it to completion.
 *
 * Body:
 *   goal: string                  — the user's task
 *   title?: string                — optional title (defaults to truncated goal)
 *   agentType?: string            — template key (default "general"). Must be one of TEMPLATE_KEYS.
 *   maxSteps?: number             — optional step cap (default from template, max 15)
 *   primaryProviderId?: string    — optional pinned primary provider
 *   runImmediately?: boolean      — default true. If false, only creates the task.
 *
 * Returns the created task with status either "completed" or "failed"
 * (or "pending" if runImmediately=false).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { goal, title, agentType, maxSteps, primaryProviderId, runImmediately = true } = body ?? {};

  if (!goal || typeof goal !== "string") {
    return NextResponse.json({ error: "goal is required" }, { status: 400 });
  }

  // Validate agentType — fall back to "general" if missing/invalid.
  const typeKey = (typeof agentType === "string" && TEMPLATE_KEYS.includes(agentType))
    ? agentType
    : "general";
  const template = TEMPLATE_MAP[typeKey];

  // Default step cap comes from the template, can be overridden.
  const requestedSteps = Number(maxSteps);
  const stepCap = Number.isFinite(requestedSteps) && requestedSteps > 0
    ? Math.min(Math.max(requestedSteps, 1), 15)
    : template.defaultMaxSteps;

  const taskTitle = title?.trim() || goal.slice(0, 60) + (goal.length > 60 ? "…" : "");

  const task = await db.agentTask.create({
    data: {
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

  // Run the agent synchronously. This may take 10–60s depending on step count
  // and provider latency. On Vercel hobby tier this fits within the 60s limit
  // for up to ~4–5 steps; for longer tasks upgrade to Pro or split into chunks.
  try {
    const result = await runAgentTask({
      taskId: task.id,
      maxSteps: stepCap,
      timeoutMs: 20000,
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
