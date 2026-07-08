/**
 * Stress-test the agent failover: run N small agent tasks via the API
 * with Claude as the primary provider (which has an 18% simulated failure
 * rate in demo mode). Reports how many tasks/steps triggered failover.
 *
 * Run with: bun run /home/z/my-project/scripts/stress-agent.ts
 */
export {};

interface Step {
  stepNumber: number;
  action: string | null;
  failedOver: boolean;
  provider?: { displayName: string } | null;
}

interface Task {
  id: string;
  status: string;
  failedOverCount: number;
  steps: Step[];
  finalAnswer: string | null;
  errorMessage: string | null;
  totalLatencyMs: number | null;
}

async function getProviderId(name: string): Promise<string | null> {
  const res = await fetch("http://localhost:3000/api/providers");
  const data = await res.json();
  const p = (data.providers as any[]).find((p) => p.name === name);
  return p?.id ?? null;
}

async function runTask(
  goal: string,
  primaryProviderId: string | null,
  agentType: string = "general",
): Promise<Task> {
  const res = await fetch("http://localhost:3000/api/agent/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      goal,
      agentType,
      maxSteps: 4,
      runImmediately: true,
      primaryProviderId: primaryProviderId ?? undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.task as Task;
}

async function main() {
  const claudeId = await getProviderId("claude");
  if (!claudeId) {
    console.error("Claude provider not found");
    process.exit(1);
  }

  // Mix of agent types — exercise multiple templates and tool whitelists.
  const goals: Array<{ goal: string; agentType: string }> = [
    { goal: "What is 2+2? Use the calculator and give the final answer.", agentType: "general" },
    { goal: "Project MRR for 100 subscribers at $49 ARPU, 5% monthly churn, 6 months.", agentType: "sales" },
    { goal: "What time is it now? Give the final answer.", agentType: "general" },
    { goal: "Calculate 15% tip on $87.50. Give the final answer.", agentType: "sales" },
    { goal: "What is the square root of 144? Use the calculator.", agentType: "general" },
    { goal: "Run tests on src/lib/failover and report pass/fail.", agentType: "testing" },
    { goal: "Check the deploy status of marq-api in production.", agentType: "devops" },
    { goal: "Generate a TypeScript function that debounces an async call. Then summarize what it does.", agentType: "fullstack_dev" },
  ];

  let totalTasks = 0;
  let completedTasks = 0;
  let failedTasks = 0;
  let tasksWithFailover = 0;
  let totalSteps = 0;
  let stepsWithFailover = 0;

  for (let i = 0; i < goals.length; i++) {
    process.stdout.write(`[${i + 1}/${goals.length}] (${goals[i].agentType}) `);
    try {
      const task = await runTask(goals[i].goal, claudeId, goals[i].agentType);
      totalTasks++;
      totalSteps += task.steps.length;
      const taskFailovers = task.failedOverCount;
      const stepFailovers = task.steps.filter((s) => s.failedOver).length;
      stepsWithFailover += stepFailovers;
      if (taskFailovers > 0) tasksWithFailover++;

      if (task.status === "completed") completedTasks++;
      else failedTasks++;

      const providers = task.steps.map((s) => s.provider?.displayName ?? "?");
      const toolsUsed = task.steps.map((s) => s.action ?? "-").join(", ");
      console.log(
        `${task.status.toUpperCase()} | steps=${task.steps.length} | failovers=${taskFailovers} | providers=${providers.join("→")} | tools=${toolsUsed} | ${(task.totalLatencyMs ?? 0) / 1000}s`,
      );
      if (task.finalAnswer) {
        console.log(`          → ${task.finalAnswer.slice(0, 80)}`);
      }
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
      failedTasks++;
    }
  }

  console.log(`\n═══ Summary ═══`);
  console.log(`Total tasks:        ${totalTasks}`);
  console.log(`Completed:          ${completedTasks}`);
  console.log(`Failed:             ${failedTasks}`);
  console.log(`Tasks w/ failover:  ${tasksWithFailover}`);
  console.log(`Total steps:        ${totalSteps}`);
  console.log(`Steps w/ failover:  ${stepsWithFailover}`);

  // Check the failover log to confirm events were recorded.
  const logRes = await fetch("http://localhost:3000/api/failovers?limit=50");
  const logData = await logRes.json();
  console.log(`\nFailover log entries (total): ${logData.failovers?.length ?? 0}`);
  const agentFailovers = (logData.failovers ?? []).filter((f: any) => !f.sessionId);
  console.log(`Failover log entries (agent): ${agentFailovers.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
