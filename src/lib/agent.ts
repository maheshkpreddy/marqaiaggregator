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
import { getTemplate } from "@/lib/agent-templates";

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

export interface ParsedStep {
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
  // The template is selected by task.agentType (falls back to "general").
  const template = getTemplate(task.agentType);
  const systemPrompt = buildSystemPrompt(task.goal, template);

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
        // Enforce the template's tool whitelist. If the LLM asked for a tool
        // the current persona isn't allowed to use, return an error observation
        // so the model picks a different approach on the next iteration.
        if (!template.tools.includes(parsed.action)) {
          const allowedList = template.tools.join(", ");
          await db.agentStep.create({
            data: {
              taskId: task.id,
              stepNumber,
              thought: parsed.thought,
              action: parsed.action,
              actionInput: JSON.stringify(parsed.actionInput ?? null),
              observation: `Tool "${parsed.action}" is not allowed for the ${template.displayName} agent. Allowed tools: ${allowedList}.`,
              providerId: finalProvider.id,
              model: outcome.result.model,
              latencyMs: outcome.result.latencyMs,
              tokensUsed: outcome.result.tokensUsed ?? null,
              failedOver: outcome.failedOver,
            },
          });
          task.steps = [
            ...task.steps,
            {
              stepNumber,
              thought: parsed.thought,
              action: parsed.action,
              actionInput: JSON.stringify(parsed.actionInput ?? null),
              observation: `Tool "${parsed.action}" is not allowed for the ${template.displayName} agent.`,
            } as any,
          ];
          continue;
        }

        const tool = getTool(parsed.action);
        let observation: string;
        if (!tool) {
          observation = `Error: unknown tool "${parsed.action}". Available tools: ${toolDescriptionsForPrompt(template.tools)
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

/**
 * Build the system prompt for one agent iteration.
 *
 * IMPORTANT — the order of sections matters. The LLM attends most to the
 * TOP of the prompt and the BOTTOM of the prompt. We deliberately put the
 * strict ReAct format rules at the very top, then the skill/persona context
 * in the middle (truncated if it's huge — some imported skills ship
 * 15KB+ of markdown which would otherwise bury the format rules), then the
 * user's goal + a one-shot example + a final reminder at the bottom.
 *
 * Without this ordering, long imported skill personas cause the LLM to
 * respond in regular prose/markdown (its natural style for "following a
 * skill") instead of the strict THOUGHT/ACTION/ACTION_INPUT format the
 * parser expects, which surfaces as "Response did not contain
 * FINAL_ANSWER or ACTION/ACTION_INPUT" errors.
 */
export function buildSystemPrompt(goal: string, template: { displayName: string; persona: string; tools: string[] }): string {
  // Truncate the persona so the format rules never get buried. We keep the
  // first 4500 chars (enough for almost all skills' core instructions) and
  // append a clear truncation marker if we had to cut.
  const PERSONA_CAP = 4500;
  let persona = template.persona.trim();
  if (persona.length > PERSONA_CAP) {
    persona = persona.slice(0, PERSONA_CAP) + "\n\n[…skill instructions truncated for prompt budget; follow the core guidance above…]";
  }

  return [
    "# OUTPUT FORMAT — READ THIS FIRST, IT IS NON-NEGOTIABLE",
    "",
    "You are an autonomous ReAct agent. EVERY response you produce MUST match",
    "EXACTLY ONE of the two formats below. No prose. No markdown headings.",
    "No explanations before or after. No code fences. Just the format.",
    "",
    "Format A — call a tool:",
    "  THOUGHT: <one or two sentences of reasoning>",
    "  ACTION: <tool_name>",
    "  ACTION_INPUT: <one-line JSON object, e.g. {\"query\": \"...\"}>",
    "",
    "Format B — give the final answer:",
    "  THOUGHT: <one or two sentences of reasoning>",
    "  FINAL_ANSWER: <your answer>",
    "",
    "If you have enough information to answer, use Format B. Otherwise use",
    "Format A to call a tool. Never invent tool names. Never wrap your",
    "response in ``` code fences. The first non-empty line must start with",
    "either `THOUGHT:` or `FINAL_ANSWER:`.",
    "",
    "## One-shot example",
    "",
    "THOUGHT: I need to search the web for the latest news on this topic.",
    "ACTION: web_search",
    "ACTION_INPUT: {\"query\": \"latest AI news this week\"}",
    "",
    "---",
    "",
    "# AGENT PERSONA — " + template.displayName,
    "",
    persona,
    "",
    "---",
    "",
    "## Available tools (only these may appear after ACTION:)",
    "",
    toolDescriptionsForPrompt(template.tools),
    "",
    "## The user's goal",
    "",
    goal,
    "",
    "---",
    "",
    "## REMINDER",
    "Respond now with EXACTLY ONE of: (A) THOUGHT/ACTION/ACTION_INPUT, or",
    "(B) THOUGHT/FINAL_ANSWER. Nothing else. No code fences. No prose.",
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
    // Parse error step — surface to the LLM so it knows to retry, with a
    // STRONG reminder of the exact format. Without this the model often
    // repeats its prose-style response and the task fails after maxSteps.
    messages.push({
      role: "assistant",
      content: step.thought ?? "(no response)",
    });
    messages.push({
      role: "user",
      content:
        "ERROR: Your previous response did not contain THOUGHT/ACTION/ACTION_INPUT or THOUGHT/FINAL_ANSWER.\n\n" +
        "You MUST respond now using EXACTLY one of these two formats. No prose. No markdown. No code fences.\n\n" +
        "Option A — call a tool:\n" +
        "  THOUGHT: <reasoning>\n" +
        "  ACTION: <tool_name>\n" +
        "  ACTION_INPUT: {\"key\": \"value\"}\n\n" +
        "Option B — final answer:\n" +
        "  THOUGHT: <reasoning>\n" +
        "  FINAL_ANSWER: <your answer>\n\n" +
        "Reply now with one of these two formats. The first non-empty line must start with THOUGHT: or FINAL_ANSWER:.",
    });
  }

  return messages;
}

// ─────────────────────────────────────────────────────────────
// Response parsing
// ─────────────────────────────────────────────────────────────

/**
 * Parse one LLM response into a structured ReAct step.
 *
 * The parser is intentionally lenient. The imported skills-platform
 * templates have long, prose-heavy personas, and even with strict format
 * rules at the top of the system prompt, models will sometimes:
 *   - wrap their response in ``` code fences
 *   - add a closing remark after FINAL_ANSWER
 *   - add commentary after the ACTION_INPUT JSON
 *   - use lowercase or extra whitespace around the markers
 *   - emit the JSON across multiple lines (pretty-printed)
 *
 * Each of those would silently break the original strict regex parser and
 * surface as the dreaded "Response did not contain FINAL_ANSWER or
 * ACTION/ACTION_INPUT" error. This parser strips code fences first, then
 * tries several match strategies before giving up.
 */
export function parseStepResponse(raw: string): ParsedStep {
  // 1. Strip markdown code fences if present. Models often wrap the whole
  //    response in ```text ... ``` despite being told not to.
  const stripped = stripCodeFences(raw);
  const trimmed = stripped.trim();

  // 2. Try to extract FINAL_ANSWER first. We accept it anywhere in the
  //    response (not just at the end) because some models add a trailing
  //    "Let me know if you need anything else!" line.
  //    The match captures everything after the FINAL_ANSWER: marker up to
  //    either end-of-string or a trailing closing code fence / quote.
  const finalMatch = trimmed.match(/FINAL_ANSWER\s*:\s*([\s\S]+?)(?:\n```|\s*$)/i);
  if (finalMatch) {
    const thought = extractThought(trimmed);
    const finalAnswer = finalMatch[1].trim();
    if (finalAnswer.length > 0) {
      return {
        thought,
        action: "final_answer",
        actionInput: null,
        finalAnswer,
        rawResponse: raw,
      };
    }
  }

  // 3. Try ACTION / ACTION_INPUT. We accept the JSON object even if there
  //    is trailing text after it (e.g. trailing commentary, closing fence).
  //    Strategy: find ACTION: <name>, then find ACTION_INPUT: <json> by
  //    scanning forward and balancing braces.
  const actionMatch = trimmed.match(/ACTION\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/i);
  if (actionMatch) {
    const actionName = actionMatch[1];
    const actionInput = extractActionInput(trimmed);
    const thought = extractThought(trimmed);
    return {
      thought,
      action: actionName,
      actionInput,
      finalAnswer: null,
      rawResponse: raw,
    };
  }

  // 4. Could not parse — return raw as thought, surface parse error.
  return {
    thought: trimmed.slice(0, 500),
    action: null,
    actionInput: null,
    finalAnswer: null,
    rawResponse: raw,
    parseError: "Response did not contain FINAL_ANSWER or ACTION/ACTION_INPUT.",
  };
}

/**
 * Strip a single outer pair of markdown code fences if the whole response
 * is wrapped in one. Leaves inner code blocks (e.g. JSON examples inside a
 * FINAL_ANSWER) untouched.
 */
function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  // Match opening fence ```lang (optional lang) ... closing ```
  const m = trimmed.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n```\s*$/);
  return m ? m[1] : trimmed;
}

/**
 * Extract and JSON-parse the ACTION_INPUT value. Walks the string forward
 * from the ACTION_INPUT: marker, finds the first `{`, then balances braces
 * to find the matching `}`. This handles pretty-printed JSON, nested
 * objects, and trailing commentary after the JSON.
 *
 * Returns the parsed object, or { _raw: <string> } if the matched span
 * isn't valid JSON, or null if no ACTION_INPUT marker was found.
 */
function extractActionInput(text: string): unknown {
  const markerMatch = text.match(/ACTION_INPUT\s*:\s*/i);
  if (!markerMatch) return null;
  const startIdx = markerMatch.index! + markerMatch[0].length;

  // Find the first `{` after the marker.
  const objStart = text.indexOf("{", startIdx);
  if (objStart === -1) return null;

  // Balance braces, respecting strings.
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = objStart; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const jsonStr = text.slice(objStart, i + 1);
        try {
          return JSON.parse(jsonStr);
        } catch {
          return { _raw: jsonStr };
        }
      }
    }
  }
  // No balanced close brace — return whatever we have as raw.
  return { _raw: text.slice(objStart) };
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
