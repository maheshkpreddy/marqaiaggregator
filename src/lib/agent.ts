/**
 * Marq AI Aggregator — Agent Engine
 *
 * Implements a ReAct (Reason + Act) loop with multi-provider failover.
 *
 * Flow per task:
 *   1. Build a system prompt with the goal, available tools, and instructions.
 *   2. Loop up to `maxSteps`:
 *      a. Build the conversation: system + scratchpad of prior thoughts/actions/observations.
 *      b. Call the failover engine with all active providers.
 *      c. Parse the LLM response into either:
 *           - FINAL_ANSWER → save + break
 *           - ACTION + ACTION_INPUT → execute the tool, save observation, continue
 *      d. On parse failure: record the step with an error and continue.
 *   3. If we ran out of steps without a final answer, mark the task as failed.
 *
 * Every LLM call uses `runWithFailover`, so the agent transparently
 * continues on the next provider if the primary fails mid-task.
 */

import { db } from "@/lib/db";
import { runWithFailover } from "@/lib/failover";
import type { ChatMessage, FailoverReason } from "@/lib/providers";
import { ProviderError } from "@/lib/providers";
import { getTool, toolDescriptionsForPrompt } from "@/lib/tools";

export interface AgentRunOptions {
  taskId: string;
  /** Hard cap on iterations. Defaults to task.maxSteps. */
  maxSteps?: number;
  /** Per-step LLM call timeout. */
  timeoutMs?: number;
}

export interface AgentRunResult {
  status: "completed" | "failed" | "cancelled";
  finalAnswer: string | null;
  errorMessage: string | null;
  stepsTaken: number;
  failedOverCount: number;
  totalLatencyMs: number;
  totalTokensUsed: number;
}

interface ParsedStep {
  thought: string;
  action: string | null;       // tool name, "final_answer", or null on parse error
  actionInput: unknown;        // parsed tool input
  finalAnswer: string | null;  // populated when action === "final_answer"
  rawResponse: string;
  parseError?: string;
}

/**
 * Run an agent task to completion. Updates the task + step rows in the DB
 * as it goes.
 */
export async function runAgentTask(opts: AgentRunOptions): Promise<AgentRunResult> {
  const task = await db.agentTask.findUnique({
    where: { id: opts.taskId },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });
  if (!task) throw new Error(`Agent task ${opts.taskId} not found`);

  await db.agentTask.update({
    where: { id: task.id },
    data: { status: "running", updatedAt: new Date() },
  });

  const maxSteps = opts.maxSteps ?? task.maxSteps ?? 8;
  const timeoutMs = opts.timeoutMs ?? 25000;

  // Load active providers ordered by priority (with optional pinned primary).
  let providers = await db.provider.findMany({
    where: { active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  if (providers.length === 0) {
    return finishTask(task.id, {
      status: "failed",
      finalAnswer: null,
      errorMessage: "No active providers configured.",
      stepsTaken: 0,
      failedOverCount: 0,
      totalLatencyMs: 0,
      totalTokensUsed: 0,
    });
  }
  if (task.primaryProviderId) {
    const primary = providers.find((p) => p.id === task.primaryProviderId);
    if (primary) {
      providers = [primary, ...providers.filter((p) => p.id !== task.primaryProviderId)];
    }
  }

  // Build the static system prompt once.
  const systemPrompt = buildSystemPrompt(task.goal);

  // Scratchpad: prior steps as assistant/user pairs the LLM can see.
  // We re-send the full history each iteration so the model has context.
  let totalLatencyMs = 0;
  let totalTokensUsed = 0;
  let failedOverCount = 0;
  let stepNumber = task.steps.length;

  try {
    while (stepNumber < maxSteps) {
      stepNumber++;
      const stepStart = Date.now();

      // Build the conversation for this step.
      const history = buildHistory(systemPrompt, task.steps);

      // Call the failover engine.
      let outcome;
      try {
        outcome = await runWithFailover({
          providers,
          messages: history,
          sessionId: undefined,
          timeoutMs,
        });
      } catch (err) {
        // All providers failed for this step.
        const errorMessage = err instanceof Error ? err.message : String(err);
        await db.agentStep.create({
          data: {
            taskId: task.id,
            stepNumber,
            thought: null,
            action: null,
            actionInput: null,
            observation: null,
            errorMessage: `All providers failed: ${errorMessage}`,
            latencyMs: Date.now() - stepStart,
          },
        });
        return finishTask(task.id, {
          status: "failed",
          finalAnswer: null,
          errorMessage: `All providers failed at step ${stepNumber}: ${errorMessage}`,
          stepsTaken: stepNumber,
          failedOverCount,
          totalLatencyMs: totalLatencyMs + (Date.now() - stepStart),
          totalTokensUsed,
        });
      }

      const finalProvider = providers.find((p) => p.id === outcome.finalProviderId)!;
      const rawResponse = outcome.result.content;
      const parsed = parseStepResponse(rawResponse);

      totalLatencyMs += outcome.result.latencyMs;
      totalTokensUsed += outcome.result.tokensUsed ?? 0;
      if (outcome.failedOver) failedOverCount++;

      // Did the LLM ask for a final answer?
      if (parsed.action === "final_answer" && parsed.finalAnswer != null) {
        await db.agentStep.create({
          data: {
            taskId: task.id,
            stepNumber,
            thought: parsed.thought,
            action: "final_answer",
            actionInput: null,
            observation: parsed.finalAnswer,
            providerId: finalProvider.id,
            model: outcome.result.model,
            latencyMs: outcome.result.latencyMs,
            tokensUsed: outcome.result.tokensUsed ?? null,
            failedOver: outcome.failedOver,
          },
        });
        return finishTask(task.id, {
          status: "completed",
          finalAnswer: parsed.finalAnswer,
          errorMessage: null,
          stepsTaken: stepNumber,
          failedOverCount,
          totalLatencyMs,
          totalTokensUsed,
        });
      }

      // Did the LLM ask to call a tool?
      if (parsed.action && parsed.action !== "final_answer") {
        const tool = getTool(parsed.action);
        let observation: string;
        if (!tool) {
          observation = `Error: unknown tool "${parsed.action}". Available tools: ${toolDescriptionsForPrompt()
            .split("\n")
            .filter((l) => l.startsWith("### "))
            .map((l) => l.replace("### ", ""))
            .join(", ")}`;
        } else {
          try {
            observation = await tool.execute(parsed.actionInput);
          } catch (err) {
            observation = `Tool "${parsed.action}" failed: ${err instanceof Error ? err.message : String(err)}`;
          }
        }

        await db.agentStep.create({
          data: {
            taskId: task.id,
            stepNumber,
            thought: parsed.thought,
            action: parsed.action,
            actionInput: JSON.stringify(parsed.actionInput ?? null),
            observation: observation.slice(0, 10000),
            providerId: finalProvider.id,
            model: outcome.result.model,
            latencyMs: outcome.result.latencyMs,
            tokensUsed: outcome.result.tokensUsed ?? null,
            failedOver: outcome.failedOver,
          },
        });

        // Continue to next iteration with the new step included.
        task.steps = [
          ...task.steps,
          { stepNumber, thought: parsed.thought, action: parsed.action, actionInput: JSON.stringify(parsed.actionInput ?? null), observation } as any,
        ];
        continue;
      }

      // Parse error — record and ask the LLM again on the next iteration.
      await db.agentStep.create({
        data: {
          taskId: task.id,
          stepNumber,
          thought: parsed.thought || rawResponse.slice(0, 500),
          action: null,
          actionInput: null,
          observation: null,
          errorMessage: parsed.parseError ?? "Could not parse a valid action or final answer.",
          providerId: finalProvider.id,
          model: outcome.result.model,
          latencyMs: outcome.result.latencyMs,
          tokensUsed: outcome.result.tokensUsed ?? null,
          failedOver: outcome.failedOver,
        },
      });

      // If we've had 2+ consecutive parse errors, give up gracefully.
      if (stepNumber >= maxSteps) break;
    }

    // Ran out of steps without a final answer.
    return finishTask(task.id, {
      status: "failed",
      finalAnswer: null,
      errorMessage: `Agent did not produce a final answer within ${maxSteps} steps.`,
      stepsTaken: stepNumber,
      failedOverCount,
      totalLatencyMs,
      totalTokensUsed,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return finishTask(task.id, {
      status: "failed",
      finalAnswer: null,
      errorMessage: `Agent crashed: ${errorMessage}`,
      stepsTaken: stepNumber,
      failedOverCount,
      totalLatencyMs,
      totalTokensUsed,
    });
  }
}

async function finishTask(taskId: string, result: AgentRunResult): Promise<AgentRunResult> {
  await db.agentTask.update({
    where: { id: taskId },
    data: {
      status: result.status,
      finalAnswer: result.finalAnswer,
      errorMessage: result.errorMessage,
      totalLatencyMs: result.totalLatencyMs,
      totalTokensUsed: result.totalTokensUsed,
      failedOverCount: result.failedOverCount,
      updatedAt: new Date(),
    },
  });
  return result;
}

// ─────────────────────────────────────────────────────────────
// Prompt building
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(goal: string): string {
  return [
    "You are Marq Agent — an AI assistant that can reason step-by-step and call tools to accomplish the user's goal.",
    "",
    "## Available tools",
    "",
    toolDescriptionsForPrompt(),
    "",
    "## How to respond",
    "",
    "Respond with EXACTLY ONE of the two formats below. Do not include any other text.",
    "",
    "### Format A — Call a tool",
    "",
    "THOUGHT: <one or two sentences explaining your reasoning>",
    "ACTION: <tool_name>",
    "ACTION_INPUT: <a single JSON object on one line, e.g. {\"query\": \"...\"}>",
    "",
    "### Format B — Give the final answer",
    "",
    "THOUGHT: <one or two sentences explaining your reasoning>",
    "FINAL_ANSWER: <your answer to the user>",
    "",
    "## Rules",
    "- Always think before you act. Use THOUGHT to plan.",
    "- If you have enough information, give FINAL_ANSWER. Do not call unnecessary tools.",
    "- ACTION_INPUT must be valid JSON on a single line.",
    "- Never invent tool names. Only use the tools listed above.",
    "- If a tool returns an error, try a different approach or give FINAL_ANSWER acknowledging the limitation.",
    "",
    "## The user's goal",
    "",
    goal,
  ].join("\n");
}

function buildHistory(systemPrompt: string, priorSteps: Array<{
  stepNumber: number;
  thought: string | null;
  action: string | null;
  actionInput: string | null;
  observation: string | null;
}>): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Begin. Respond with either ACTION/FINAL_ANSWER." },
  ];

  for (const step of priorSteps) {
    if (step.action === "final_answer") {
      messages.push({
        role: "assistant",
        content: `THOUGHT: ${step.thought ?? ""}\nFINAL_ANSWER: ${step.observation ?? ""}`,
      });
      continue;
    }
    if (step.action) {
      messages.push({
        role: "assistant",
        content: `THOUGHT: ${step.thought ?? ""}\nACTION: ${step.action}\nACTION_INPUT: ${step.actionInput ?? "{}"}`,
      });
      messages.push({
        role: "user",
        content: `OBSERVATION: ${step.observation ?? "(empty)"}`,
      });
      continue;
    }
    // Parse error step — surface to the LLM so it knows to retry.
    messages.push({
      role: "assistant",
      content: step.thought ?? "(no response)",
    });
    messages.push({
      role: "user",
      content: "Your previous response did not match the required format. Please respond again using either ACTION or FINAL_ANSWER.",
    });
  }

  return messages;
}

// ─────────────────────────────────────────────────────────────
// Response parsing
// ─────────────────────────────────────────────────────────────

function parseStepResponse(raw: string): ParsedStep {
  const trimmed = raw.trim();

  // Try to extract a FINAL_ANSWER first.
  const finalMatch = trimmed.match(/FINAL_ANSWER\s*:\s*([\s\S]+?)$/i);
  if (finalMatch) {
    const thought = extractThought(trimmed);
    return {
      thought,
      action: "final_answer",
      actionInput: null,
      finalAnswer: finalMatch[1].trim(),
      rawResponse: raw,
    };
  }

  // Otherwise try ACTION / ACTION_INPUT.
  const actionMatch = trimmed.match(/ACTION\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/i);
  const inputMatch = trimmed.match(/ACTION_INPUT\s*:\s*(\{[\s\S]*?\})\s*$/i);
  if (actionMatch) {
    const actionName = actionMatch[1];
    let actionInput: unknown = null;
    if (inputMatch) {
      try {
        actionInput = JSON.parse(inputMatch[1]);
      } catch {
        // If JSON parsing fails, pass the raw string as { query: ... } as a fallback.
        actionInput = { _raw: inputMatch[1] };
      }
    }
    const thought = extractThought(trimmed);
    return {
      thought,
      action: actionName,
      actionInput,
      finalAnswer: null,
      rawResponse: raw,
    };
  }

  // Could not parse — return raw as thought, surface parse error.
  return {
    thought: trimmed.slice(0, 500),
    action: null,
    actionInput: null,
    finalAnswer: null,
    rawResponse: raw,
    parseError: "Response did not contain FINAL_ANSWER or ACTION/ACTION_INPUT.",
  };
}

function extractThought(text: string): string {
  const m = text.match(/THOUGHT\s*:\s*([\s\S]+?)(?=\n(?:ACTION|FINAL_ANSWER)\s*:)/i);
  if (m) return m[1].trim();
  // Fall back: everything before ACTION or FINAL_ANSWER.
  const idx = text.search(/(ACTION|FINAL_ANSWER)\s*:/i);
  if (idx > 0) return text.slice(0, idx).replace(/THOUGHT\s*:\s*/i, "").trim();
  return "";
}

// Re-export ProviderError type so callers can use it.
export { ProviderError };
export type { FailoverReason };
