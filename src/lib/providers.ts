/**
 * Marq AI Aggregator - Provider Registry & Adapters
 *
 * Each provider has a unified interface `chat()` that returns a streamed-or-final response.
 *
 * Two modes:
 *  - Demo mode (no API key configured on the Provider row): generates a canned
 *    but contextual response LOCALLY — no external API call. Simulated per-provider
 *    latency + a small failure rate so the failover engine is exercised. This is
 *    the default out-of-the-box experience so the platform runs anywhere
 *    (including Vercel free tier) without any external credentials.
 *  - Real mode (API key set on the Provider row): calls the real provider API
 *    (OpenAI / Gemini / Claude) via fetch(). Replace demoModeCall's canned
 *    responses with real responses transparently once a key is added.
 */

import type { Provider } from "@prisma/client";
export type { Provider };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderChatRequest {
  messages: ChatMessage[];
  model?: string;
  signal?: AbortSignal;
}

export interface ProviderChatResult {
  content: string;
  model: string;
  latencyMs: number;
  tokensUsed?: number;
}

export type FailoverReason =
  | "timeout"
  | "rate_limit"
  | "auth_error"
  | "server_error"
  | "network"
  | "unknown";

export class ProviderError extends Error {
  reason: FailoverReason;
  providerName: string;
  constructor(reason: FailoverReason, message: string, providerName: string) {
    super(message);
    this.reason = reason;
    this.providerName = providerName;
  }
}

/**
 * Map an HTTP status / error pattern to a FailoverReason.
 */
export function classifyError(err: unknown): FailoverReason {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("aborted")) return "timeout";
  if (msg.includes("rate") && msg.includes("limit")) return "rate_limit";
  if (msg.includes("429")) return "rate_limit";
  if (msg.includes("auth") || msg.includes("401") || msg.includes("api key") || msg.includes("unauthorized")) return "auth_error";
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("econn")) return "network";
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("server")) return "server_error";
  return "unknown";
}

/**
 * Dispatch a chat request to a provider.
 *
 * API key resolution order:
 *   1. `provider.apiKey` from the database (Providers tab in the UI).
 *   2. Environment variable fallback (so Vercel deployments can set keys
 *      without touching the DB). Mapping:
 *        openai        → OPENAI_API_KEY
 *        gemini        → GEMINI_API_KEY or GOOGLE_AI_API_KEY
 *        claude        → ANTHROPIC_API_KEY
 *        grok          → XAI_API_KEY or GROK_API_KEY
 *        huggingface   → HF_API_KEY or HUGGINGFACE_API_KEY
 *        marq_glm      → ZAI_TOKEN (uses the z-ai SDK with GLM-4-Plus)
 *        (custom)      → <NAME_UPPER>_API_KEY
 *
 * If no key is found anywhere, we fall back to demo mode, which generates a
 * canned-but-contextual response locally.
 */
export async function callProvider(
  provider: Provider,
  req: ProviderChatRequest,
): Promise<ProviderChatResult> {
  const start = Date.now();

  const effectiveKey = provider.apiKey || getEnvApiKey(provider.name);
  if (effectiveKey) {
    // Build a provider copy with the env-var key so realModeCall can use it.
    return realModeCall({ ...provider, apiKey: effectiveKey }, req, start);
  }
  // Special case: marq_glm uses the z-ai SDK which needs ZAI_TOKEN env var.
  if (provider.name === "marq_glm" && (process.env.ZAI_TOKEN || process.env.ZAI_API_TOKEN)) {
    return callZaiGlm(provider, req, start);
  }
  return demoModeCall(provider, req, start);
}

/**
 * Look up an API key from environment variables for the given provider name.
 * Returns the first match found, or null if none set.
 */
export function getEnvApiKey(providerName: string): string | null {
  const name = providerName.toUpperCase();
  // Try the common patterns in order of specificity.
  const candidates: string[] = [
    `${name}_API_KEY`,
  ];
  // Per-provider aliases.
  if (providerName === "gemini") {
    candidates.push("GEMINI_API_KEY", "GOOGLE_AI_API_KEY", "GOOGLE_API_KEY");
  } else if (providerName === "claude") {
    candidates.push("ANTHROPIC_API_KEY", "CLAUDE_API_KEY");
  } else if (providerName === "grok") {
    candidates.push("XAI_API_KEY", "GROK_API_KEY");
  } else if (providerName === "huggingface") {
    candidates.push("HF_API_KEY", "HUGGINGFACE_API_KEY", "HF_TOKEN");
  }
  for (const key of candidates) {
    const v = process.env[key];
    if (v && v.trim().length > 0) return v.trim();
  }
  return null;
}

/**
 * Check whether a provider has a usable API key (DB or env var).
 * Used by the Providers tab UI to show which providers are "live" vs "demo".
 */
export function hasEffectiveApiKey(provider: Provider): boolean {
  if (provider.apiKey) return true;
  if (getEnvApiKey(provider.name)) return true;
  if (provider.name === "marq_glm" && (process.env.ZAI_TOKEN || process.env.ZAI_API_TOKEN)) return true;
  return false;
}

/**
 * Demo-mode call: generates a canned response locally.
 *
 * No external network call is made — the platform runs anywhere without any
 * API credentials. We simulate per-provider latency so the comparison view
 * feels realistic, but demo mode ALWAYS succeeds — we never throw a fake
 * error. (Previously we injected a random failure rate to exercise the
 * failover engine, but this caused health checks to mark providers as
 * "Down" randomly, which was confusing on the dashboard. The failover
 * engine is still exercised when real API keys are added and a real
 * upstream provider returns 429/500/etc.)
 *
 * The response is contextual: it acknowledges the user's last message and
 * adopts the provider's persona. It's clearly labeled as demo output so
 * users know to add a real key for production use.
 */
async function demoModeCall(
  provider: Provider,
  req: ProviderChatRequest,
  start: number,
): Promise<ProviderChatResult> {
  // Simulate per-provider latency (in ms) — no failures, ever.
  const baseLatency =
    provider.name === "openai" ? 350 :
    provider.name === "gemini" ? 500 :
    provider.name === "claude" ? 700 :
    provider.name === "grok" ? 600 :
    provider.name === "ollama" ? 1200 :
    provider.name === "huggingface" ? 900 :
    provider.name === "replit" ? 800 :
    provider.name === "modal" ? 750 :
    provider.name === "gradio" ? 1000 :
    provider.name === "mlflow" ? 650 :
    provider.name === "crewai" ? 1100 :
    provider.name === "langchain" ? 850 :
    provider.name === "qvac" ? 700 :
    provider.name === "marq_glm" ? 500 : 450;
  const jitter = Math.floor(Math.random() * 200);
  await new Promise((r) => setTimeout(r, baseLatency + jitter));

  // Detect agent context: the agent engine injects a system prompt that
  // always mentions "FINAL_ANSWER" and "ACTION_INPUT" (see buildSystemPrompt
  // in src/lib/agent.ts). When we see those markers, we must reply in the
  // strict ReAct format the agent parser expects — otherwise every step
  // would be a parse error and the task would fail after maxSteps.
  const systemMsg = req.messages.find((m) => m.role === "system");
  const isAgentCall = !!systemMsg &&
    /FINAL_ANSWER/.test(systemMsg.content) &&
    /ACTION_INPUT/.test(systemMsg.content);

  const content = isAgentCall
    ? buildAgentDemoResponse(provider, req)
    : buildDemoResponse(provider, req);
  const latencyMs = Date.now() - start;

  return {
    content,
    model: req.model || defaultModelFor(provider.name),
    latencyMs,
    tokensUsed: Math.ceil(content.length / 4),
  };
}

/**
 * Build a canned-but-contextual response for demo mode.
 *
 * Strategy: acknowledge the user's most recent message, echo a short summary
 * back, and clearly state this is demo output. Each provider has its own
 * personality so the comparison view feels meaningful.
 */
function buildDemoResponse(provider: Provider, req: ProviderChatRequest): string {
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  const userText = (lastUser?.content ?? "").trim();
  const snippet = userText.length > 180 ? userText.slice(0, 180) + "…" : userText;

  const persona = personaFor(provider.name);

  // Provider-specific response styles — same prompt, different "feel".
  switch (provider.name) {
    case "openai":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-OpenAI**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `Here's a concise structured take:`,
        `1. **Direct answer** — based on the message above, the key point is acknowledged and addressed head-on.`,
        `2. **Reasoning** — the rationale follows from the question's framing, with assumptions made explicit.`,
        `3. **Next step** — a concrete follow-up action you can take right away.`,
        ``,
        `> ⚠️ **This is a simulated response, not a real AI answer.** To get genuine responses, do ONE of:`,
        `> - **Set \`OPENAI_API_KEY\`** as a Vercel env var (Project → Settings → Environment Variables), OR`,
        `> - **Add your key** in the **Providers** tab (then click Save).`,
        `> Marq will automatically use the first configured provider and fall over to the next if one fails.`,
      ].join("\n");

    case "gemini":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-Gemini**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `Let me work through this step by step:`,
        ``,
        `**Step 1 — Context.** First, I parse the request and identify the underlying intent.`,
        `**Step 2 — Assumptions.** I assume you want a grounded, factual answer (let me know if you want a creative take instead).`,
        `**Step 3 — Analysis.** Based on the message, the most defensible interpretation leads to a multi-step recommendation.`,
        `**Step 4 — Conclusion.** The answer follows from the above, with a clear pointer to verify the reasoning.`,
        ``,
        `> ⚠️ This is a simulated response. Add your Gemini API key in the **Providers** tab to get real completions.`,
      ].join("\n");

    case "claude":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-Claude**`,
        ``,
        `Thanks for the message — you wrote: "${snippet}".`,
        ``,
        `Let me share a careful, balanced take. There are usually a few ways to read a question like this, and I want to honor that nuance rather than jumping to a single answer. The most thoughtful response considers the trade-offs involved and errs on the side of clarity without overstating certainty.`,
        ``,
        `If you'd like, I can go deeper on any particular angle — just let me know which aspect matters most to you.`,
        ``,
        `> ⚠️ This is a simulated response. Add your Anthropic API key in the **Providers** tab to get real completions.`,
      ].join("\n");

    case "grok":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-Grok**`,
        ``,
        `Alright — you asked: "${snippet}".`,
        ``,
        `Straight talk: the question has a real answer, and here's the no-fluff version. No corporate hedging, no "as an AI language model" preamble — just the take. The honest read is that there's a clear best move here, and I'll name it directly. If you want me to push back on a premise or check my own work, say the word.`,
        ``,
        `> ⚠️ This is a simulated response. Add your xAI API key in the **Providers** tab to get real Grok completions.`,
      ].join("\n");

    case "huggingface":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-HuggingFace**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `From the model-zoo perspective, the right answer depends on which open model fits the task. For general chat, Llama-3.1-8B-Instruct is a solid default; for code, CodeLlama or DeepSeek-Coder; for embeddings, BGE or E5. The Hub has thousands of variants — pick the one that matches your constraints (memory, language, license).`,
        ``,
        `> ⚠️ This is a simulated response. Add your Hugging Face API token in the **Providers** tab to get real completions.`,
      ].join("\n");

    case "ollama":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-Ollama**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `Running locally on your machine — no cloud round-trip, no data leaving the box. The default model is llama3.1, but you can pull any model from the Ollama library ('ollama pull mistral', 'ollama pull phi3', etc.). Latency depends on your GPU/CPU; expect 20–80 tokens/sec on a typical laptop. Perfect for private, offline, or air-gapped workflows.`,
        ``,
        `> ⚠️ This is a simulated response. Run \`ollama serve\` locally and set the endpoint to http://localhost:11434/v1/chat/completions in the **Providers** tab to get real local completions.`,
      ].join("\n");

    case "replit":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-Replit**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `In a cloud IDE context, the answer is: write the smallest runnable snippet first, run it, then iterate. The Replit model is tuned for that loop — short, executable code with inline explanations. Don't paste a wall of code; paste the smallest repro and let the model work outward from there.`,
        ``,
        `> ⚠️ This is a simulated response. Add your Replit API key in the **Providers** tab to get real completions.`,
      ].join("\n");

    case "modal":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-Modal**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `From a serverless-inference angle: package the model as a Modal function, set \`keep_warm\` based on your traffic pattern (0 for batch, 1+ for interactive), and let Modal autoscale the rest. Cold start is ~3–10s for small models, ~30s for large — keep that in mind for SLA design.`,
        ``,
        `> ⚠️ This is a simulated response. Add your Modal token ID/secret in the **Providers** tab to get real completions.`,
      ].join("\n");

    case "gradio":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-Gradio**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `For ML demos: spin up a Gradio Space, expose a \`predict()\` function, and the UI is auto-generated. The Marq-Gradio adapter can talk to any Space's API endpoint — just paste the Space URL as the apiEndpoint. Great for letting non-technical stakeholders poke at a model.`,
        ``,
        `> ⚠️ This is a simulated response. Set the Gradio Space URL as the apiEndpoint in the **Providers** tab to get real completions.`,
      ].join("\n");

    case "mlflow":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-MLflow**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `From an MLOps view: log every run with \`mlflow.log_metrics()\` and \`mlflow.log_artifacts()\`, tag with the dataset version, and compare runs in the MLflow UI before promoting. The Marq-MLflow adapter bridges the AI Gateway — point it at your MLflow gateway URL and you get OpenAI-compatible chat through your own registered models.`,
        ``,
        `> ⚠️ This is a simulated response. Set your MLflow AI Gateway URL as the apiEndpoint in the **Providers** tab to get real completions.`,
      ].join("\n");

    case "crewai":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-CrewAI**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `As a multi-agent orchestrator, I'd decompose this into roles: a Researcher to gather context, an Analyst to evaluate options, a Writer to draft the output. Each agent has its own LLM, tools, and persona. I synthesize their outputs into the final answer below — no single agent could have produced it alone.`,
        ``,
        `> ⚠️ This is a simulated response. Wire your CrewAI backend URL as the apiEndpoint in the **Providers** tab to get real multi-agent runs.`,
      ].join("\n");

    case "langchain":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-LangChain**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `Through a LangChain lens: this is a chain — Prompt → LLM → OutputParser → optional Tools. Define the chain once, run it many times with different inputs. For RAG, swap in a retriever step before the LLM. The Marq-LangChain adapter exposes your deployed LangServe endpoint as a chat provider.`,
        ``,
        `> ⚠️ This is a simulated response. Set your LangServe/LangChain endpoint URL as the apiEndpoint in the **Providers** tab to get real completions.`,
      ].join("\n");

    case "qvac":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq-Qvac**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `Quantum-inspired reasoning: I explore three solution paths in parallel — the conservative path (lowest risk), the balanced path (best expected value), and the bold path (highest upside). After evaluating each against your goal, the balanced path is the most defensible. Here's the reasoning trace, then the recommendation.`,
        ``,
        `> ⚠️ This is a simulated response. Set your Qvac endpoint URL as the apiEndpoint in the **Providers** tab to get real completions.`,
      ].join("\n");

    case "marq_glm":
      return [
        `_${persona}_`,
        ``,
        `**Demo response from Marq GLM**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `This is a simulated response because no \`ZAI_TOKEN\` environment variable is set. Marq GLM (GLM-4-Plus) is the platform's built-in real-LLM provider — it gives genuine AI answers when configured.`,
        ``,
        `**To enable real responses on Vercel:**`,
        `1. Go to your Vercel project → Settings → Environment Variables.`,
        `2. Add \`ZAI_TOKEN\` with a valid z-ai JWT token.`,
        `3. (Optional) Add \`ZAI_BASE_URL\` if you have a custom endpoint.`,
        `4. Redeploy. The Marq GLM provider will automatically use real GLM-4-Plus completions.`,
        ``,
        `Alternatively, add an OpenAI / Anthropic / Google API key via the **Providers** tab to use those providers directly.`,
      ].join("\n");

    default:
      return [
        `**Demo response from ${provider.displayName}**`,
        ``,
        `You asked: "${snippet}".`,
        ``,
        `> ⚠️ This is a simulated response. Add a real API key in the **Providers** tab to get real completions.`,
      ].join("\n");
  }
}

/**
 * Build a ReAct-formatted response when demo mode is invoked from the agent
 * engine. The agent parser (parseStepResponse in src/lib/agent.ts) requires
 * EXACTLY one of:
 *   - THOUGHT: ... \n ACTION: <tool> \n ACTION_INPUT: <json>
 *   - THOUGHT: ... \n FINAL_ANSWER: ...
 *
 * Strategy:
 *  1. If the conversation already contains an OBSERVATION (meaning the agent
 *     has called at least one tool), synthesize a FINAL_ANSWER that wraps up
 *     the observation into a coherent answer for the user.
 *  2. Otherwise, this is the first step. Parse the goal out of the system
 *     prompt's "## The user's goal" section, then pick the most relevant
 *     tool from the available tools listed in the system prompt. Return an
 *     ACTION/ACTION_INPUT tuple that the agent engine will execute.
 *
 * This keeps the agent loop turning in demo mode — every task completes in
 * 2 steps (one tool call + one final answer), which is realistic for a
 * demo and never produces parse errors.
 */
function buildAgentDemoResponse(provider: Provider, req: ProviderChatRequest): string {
  const persona = personaFor(provider.name);
  const personaTag = `[demo · ${provider.displayName}]`;

  // Has the agent already called a tool? Look for an OBSERVATION: line in
  // any prior user message (the agent engine injects observations as user
  // messages — see buildHistory in src/lib/agent.ts).
  const priorObservation = req.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .find((c) => /^OBSERVATION\s*:/im.test(c));

  if (priorObservation) {
    // We have tool output — synthesize a final answer that incorporates it.
    // Strip the "OBSERVATION:" prefix and any trailing demo-mode warning.
    const observationText = priorObservation
      .replace(/^OBSERVATION\s*:\s*/i, "")
      .replace(/⚠️[\s\S]*$/, "")
      .trim()
      .slice(0, 600);

    // Extract the goal text from the system prompt's "## The user's goal" section.
    const systemContentForGoal = req.messages.find((m) => m.role === "system")?.content ?? "";
    const goalText = systemContentForGoal
      .split(/## The user's goal/i)[1]?.trim().slice(0, 200) ?? "";

    const finalAnswer = [
      `${personaTag} Here's what I found working on your request.`,
      ``,
      `**Goal:** ${goalText || "(unspecified)"}`,
      ``,
      `**Tool output:**`,
      observationText,
      ``,
      `**Synthesis:** Based on the tool output above, the key takeaway is that the task can be addressed by acting on the information returned. In a real run (with API keys wired up), the tool would return live data and this synthesis would cite specific facts from it.`,
      ``,
      `_Persona: ${persona.split(". ")[0]}._`,
      ``,
      `> ⚠️ This is a simulated agent run. Add real API keys in the **Providers** tab to get live tool execution and genuine reasoning.`,
    ].join("\n");

    return [
      `THOUGHT: I've collected the information I need from the tool. Let me synthesize the observation into a final answer for the user.`,
      `FINAL_ANSWER: ${finalAnswer}`,
    ].join("\n");
  }

  // First step — pick a tool to call.
  // Extract the goal from the system prompt.
  const systemContent = req.messages.find((m) => m.role === "system")?.content ?? "";
  const goalMatch = systemContent.match(/## The user's goal\s*\n\s*([\s\S]+?)$/i);
  const goalText = (goalMatch?.[1] ?? "").trim().slice(0, 300);

  // Extract the list of available tools from the system prompt.
  // The agent engine formats them as "### tool_name" headers in the
  // "## Available tools" section.
  const toolMatches = Array.from(systemContent.matchAll(/^### ([a-z_][a-z0-9_]*)/gim));
  const availableTools = toolMatches.map((m) => m[1]);

  // Pick the most relevant tool based on keyword matching against the goal.
  const tool = pickToolForGoal(goalText, availableTools);

  // Construct a plausible action input for the chosen tool based on goal text.
  const actionInput = buildActionInput(tool, goalText);

  const thought = `I'll start by calling the ${tool} tool to gather the information needed to address the user's goal${goalText ? ` ("${goalText.slice(0, 100)}${goalText.length > 100 ? "…" : ""}")` : ""}. This is the most direct path to a useful answer.`;

  return [
    `THOUGHT: ${thought}`,
    `ACTION: ${tool}`,
    `ACTION_INPUT: ${JSON.stringify(actionInput)}`,
  ].join("\n");
}

/**
 * Pick the most relevant tool for a given goal based on keyword matching.
 * Falls back to the first available tool (or "web_search" if none listed).
 */
function pickToolForGoal(goal: string, available: string[]): string {
  const g = goal.toLowerCase();
  const keywordMap: Array<{ tool: string; keywords: string[] }> = [
    { tool: "web_search", keywords: ["search", "research", "find", "news", "latest", "current", "what is", "how do", "compare"] },
    { tool: "calculator", keywords: ["calculate", "compute", "math", "arithmetic", "+", "-", "*", "/", "times", "percent", "%"] },
    { tool: "current_time", keywords: ["time", "now", "today", "date", "hour", "minute"] },
    { tool: "text_summary", keywords: ["summarize", "summary", "tldr", "condense", "digest"] },
    { tool: "generate_code", keywords: ["code", "implement", "function", "class", "build", "write a", "create a hook", "create a component"] },
    { tool: "run_tests", keywords: ["test", "qa", "verify", "regression", "validate"] },
    { tool: "parse_requirements", keywords: ["requirement", "spec", "brief", "user story", "acceptance"] },
    { tool: "calculate_revenue", keywords: ["revenue", "mrr", "arr", "subscriber", "churn", "arpu", "pricing"] },
    { tool: "get_deploy_status", keywords: ["deploy", "deployment", "status", "production", "staging", "release", "rollback"] },
    { tool: "create_ticket", keywords: ["ticket", "issue", "bug", "track", "jira"] },
    { tool: "write_runbook", keywords: ["runbook", "incident", "sre", "outage", "post-mortem", "playbook"] },
  ];

  for (const { tool, keywords } of keywordMap) {
    if (available.includes(tool) && keywords.some((k) => g.includes(k))) {
      return tool;
    }
  }

  // Fallback: first available tool, or web_search as a sensible default.
  return available[0] ?? "web_search";
}

/**
 * Build a plausible JSON action input for the given tool, informed by the
 * goal text where possible.
 */
function buildActionInput(tool: string, goal: string): Record<string, unknown> {
  const trimmed = goal.trim().replace(/^["']|["']$/g, "");
  switch (tool) {
    case "web_search":
      return { query: trimmed.slice(0, 120) || "general inquiry", num: 5 };
    case "calculator": {
      // Try to extract a math-looking substring. Require at least one digit
      // so we don't match a bare space (which the char-class would otherwise
      // grab). If no math-looking run is found, fall back to a sample expr.
      const mathMatch = trimmed.match(/\d[\d().+\-*/^ ]*/);
      const expr = (mathMatch?.[0] ?? "2 + 2").trim();
      return { expression: expr || "2 + 2" };
    }
    case "current_time":
      return {};
    case "text_summary":
      return { text: trimmed.slice(0, 800) || "(no text provided)" };
    case "generate_code":
      return { description: trimmed.slice(0, 200) || "general utility", language: "typescript" };
    case "run_tests":
      return { module: "src/lib/failover" };
    case "parse_requirements":
      return { brief: trimmed.slice(0, 600) || "(no brief provided)" };
    case "calculate_revenue":
      return { subscribers: 100, arpu: 49, monthlyChurnPct: 5, months: 12 };
    case "get_deploy_status":
      return { service: "marq-api", environment: "production" };
    case "create_ticket":
      return { title: trimmed.slice(0, 100) || "Investigate issue", priority: "P2" };
    case "write_runbook":
      return { scenario: trimmed.slice(0, 200) || "generic incident response" };
    default:
      return { input: trimmed.slice(0, 200) };
  }
}

/**
 * Real-mode call: dispatches to the real provider API via fetch().
 *
 * Supports:
 *  - OpenAI  (POST https://api.openai.com/v1/chat/completions)
 *  - Gemini  (POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent)
 *  - Claude  (POST https://api.anthropic.com/v1/messages)
 *
 * If the provider's `name` is anything else, we fall back to the OpenAI shape
 * against the configured `apiEndpoint` (so custom OpenAI-compatible providers
 * like Together, Groq, Mistral, OpenRouter all work out of the box).
 */
async function realModeCall(
  provider: Provider,
  req: ProviderChatRequest,
  start: number,
): Promise<ProviderChatResult> {
  const model = req.model || defaultModelFor(provider.name);

  switch (provider.name) {
    case "openai":
      return callOpenAICompatible(provider, req, model, start);
    case "gemini":
      return callGemini(provider, req, model, start);
    case "claude":
      return callClaude(provider, req, model, start);
    case "marq_glm":
      // Should have been caught by callProvider, but handle here too.
      return callZaiGlm(provider, req, start);
    default:
      // Treat unknown providers as OpenAI-compatible.
      return callOpenAICompatible(provider, req, model, start);
  }
}

/**
 * Call the z-ai SDK (GLM-4-Plus) — a built-in provider that works on Vercel
 * when ZAI_TOKEN (and optionally ZAI_BASE_URL) are set as env vars.
 *
 * The z-ai SDK's default `ZAI.create()` reads from a `.z-ai-config` file,
 * which doesn't exist on Vercel. We bypass that by constructing the ZAI
 * instance directly with env-var credentials.
 *
 * If the z-ai-web-dev-sdk package isn't installed (e.g., on Vercel if it
 * was removed from package.json), we fall back to a direct fetch() call
 * against the z-ai API using the same protocol.
 */
async function callZaiGlm(
  provider: Provider,
  req: ProviderChatRequest,
  start: number,
): Promise<ProviderChatResult> {
  const token = process.env.ZAI_TOKEN || process.env.ZAI_API_TOKEN;
  if (!token) {
    throw new ProviderError(
      "auth_error",
      "ZAI_TOKEN environment variable is not set. Marq GLM provider requires it.",
      provider.name,
    );
  }
  const baseUrl = (process.env.ZAI_BASE_URL || "https://internal-api.z.ai/v1").replace(/\/$/, "");
  const apiKey = process.env.ZAI_API_KEY || "Z.ai";
  const model = req.model || "glm-4-plus";

  // The z-ai API is OpenAI-compatible in shape but requires custom headers:
  //   Authorization: Bearer <apiKey>     (literal "Z.ai")
  //   X-Token: <jwt token>               (the real auth credential)
  //   X-Z-AI-From: Z
  const endpoint = `${baseUrl}/chat/completions`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "X-Token": token,
      "X-Z-AI-From": "Z",
      ...(process.env.ZAI_CHAT_ID ? { "X-Chat-Id": process.env.ZAI_CHAT_ID } : {}),
      ...(process.env.ZAI_USER_ID ? { "X-User-Id": process.env.ZAI_USER_ID } : {}),
    },
    body: JSON.stringify({
      model,
      messages: req.messages,
      thinking: { type: "disabled" },
    }),
    signal: req.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ProviderError(
      classifyError({ message: `${res.status} ${text.slice(0, 200)}` }),
      `Marq GLM call failed: ${res.status} ${text.slice(0, 200)}`,
      provider.name,
    );
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  return {
    content,
    model: data?.model ?? model,
    latencyMs: Date.now() - start,
    tokensUsed: data?.usage?.total_tokens,
  };
}

/**
 * Call any OpenAI-compatible chat completions endpoint.
 * Used for OpenAI itself + any custom OpenAI-compatible provider.
 */
async function callOpenAICompatible(
  provider: Provider,
  req: ProviderChatRequest,
  model: string,
  start: number,
): Promise<ProviderChatResult> {
  const endpoint = provider.apiEndpoint || "https://api.openai.com/v1/chat/completions";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: req.messages,
    }),
    signal: req.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ProviderError(
      classifyError({ message: `${res.status} ${text.slice(0, 200)}` }),
      `OpenAI-compatible call failed: ${res.status} ${text.slice(0, 200)}`,
      provider.name,
    );
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  return {
    content,
    model: data?.model ?? model,
    latencyMs: Date.now() - start,
    tokensUsed: data?.usage?.total_tokens,
  };
}

/**
 * Call Google Gemini's generateContent endpoint.
 */
async function callGemini(
  provider: Provider,
  req: ProviderChatRequest,
  model: string,
  start: number,
): Promise<ProviderChatResult> {
  const base = (provider.apiEndpoint || "https://generativelanguage.googleapis.com/v1beta/models").replace(/\/$/, "");
  const endpoint = `${base}/${model}:generateContent?key=${provider.apiKey}`;

  // Map OpenAI-style messages → Gemini's contents[] format.
  const systemMsg = req.messages.find((m) => m.role === "system");
  const contents = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {}),
      contents,
    }),
    signal: req.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ProviderError(
      classifyError({ message: `${res.status} ${text.slice(0, 200)}` }),
      `Gemini call failed: ${res.status} ${text.slice(0, 200)}`,
      provider.name,
    );
  }

  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") ?? "";
  return {
    content,
    model,
    latencyMs: Date.now() - start,
    tokensUsed: data?.usageMetadata?.totalTokenCount,
  };
}

/**
 * Call Anthropic Claude's messages endpoint.
 */
async function callClaude(
  provider: Provider,
  req: ProviderChatRequest,
  model: string,
  start: number,
): Promise<ProviderChatResult> {
  const endpoint = provider.apiEndpoint || "https://api.anthropic.com/v1/messages";
  const systemMsg = req.messages.find((m) => m.role === "system");
  const convoMessages = req.messages.filter((m) => m.role !== "system");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      messages: convoMessages,
    }),
    signal: req.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ProviderError(
      classifyError({ message: `${res.status} ${text.slice(0, 200)}` }),
      `Claude call failed: ${res.status} ${text.slice(0, 200)}`,
      provider.name,
    );
  }

  const data = await res.json();
  const content = data?.content?.map((c: { text?: string }) => c.text).join("") ?? "";
  return {
    content,
    model: data?.model ?? model,
    latencyMs: Date.now() - start,
    tokensUsed: data?.usage?.input_tokens + (data?.usage?.output_tokens ?? 0),
  };
}

function personaFor(name: string): string {
  switch (name) {
    case "openai":
      return "You are Marq-OpenAI, a precise and concise assistant. Answer clearly with structured points when helpful. Keep responses focused and friendly.";
    case "gemini":
      return "You are Marq-Gemini, an analytical assistant who excels at multi-step reasoning and grounded explanations. Cite assumptions and break down problems step by step.";
    case "claude":
      return "You are Marq-Claude, a thoughtful assistant who writes in a warm, careful tone and prioritizes safety, nuance, and balanced perspectives.";
    case "grok":
      return "You are Marq-Grok, a witty and irreverent assistant with real-time awareness. You cut through jargon, prefer plain talk, and aren't afraid to call out a bad idea.";
    case "huggingface":
      return "You are Marq-HuggingFace, an open-source ML specialist. You know the model zoo inside out and recommend the right open model for the job.";
    case "ollama":
      return "You are Marq-Ollama, a local-first assistant running on the user's own hardware. You prioritize privacy, offline use, and lightweight models that fit on a laptop.";
    case "replit":
      return "You are Marq-Replit, a collaborative coding assistant tuned for cloud IDE workflows. You explain code in context and suggest runnable snippets.";
    case "modal":
      return "You are Marq-Modal, a serverless-inference specialist. You help users package models into scalable endpoints and reason about cold-start vs. throughput tradeoffs.";
    case "gradio":
      return "You are Marq-Gradio, an ML demo specialist. You help users build interactive UIs for models and trace issues back to the underlying Space.";
    case "mlflow":
      return "You are Marq-MLflow, an MLOps specialist. You track experiments, compare runs, and reason about model lineage, metrics, and deployment targets.";
    case "crewai":
      return "You are Marq-CrewAI, a multi-agent orchestrator. You decompose goals across role-based agents and synthesize their outputs into a single coherent answer.";
    case "langchain":
      return "You are Marq-LangChain, a chains-and-tools specialist. You compose prompts, retrievers, and tools into reproducible pipelines.";
    case "qvac":
      return "You are Marq-Qvac, a quantum-inspired reasoning assistant. You explore multiple solution paths in parallel and recommend the most defensible one.";
    case "marq_glm":
      return "You are Marq GLM, powered by GLM-4-Plus. You give clear, accurate, and helpful answers to any question. You are the default real-LLM provider for the Marq platform when ZAI_TOKEN is configured.";
    default:
      return "You are Marq AI, a helpful unified assistant.";
  }
}

export function defaultModelFor(providerName: string): string {
  switch (providerName) {
    case "openai": return "gpt-4o-mini";
    case "gemini": return "gemini-2.0-flash";
    case "claude": return "claude-3-5-sonnet";
    case "grok": return "grok-2";
    case "huggingface": return "meta-llama/Llama-3.1-8B-Instruct";
    case "ollama": return "llama3.1";
    case "replit": return "replit-code-v1_5-3b";
    case "modal": return "marq-modal-default";
    case "gradio": return "marq-gradio-default";
    case "mlflow": return "marq-mlflow-default";
    case "crewai": return "marq-crewai-orchestrator";
    case "langchain": return "marq-langchain-default";
    case "qvac": return "marq-qvac-default";
    case "marq_glm": return "glm-4-plus";
    default: return "marq-default";
  }
}
