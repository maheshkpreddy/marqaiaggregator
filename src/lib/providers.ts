/**
 * Marq AI Aggregator - Provider Registry & Adapters
 *
 * Each provider has a unified interface `chat()` that returns a streamed-or-final response.
 * In production, you'd add real OpenAI/Gemini/Claude SDK calls here.
 * In demo mode (no API key configured), we route through z-ai-web-dev-sdk and
 * simulate per-provider latency / failure behavior so the failover engine is exercised.
 */

import type { Provider } from "@prisma/client";

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
 * Demo mode adapter: uses z-ai-web-dev-sdk under the hood.
 *
 * In production with real API keys set, you would swap this for direct
 * fetch() calls to OpenAI / Gemini / Claude endpoints. The interface stays
 * the same — only the body of this function changes.
 */
export async function callProvider(
  provider: Provider,
  req: ProviderChatRequest,
): Promise<ProviderChatResult> {
  const start = Date.now();

  // Demo behavior — only triggers when there is no real API key.
  // This lets the user explore failover in the sandbox without real keys.
  if (!provider.apiKey) {
    return demoModeCall(provider, req, start);
  }

  // Real provider dispatch. Each branch can be filled in with the official
  // SDK or direct REST calls. For now, we still route through z-ai-web-dev-sdk
  // so the platform works end-to-end; you can replace these branches with
  // real SDK calls when ready.
  return realModeCall(provider, req, start);
}

/**
 * Demo-mode call: routes through z-ai-web-dev-sdk with simulated per-provider
 * personality, latency, and a small probability of failure so the failover
 * engine actually gets exercised.
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

  // Dynamic import to keep client bundle clean.
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  // Build a per-provider "persona" so responses feel distinct.
  const persona = personaFor(provider.name);
  const messages = [
    { role: "assistant" as const, content: persona },
    ...req.messages,
  ];

  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: "disabled" },
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const latencyMs = Date.now() - start;

  return {
    content,
    model: req.model || defaultModelFor(provider.name),
    latencyMs,
    tokensUsed: Math.ceil(content.length / 4),
  };
}

/**
 * Real-mode call: when an API key is configured, this is where you'd dispatch
 * to the real provider SDK. For now it still routes through z-ai-web-dev-sdk
 * so the platform runs end-to-end in the sandbox, but the structure is here
 * for you to swap in real calls.
 */
async function realModeCall(
  provider: Provider,
  req: ProviderChatRequest,
  start: number,
): Promise<ProviderChatResult> {
  // Example for OpenAI (sketch):
  //   const res = await fetch("https://api.openai.com/v1/chat/completions", {
  //     method: "POST",
  //     headers: { Authorization: `Bearer ${provider.apiKey}` },
  //     body: JSON.stringify({ model: req.model, messages: req.messages }),
  //     signal: req.signal,
  //   });
  //   if (!res.ok) throw new ProviderError(...);
  //   const data = await res.json();
  //   return { content: data.choices[0].message.content, ... };

  // For sandbox continuity, fall back to demo behavior even when a key is set,
  // but skip the simulated failure so real-key usage feels reliable.
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const persona = personaFor(provider.name);
  const completion = await zai.chat.completions.create({
    messages: [{ role: "assistant", content: persona }, ...req.messages],
    thinking: { type: "disabled" },
  });
  const content = completion.choices[0]?.message?.content ?? "";
  return {
    content,
    model: req.model || defaultModelFor(provider.name),
    latencyMs: Date.now() - start,
    tokensUsed: Math.ceil(content.length / 4),
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
