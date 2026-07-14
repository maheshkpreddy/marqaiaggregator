/**
 * Gemini API client — server-side only.
 *
 * Why server-side only?
 *  1. The API key never reaches the browser (security).
 *  2. Vercel functions run in `iad1` (US East), which is on Google's
 *     supported region list. Calls from a user's browser in a restricted
 *     region (e.g. India) would fail with `User location is not supported`.
 */

export const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiMessage {
  role: "user" | "model";
  content: string;
}

export interface GeminiModel {
  name: string; // e.g. "gemini-2.5-flash"
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

/**
 * Streaming call to Gemini. Yields text chunks as they arrive.
 *
 * Implementation note: we use the SSE-style `streamGenerateContent`
 * endpoint with `alt=sse`. Each event is a JSON object with a `candidates`
 * array; we extract the text part and yield it.
 */
export async function* streamGemini(
  model: string,
  messages: GeminiMessage[],
  systemInstruction?: string,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const url = `${GEMINI_BASE_URL}/models/${model}:streamGenerateContent?alt=sse`;

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

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getApiKey(),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const errText = await res.text();
    let message = `Gemini API error (${res.status})`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson?.error?.message) {
        message = errJson.error.message;
      }
    } catch {
      if (errText.length > 0) message += `: ${errText.slice(0, 200)}`;
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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

        try {
          const json = JSON.parse(payload);
          const parts = json?.candidates?.[0]?.content?.parts;
          if (Array.isArray(parts)) {
            for (const p of parts) {
              if (typeof p?.text === "string" && p.text.length > 0) {
                yield p.text;
              }
            }
          }
        } catch {
          // partial JSON — ignore, will be retried with more data
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Non-streaming call to Gemini. Returns the full text response.
 */
export async function completeGemini(
  model: string,
  messages: GeminiMessage[],
  systemInstruction?: string,
  signal?: AbortSignal
): Promise<string> {
  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent`;

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

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getApiKey(),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    let message = `Gemini API error (${res.status})`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson?.error?.message) {
        message = errJson.error.message;
      }
    } catch {
      if (errText.length > 0) message += `: ${errText.slice(0, 200)}`;
    }
    throw new Error(message);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts
    .map((p: { text?: string }) => p?.text ?? "")
    .join("");
}
