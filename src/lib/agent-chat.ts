/**
 * Marq AI Aggregator — Agent Chat Engine
 *
 * Multi-turn conversational agent that runs the same ReAct loop as the
 * task-based agent (`runAgentTask` in ./agent.ts), but with full
 * conversation history — so the user can keep prompting the agent until
 * they're satisfied, like Claude / ZAI / ChatGPT.
 *
 * Each user turn:
 *   1. Loads the conversation history (prior user + assistant messages).
 *   2. Builds a system prompt with the persona + format rules + tools.
 *   3. Runs the ReAct loop (up to `maxSteps`):
 *      - call LLM → parse THOUGHT/ACTION/ACTION_INPUT or FINAL_ANSWER
 *      - if ACTION: execute the tool, append the observation, continue
 *      - if FINAL_ANSWER: return the answer
 *   4. Persists the user message + assistant response (with the ReAct
 *      step trace attached as JSON) as Message rows on the ChatSession.
 *
 * The conversation continues across multiple turns because the prior
 * user/assistant messages are loaded from the DB and prepended to the
 * ReAct scratchpad every iteration — so the agent remembers everything
 * the user said and everything it answered.
 */

import { db } from "@/lib/db";
import { runWithFailover } from "@/lib/failover";
import type { ChatMessage } from "@/lib/providers";
import { reorderProvidersOpenSourceFirst } from "@/lib/providers";
import { getTool, toolDescriptionsForPrompt } from "@/lib/tools";
import { getTemplate, type AgentTemplate } from "@/lib/agent-templates";
import {
  buildSystemPrompt,
  parseStepResponse,
  type ParsedStep,
} from "@/lib/agent";

export interface AgentChatTurn {
  /** The user's message for this turn. */
  message: string;
  /** Template key (persona) for this conversation. Locked per session. */
  agentType: string;
  /** Existing ChatSession id, or null to create a new one. */
  sessionId?: string | null;
  /** OrgId for tenancy. */
  orgId?: string | null;
  /** Cap on ReAct iterations for this turn. Default 6. */
  maxSteps?: number;
  /** Per-step LLM call timeout. Default 45000ms. */
  timeoutMs?: number;
  /** Optional pinned primary provider. */
  primaryProviderId?: string | null;
}

export interface AgentStepRecord {
  stepNumber: number;
  thought: string | null;
  action: string | null;
  actionInput: unknown;
  observation: string | null;
  errorMessage?: string | null;
  providerName?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  tokensUsed?: number | null;
  failedOver?: boolean;
}

export interface AgentChatResult {
  sessionId: string;
  /** The assistant's final answer for this turn. */
  content: string;
  /** The ReAct step trace for this turn (also persisted on the Message). */
  steps: AgentStepRecord[];
  /** True if the agent completed the ReAct loop with a final answer. */
  ok: boolean;
  /** Error message if ok === false. */
  errorMessage: string | null;
  /** Aggregate stats. */
  totalLatencyMs: number;
  totalTokensUsed: number;
  failedOverCount: number;
  /** The provider that produced the final answer. */
  finalProviderId: string | null;
  finalProviderName: string | null;
  finalModel: string | null;
}

/**
 * Run one conversational turn of the agent. The user's message is
 * appended to the conversation history, then the ReAct loop runs until
 * the agent produces a FINAL_ANSWER (or hits maxSteps).
 */
export async function runAgentChatTurn(opts: AgentChatTurn): Promise<AgentChatResult> {
  const template = getTemplate(opts.agentType);
  const maxSteps = opts.maxSteps ?? 6;
  const timeoutMs = opts.timeoutMs ?? 45000;

  // ── 1. Resolve or create the session ──────────────────────────────
  let session: { id: string; agentType: string | null; orgId: string | null };
  if (opts.sessionId) {
    const found = await db.chatSession.findUnique({ where: { id: opts.sessionId } });
    if (!found) {
      return failResult(null, `Session ${opts.sessionId} not found`, template);
    }
    session = found;
  } else {
    const title = opts.message.slice(0, 60) + (opts.message.length > 60 ? "…" : "");
    const created = await db.chatSession.create({
      data: {
        agentType: template.key,
        orgId: opts.orgId ?? null,
        title,
      },
    });
    session = created;
  }

  // ── 2. Persist the user's message ────────────────────────────────
  await db.message.create({
    data: {
      sessionId: session.id,
      role: "user",
      content: opts.message,
    },
  });

  // ── 3. Load full conversation history (user + assistant pairs) ──
  // We reload after creating the user message so the history includes
  // the just-saved user turn.
  const allMessages = await db.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
  });

  // ── 4. Load active providers (with optional pinned primary) ──────
  // Apply the "open source first" auto-mode policy so free providers
  // (marq_free, HuggingFace, Ollama, frameworks) are tried before
  // chargeable APIs. A pinned primary, if set, is moved to the front
  // AFTER the tier reorder so the user's explicit choice still wins.
  let providers = await db.provider.findMany({
    where: { active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  providers = reorderProvidersOpenSourceFirst(providers);
  if (providers.length === 0) {
    return failResult(session.id, "No active providers configured.", template);
  }
  const primaryId = opts.primaryProviderId || null;
  if (primaryId) {
    const primary = providers.find((p) => p.id === primaryId);
    if (primary) {
      providers = [primary, ...providers.filter((p) => p.id !== primaryId)];
    }
  }

  // ── 5. Build the system prompt with the latest user message as the
  //         active "goal" and prior turns as conversation context. ──
  const systemPrompt = buildSystemPromptForChat(template, opts.message, allMessages);

  // ── 6. Run the ReAct loop ────────────────────────────────────────
  const steps: AgentStepRecord[] = [];
  let totalLatencyMs = 0;
  let totalTokensUsed = 0;
  let failedOverCount = 0;
  let finalAnswer: string | null = null;
  let finalProviderId: string | null = null;
  let finalProviderName: string | null = null;
  let finalModel: string | null = null;
  let errorMessage: string | null = null;

  // Scratchpad of ReAct steps WITHIN this turn (NOT the prior conversation
  // — that's already in the system prompt via allMessages).
  const reactScratchpad: Array<{
    thought: string | null;
    action: string | null;
    actionInput: string | null;
    observation: string | null;
  }> = [];

  for (let stepNum = 1; stepNum <= maxSteps; stepNum++) {
    const stepStart = Date.now();

    // Build the LLM message list: system prompt + "begin" + scratchpad.
    const history: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Begin. Respond with either ACTION/FINAL_ANSWER." },
    ];
    for (const s of reactScratchpad) {
      if (s.action === "final_answer") {
        history.push({
          role: "assistant",
          content: `THOUGHT: ${s.thought ?? ""}\nFINAL_ANSWER: ${s.observation ?? ""}`,
        });
        continue;
      }
      if (s.action) {
        history.push({
          role: "assistant",
          content: `THOUGHT: ${s.thought ?? ""}\nACTION: ${s.action}\nACTION_INPUT: ${s.actionInput ?? "{}"}`,
        });
        history.push({
          role: "user",
          content: `OBSERVATION: ${s.observation ?? "(empty)"}`,
        });
        continue;
      }
      // parse-error step
      history.push({ role: "assistant", content: s.thought ?? "(no response)" });
      history.push({
        role: "user",
        content:
          "ERROR: Your previous response did not contain THOUGHT/ACTION/ACTION_INPUT or THOUGHT/FINAL_ANSWER.\n\n" +
          "You MUST respond now using EXACTLY one of these two formats. No prose. No markdown. No code fences.\n\n" +
          "Option A — call a tool:\n  THOUGHT: <reasoning>\n  ACTION: <tool_name>\n  ACTION_INPUT: {\"key\": \"value\"}\n\n" +
          "Option B — final answer:\n  THOUGHT: <reasoning>\n  FINAL_ANSWER: <your answer>\n\n" +
          "Reply now with one of these two formats.",
      });
    }

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
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({
        stepNumber: stepNum,
        thought: null,
        action: null,
        actionInput: null,
        observation: null,
        errorMessage: `All providers failed: ${msg}`,
        latencyMs: Date.now() - stepStart,
      });
      errorMessage = `All providers failed at step ${stepNum}: ${msg}`;
      break;
    }

    const finalProvider = providers.find((p) => p.id === outcome.finalProviderId) ?? null;
    const raw = outcome.result.content;
    const parsed = parseStepResponse(raw);

    totalLatencyMs += outcome.result.latencyMs;
    totalTokensUsed += outcome.result.tokensUsed ?? 0;
    if (outcome.failedOver) failedOverCount++;

    // FINAL_ANSWER → done.
    if (parsed.action === "final_answer" && parsed.finalAnswer != null) {
      steps.push({
        stepNumber: stepNum,
        thought: parsed.thought,
        action: "final_answer",
        actionInput: null,
        observation: parsed.finalAnswer,
        providerName: finalProvider?.displayName ?? null,
        model: outcome.result.model,
        latencyMs: outcome.result.latencyMs,
        tokensUsed: outcome.result.tokensUsed ?? null,
        failedOver: outcome.failedOver,
      });
      finalAnswer = parsed.finalAnswer;
      finalProviderId = finalProvider?.id ?? null;
      finalProviderName = finalProvider?.displayName ?? null;
      finalModel = outcome.result.model;
      break;
    }

    // ACTION → execute the tool.
    if (parsed.action && parsed.action !== "final_answer") {
      // Enforce the template's tool whitelist.
      if (!template.tools.includes(parsed.action)) {
        const allowed = template.tools.join(", ");
        const obs = `Tool "${parsed.action}" is not allowed for the ${template.displayName} agent. Allowed tools: ${allowed}.`;
        steps.push({
          stepNumber: stepNum,
          thought: parsed.thought,
          action: parsed.action,
          actionInput: parsed.actionInput,
          observation: obs,
          providerName: finalProvider?.displayName ?? null,
          model: outcome.result.model,
          latencyMs: outcome.result.latencyMs,
          tokensUsed: outcome.result.tokensUsed ?? null,
          failedOver: outcome.failedOver,
        });
        reactScratchpad.push({
          thought: parsed.thought,
          action: parsed.action,
          actionInput: JSON.stringify(parsed.actionInput ?? null),
          observation: obs,
        });
        continue;
      }

      const tool = getTool(parsed.action);
      let observation: string;
      if (!tool) {
        observation = `Error: unknown tool "${parsed.action}".`;
      } else {
        try {
          observation = await tool.execute(parsed.actionInput);
        } catch (err) {
          observation = `Tool "${parsed.action}" failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
      observation = observation.slice(0, 10000);
      steps.push({
        stepNumber: stepNum,
        thought: parsed.thought,
        action: parsed.action,
        actionInput: parsed.actionInput,
        observation,
        providerName: finalProvider?.displayName ?? null,
        model: outcome.result.model,
        latencyMs: outcome.result.latencyMs,
        tokensUsed: outcome.result.tokensUsed ?? null,
        failedOver: outcome.failedOver,
      });
      reactScratchpad.push({
        thought: parsed.thought,
        action: parsed.action,
        actionInput: JSON.stringify(parsed.actionInput ?? null),
        observation,
      });
      continue;
    }

    // Parse error — record and ask the LLM again next iteration.
    steps.push({
      stepNumber: stepNum,
      thought: parsed.thought || raw.slice(0, 500),
      action: null,
      actionInput: null,
      observation: null,
      errorMessage: parsed.parseError ?? "Could not parse a valid action or final answer.",
      providerName: finalProvider?.displayName ?? null,
      model: outcome.result.model,
      latencyMs: outcome.result.latencyMs,
      tokensUsed: outcome.result.tokensUsed ?? null,
      failedOver: outcome.failedOver,
    });
    reactScratchpad.push({
      thought: parsed.thought || raw.slice(0, 500),
      action: null,
      actionInput: null,
      observation: null,
    });
  }

  // ── 7. Persist the assistant's response ─────────────────────────
  if (finalAnswer) {
    // Pick the provider that produced the final answer.
    const finalProviderRow = finalProviderId
      ? providers.find((p) => p.id === finalProviderId) ?? null
      : null;
    await db.message.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: finalAnswer,
        providerId: finalProviderId,
        model: finalModel,
        latencyMs: totalLatencyMs,
        tokensUsed: totalTokensUsed,
        failedOver: failedOverCount > 0,
        agentSteps: JSON.stringify(steps),
      },
    });
    await db.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });
    return {
      sessionId: session.id,
      content: finalAnswer,
      steps,
      ok: true,
      errorMessage: null,
      totalLatencyMs,
      totalTokensUsed,
      failedOverCount,
      finalProviderId,
      finalProviderName: finalProviderRow?.displayName ?? null,
      finalModel,
    };
  }

  // No final answer — persist an error message as the assistant turn so
  // the user sees something in the chat.
  errorMessage = errorMessage ?? `Agent did not produce a final answer within ${maxSteps} steps.`;
  await db.message.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      content: `⚠️ ${errorMessage}`,
      providerId: null,
      model: null,
      latencyMs: totalLatencyMs,
      tokensUsed: totalTokensUsed,
      failedOver: failedOverCount > 0,
      agentSteps: JSON.stringify(steps),
    },
  });
  await db.chatSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() },
  });
  return {
    sessionId: session.id,
    content: errorMessage,
    steps,
    ok: false,
    errorMessage,
    totalLatencyMs,
    totalTokensUsed,
    failedOverCount,
    finalProviderId: null,
    finalProviderName: null,
    finalModel: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function failResult(sessionId: string | null, errorMessage: string, _template: AgentTemplate): AgentChatResult {
  return {
    sessionId: sessionId ?? "",
    content: errorMessage,
    steps: [],
    ok: false,
    errorMessage,
    totalLatencyMs: 0,
    totalTokensUsed: 0,
    failedOverCount: 0,
    finalProviderId: null,
    finalProviderName: null,
    finalModel: null,
  };
}

/**
 * Build the system prompt for one agent chat turn.
 *
 * Differs from `buildSystemPrompt` in agent.ts in one way: instead of a
 * single `goal`, we pass the latest user message as the goal AND include
 * the prior conversation history (user/assistant turns) as context, so
 * the agent can answer follow-up questions and reference earlier turns.
 */
function buildSystemPromptForChat(
  template: AgentTemplate,
  latestUserMessage: string,
  history: Array<{ role: string; content: string }>,
): string {
  // Truncate the persona so format rules never get buried.
  const PERSONA_CAP = 4500;
  let persona = template.persona.trim();
  if (persona.length > PERSONA_CAP) {
    persona = persona.slice(0, PERSONA_CAP) + "\n\n[…skill instructions truncated for prompt budget; follow the core guidance above…]";
  }

  // Build the conversation history section. Exclude the last message
  // (which is the current user turn — passed separately as the goal).
  const priorTurns = history.slice(0, -1);
  let conversationBlock = "";
  if (priorTurns.length > 0) {
    const turns = priorTurns
      .map((m) => {
        const role = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System";
        return `${role}: ${m.content}`;
      })
      .join("\n\n");
    conversationBlock = [
      "",
      "---",
      "",
      "## Prior conversation (for context)",
      "",
      turns,
      "",
      "The user is now sending a follow-up message. Use the prior turns",
      "for context but answer the LATEST message. You may call tools or",
      "give FINAL_ANSWER.",
      "",
      "---",
      "",
    ].join("\n");
  }

  return [
    "# OUTPUT FORMAT — READ THIS FIRST, IT IS NON-NEGOTIABLE",
    "",
    "You are an autonomous ReAct agent in a multi-turn chat. EVERY response",
    "you produce MUST match EXACTLY ONE of the two formats below. No prose.",
    "No markdown headings. No explanations before or after. No code fences.",
    "Just the format.",
    "",
    "Format A — call a tool:",
    "  THOUGHT: <one or two sentences of reasoning>",
    "  ACTION: <tool_name>",
    "  ACTION_INPUT: <one-line JSON object, e.g. {\"query\": \"...\"}>",
    "",
    "Format B — give the final answer:",
    "  THOUGHT: <one or two sentences of reasoning>",
    "  FINAL_ANSWER: <your answer to the user>",
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
    conversationBlock,
    "## The user's latest message",
    "",
    latestUserMessage,
    "",
    "---",
    "",
    "## REMINDER",
    "Respond now with EXACTLY ONE of: (A) THOUGHT/ACTION/ACTION_INPUT, or",
    "(B) THOUGHT/FINAL_ANSWER. Nothing else. No code fences. No prose.",
  ].join("\n");
}
