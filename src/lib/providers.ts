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
 * If the provider has an API key configured (via the Providers tab in the UI),
 * we call the real provider API. Otherwise we fall back to demo mode, which
 * generates a canned-but-contextual response locally.
 */
export async function callProvider(
  provider: Provider,
  req: ProviderChatRequest,
): Promise<ProviderChatResult> {
  const start = Date.now();

  if (provider.apiKey) {
    return realModeCall(provider, req, start);
  }
  return demoModeCall(provider, req, start);
}

/**
 * Demo-mode call: generates a canned response locally.
 *
 * No external network call is made — the platform runs anywhere without any
 * API credentials. We simulate per-provider latency and a small failure rate
 * so the failover engine is exercised on first load.
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
  // Simulate a per-provider failure rate so the user can see failover work.
  // The "claude" provider is intentionally a bit flakier to make demos lively.
  const failRate = provider.name === "claude" ? 0.18 : provider.name === "gemini" ? 0.08 : 0.04;
  if (Math.random() < failRate) {
    const reasons: FailoverReason[] = ["timeout", "rate_limit", "server_error"];
    const reason = reasons[Math.floor(Math.random() * reasons.length)];
    throw new ProviderError(
      reason,
      `[demo] ${provider.displayName} simulated ${reason}`,
      provider.name,
    );
  }

  // Simulate per-provider latency (in ms).
  const baseLatency =
    provider.name === "openai" ? 350 :
    provider.name === "gemini" ? 500 :
    provider.name === "claude" ? 700 : 450;
  const jitter = Math.floor(Math.random() * 300);
  await new Promise((r) => setTimeout(r, baseLatency + jitter));

  const content = buildDemoResponse(provider, req);
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
        `> ⚠️ This is a simulated response. Add your OpenAI API key in the **Providers** tab to get real completions.`,
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
    default:
      // Treat unknown providers as OpenAI-compatible.
      return callOpenAICompatible(provider, req, model, start);
  }
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
    default:
      return "You are Marq AI, a helpful unified assistant.";
  }
}

export function defaultModelFor(providerName: string): string {
  switch (providerName) {
    case "openai": return "gpt-4o-mini";
    case "gemini": return "gemini-2.0-flash";
    case "claude": return "claude-3-5-sonnet";
    default: return "marq-default";
  }
}
