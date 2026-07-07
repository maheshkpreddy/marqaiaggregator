import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAgentTask } from "@/lib/agent";

/**
 * GET /api/agent/tasks
 * List all agent tasks, newest first. Optional `?status=running` filter.
 */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const tasks = await db.agentTask.findMany({
    where: status ? { status } : undefined,
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
 *   maxSteps?: number             — optional step cap (default 8, max 15)
 *   primaryProviderId?: string    — optional pinned primary provider
 *   runImmediately?: boolean      — default true. If false, only creates the task.
 *
 * Returns the created task with status either "completed" or "failed"
 * (or "pending" if runImmediately=false).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { goal, title, maxSteps, primaryProviderId, runImmediately = true } = body ?? {};

  if (!goal || typeof goal !== "string") {
    return NextResponse.json({ error: "goal is required" }, { status: 400 });
  }

  const stepCap = Math.min(Math.max(Number(maxSteps) || 8, 1), 15);
  const taskTitle = title?.trim() || goal.slice(0, 60) + (goal.length > 60 ? "…" : "");

  const task = await db.agentTask.create({
    data: {
      title: taskTitle,
      goal,
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
