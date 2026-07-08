import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAgentTask } from "@/lib/agent";
import { requireRole, getAuthContext } from "@/lib/auth";

interface Params {
  params: Promise<{ id: string }>;
}

async function checkTaskInOrg(taskId: string, orgId: string | undefined) {
  const task = await db.agentTask.findUnique({ where: { id: taskId } });
  if (!task) return { error: "Task not found", status: 404 };
  // If the task has an orgId, enforce it. If not (legacy), allow access
  // only if there's no auth context (local dev / stress script).
  if (task.orgId) {
    if (!orgId || task.orgId !== orgId) {
      return { error: "Task not found in this org", status: 404 };
    }
  }
  return { task };
}

/**
 * GET /api/agent/tasks/[id]
 * Returns the full task with all steps (oldest first). Scoped by org.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  const { id } = await params;

  const result: any = await checkTaskInOrg(id, ctx?.org.id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

  const task = await db.agentTask.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { stepNumber: "asc" },
        include: { provider: true },
      },
    },
  });
  return NextResponse.json({ task });
}

/**
 * DELETE /api/agent/tasks/[id]
 * Delete a task and all its steps. Scoped by org (requires member role).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const result: any = await checkTaskInOrg(id, ctx.org.id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

  await db.agentTask.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/agent/tasks/[id]
 * Re-run (or resume) a task. Set `?restart=1` to clear existing steps.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const result: any = await checkTaskInOrg(id, ctx.org.id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

  const restart = req.nextUrl.searchParams.get("restart") === "1";

  const task = await db.agentTask.findUnique({
    where: { id },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

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
      maxSteps: task!.maxSteps,
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
