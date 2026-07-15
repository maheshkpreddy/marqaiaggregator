/**
 * Gemini API client — server-side only.
 *
 * Why server-side only?
 *  1. The API key never reaches the browser (security).
 *  2. Vercel functions run in `iad1` (US East), which is on Google's
 *     supported region list. Calls from a user's browser in a restricted
 *     region (e.g. India) would fail with `User location is not supported`.
 *
 * Reliability:
 *  - All requests to Gemini are wrapped with retry + exponential backoff.
 *  - Transient errors (503 "high demand", 429 rate-limit, 5xx) are retried up
 *    to MAX_RETRIES times.
 *  - If a model keeps failing after retries, we fall back to its paired
 *    model (e.g. gemini-pro-latest → gemini-flash-latest) so the user sees
 *    a response instead of a wall of error text.
 */

export const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiMessage {
  role: "user" | "model";
  content: string;
}

export interface GeminiModel {
  name: string; // e.g. "gemini-flash-latest"
  displayName: string;
  description: string;
  contextWindow: number;
}

/**
 * Curated shortlist of models we expose in the UI.
 *
 * Note on model aliases: we use Google's `-latest` aliases
 * (`gemini-flash-latest`, `gemini-pro-latest`) instead of pinned
 * version numbers. These auto-upgrade to the newest stable generation,
 * so the app keeps working when Google deprecates older versions
 * (e.g. `gemini-2.5-flash` is "no longer available to new users" as of
 * mid-2026, but `gemini-flash-latest` resolves to the current replacement).
 *
 * Both aliases are v1beta-only.
 */
export const CURATED_MODELS: GeminiModel[] = [
  {
    name: "gemini-flash-latest",
    displayName: "Gemini Flash (latest)",
    description:
      "Auto-updates to the newest Flash generation. Best price-performance.",
    contextWindow: 1_048_576,
  },
  {
    name: "gemini-pro-latest",
    displayName: "Gemini Pro (latest)",
    description:
      "Auto-updates to the newest Pro generation. Strongest reasoning.",
    contextWindow: 2_097_152,
  },
];

/**
 * Failover map — if a model fails after all retries, try this one next.
 * Pro is heavier and more likely to hit "high demand" errors; Flash is
 * cheaper and rarely overloaded. Flash itself has no lighter peer, so it
 * only retries.
 */
const FAILOVER_MAP: Record<string, string> = {
  "gemini-pro-latest": "gemini-flash-latest",
};

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 800;

/**
 * Errors Gemini surfaces when a model is overloaded / rate-limited.
 * These are transient — retrying after a short backoff usually works.
 */
function isTransientError(status: number, message: string): boolean {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const lower = message.toLowerCase();
  return (
    lower.includes("high demand") ||
    lower.includes("overloaded") ||
    lower.includes("try again later") ||
    lower.includes("rate limit") ||
    lower.includes("temporarily") ||
    lower.includes("capacity") ||
    lower.includes("unavailable")
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

export function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (local dev) or to your Vercel project's Environment Variables."
    );
  }
  return key;
}

/**
 * Convert our simple chat history into the Gemini `contents` array.
 * Gemini's `contents` expects alternating user/model turns starting with user.
 * We also prepend an optional system instruction.
 */
export function toGeminiContents(messages: GeminiMessage[]) {
  // Drop any leading model messages — Gemini rejects "model first".
  let sliced = [...messages];
  while (sliced.length > 0 && sliced[0].role !== "user") {
    sliced = sliced.slice(1);
  }
  // Merge consecutive same-role messages (Gemini strictly alternates).
  const merged: GeminiMessage[] = [];
  for (const msg of sliced) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      last.content += "\n\n" + msg.content;
    } else {
      merged.push({ ...msg });
    }
  }
  return merged.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));
}

interface GeminiError extends Error {
  status?: number;
  transient?: boolean;
}

async function readGeminiError(res: Response): Promise<GeminiError> {
  const errText = await res.text().catch(() => "");
  let message = `Gemini API error (${res.status})`;
  try {
    const errJson = JSON.parse(errText);
    if (errJson?.error?.message) {
      message = errJson.error.message;
    }
  } catch {
    if (errText.length > 0) message += `: ${errText.slice(0, 200)}`;
  }
  const err: GeminiError = new Error(message);
  err.status = res.status;
  err.transient = isTransientError(res.status, message);
  return err;
}

/**
 * Build the request body for a Gemini generateContent call.
 */
function buildRequestBody(
  messages: GeminiMessage[],
  systemInstruction?: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  };
  if (systemInstruction && systemInstruction.trim().length > 0) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }
  return body;
}

/**
 * Streaming call to Gemini. Yields text chunks as they arrive.
 *
 * Reliability:
 *  - Retries on transient errors (503 "high demand", 429, 5xx) with
 *    exponential backoff (800ms → 1.6s → 3.2s).
 *  - If the primary model keeps failing, falls back to its paired model
 *    (e.g. gemini-pro-latest → gemini-flash-latest).
 *  - Returns metadata about which model actually served the response via
 *    the optional `onModelUsed` callback (useful for surfacing failover
 *    in the UI).
 */
export async function* streamGemini(
  model: string,
  messages: GeminiMessage[],
  systemInstruction?: string,
  signal?: AbortSignal,
  onModelUsed?: (m: string) => void
): AsyncGenerator<string, void, unknown> {
  const tryModels = [model];
  const failover = FAILOVER_MAP[model];
  if (failover && !tryModels.includes(failover)) {
    tryModels.push(failover);
  }

  let lastErr: Error | null = null;

  for (const attemptModel of tryModels) {
    let attempt = 0;
    let success = false;
    while (attempt <= MAX_RETRIES) {
      try {
        const url = `${GEMINI_BASE_URL}/models/${attemptModel}:streamGenerateContent?alt=sse`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": getApiKey(),
          },
          body: JSON.stringify(buildRequestBody(messages, systemInstruction)),
          signal,
        });

        if (!res.ok || !res.body) {
          const err = await readGeminiError(res);
          // If non-transient (e.g. 400 bad request), don't retry — surface immediately.
          if (!err.transient) {
            throw err;
          }
          lastErr = err;
          attempt++;
          if (attempt > MAX_RETRIES) break;
          await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1), signal);
          continue;
        }

        // Stream is open. Notify caller which model is serving.
        onModelUsed?.(attemptModel);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let yieldedAny = false;
        let blockReason: string | null = null;
        let finishReason: string | null = null;
        let inlineErrorMessage: string | null = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // SSE events are separated by double newlines.
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? ""; // keep the (possibly partial) tail

            for (const evt of events) {
              const line = evt.trim();
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;

              let json: any;
              try {
                json = JSON.parse(payload);
              } catch {
                // partial JSON — ignore, will be retried with more data
                continue;
              }

              // Check for inline error (Gemini sometimes returns errors inside SSE).
              if (json?.error?.message) {
                inlineErrorMessage = json.error.message as string;
                const code = (json.error.code ?? 503) as number;
                const inlineErr: GeminiError = new Error(inlineErrorMessage);
                inlineErr.status = code;
                inlineErr.transient = isTransientError(code, inlineErrorMessage);
                throw inlineErr;
              }

              // Capture block / finish reasons — if Gemini blocks the response
              // (safety filter, recitation, etc.), the stream will end with
              // no text content. We need to surface a clear error in that case.
              if (json?.promptFeedback?.blockReason) {
                blockReason = json.promptFeedback.blockReason as string;
              }
              const candidate = json?.candidates?.[0];
              if (candidate?.finishReason && candidate.finishReason !== "STOP") {
                finishReason = candidate.finishReason as string;
              }

              const parts = candidate?.content?.parts;
              if (Array.isArray(parts)) {
                for (const p of parts) {
                  if (typeof p?.text === "string" && p.text.length > 0) {
                    yieldedAny = true;
                    yield p.text;
                  }
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // If we got nothing and there's a block/finish reason, throw a clear
        // error so the route surfaces it instead of an empty stream.
        if (!yieldedAny) {
          let reason = "Gemini returned an empty response";
          if (inlineErrorMessage) {
            reason = inlineErrorMessage;
          } else if (blockReason) {
            reason = `Gemini blocked the response (promptFeedback.blockReason: ${blockReason}). Try rephrasing your message.`;
          } else if (finishReason) {
            reason = `Gemini stopped early (finishReason: ${finishReason}). Try rephrasing or shortening your message.`;
          } else {
            reason += " — no text was generated. Try rephrasing your message or switching models.";
          }
          const emptyErr: GeminiError = new Error(reason);
          emptyErr.transient = false;
          throw emptyErr;
        }

        success = true;
        break; // streaming completed without throwing
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw err; // client cancelled — don't retry.
        }
        lastErr = err instanceof Error ? err : new Error(String(err));
        const transient = (lastErr as GeminiError).transient ?? false;
        if (!transient) {
          // Non-transient (e.g. 400 bad request, invalid API key, safety block)
          // — bubble up.
          throw lastErr;
        }
        attempt++;
        if (attempt > MAX_RETRIES) break;
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1), signal);
      }
    }
    if (success) return;
    // Otherwise try the failover model (if any).
  }

  // All retries + failover exhausted.
  throw lastErr ?? new Error("Gemini API request failed after multiple retries.");
}

/**
 * Non-streaming call to Gemini. Returns the full text response.
 *
 * Same retry + failover semantics as `streamGemini`.
 */
export async function completeGemini(
  model: string,
  messages: GeminiMessage[],
  systemInstruction?: string,
  signal?: AbortSignal,
  onModelUsed?: (m: string) => void
): Promise<string> {
  const tryModels = [model];
  const failover = FAILOVER_MAP[model];
  if (failover && !tryModels.includes(failover)) {
    tryModels.push(failover);
  }

  let lastErr: Error | null = null;

  for (const attemptModel of tryModels) {
    let attempt = 0;
    while (attempt <= MAX_RETRIES) {
      try {
        const url = `${GEMINI_BASE_URL}/models/${attemptModel}:generateContent`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": getApiKey(),
          },
          body: JSON.stringify(buildRequestBody(messages, systemInstruction)),
          signal,
        });

        if (!res.ok) {
          const err = await readGeminiError(res);
          if (!err.transient) throw err;
          lastErr = err;
          attempt++;
          if (attempt > MAX_RETRIES) break;
          await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1), signal);
          continue;
        }

        const data = await res.json();

        // Inline error (e.g. safety filter)
        if (data?.error?.message) {
          const inlineErr: GeminiError = new Error(data.error.message);
          inlineErr.transient = isTransientError(
            data.error.code ?? 503,
            data.error.message
          );
          if (inlineErr.transient) {
            lastErr = inlineErr;
            attempt++;
            if (attempt > MAX_RETRIES) break;
            await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1), signal);
            continue;
          }
          throw inlineErr;
        }

        onModelUsed?.(attemptModel);

        const parts = data?.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) {
          return "";
        }
        return parts
          .map((p: { text?: string }) => p?.text ?? "")
          .join("");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw err;
        }
        lastErr = err instanceof Error ? err : new Error(String(err));
        const transient = (lastErr as GeminiError).transient ?? false;
        if (!transient) throw lastErr;
        attempt++;
        if (attempt > MAX_RETRIES) break;
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1), signal);
      }
    }
  }

  throw lastErr ?? new Error("Gemini API request failed after multiple retries.");
}
