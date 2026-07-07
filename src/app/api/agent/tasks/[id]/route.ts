import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAgentTask } from "@/lib/agent";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/agent/tasks/[id]
 * Returns the full task with all steps (oldest first).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const task = await db.agentTask.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { stepNumber: "asc" },
        include: { provider: true },
      },
    },
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json({ task });
}

/**
 * DELETE /api/agent/tasks/[id]
 * Delete a task and all its steps.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.agentTask.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/agent/tasks/[id]
 * Re-run (or resume) a task. If the task already has steps, they are kept
 * and the agent continues from where it left off (up to maxSteps total).
 * Set `?restart=1` to clear existing steps and start fresh.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const restart = req.nextUrl.searchParams.get("restart") === "1";

  const task = await db.agentTask.findUnique({
    where: { id },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (restart) {
    await db.agentStep.deleteMany({ where: { taskId: id } });
    await db.agentTask.update({
      where: { id },
      data: {
        status: "running",
        finalAnswer: null,
        errorMessage: null,
        totalLatencyMs: null,
        totalTokensUsed: null,
        failedOverCount: 0,
        updatedAt: new Date(),
      },
    });
  } else {
    await db.agentTask.update({
      where: { id },
      data: { status: "running", errorMessage: null, updatedAt: new Date() },
    });
  }

  try {
    const result = await runAgentTask({
      taskId: id,
      maxSteps: task.maxSteps,
      timeoutMs: 20000,
    });

    const finalTask = await db.agentTask.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepNumber: "asc" }, include: { provider: true } },
      },
    });

    return NextResponse.json({ task: finalTask, result });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await db.agentTask.update({
      where: { id },
      data: { status: "failed", errorMessage },
    });
    return NextResponse.json(
      { error: "Agent run failed", detail: errorMessage },
      { status: 500 },
    );
  }
}
