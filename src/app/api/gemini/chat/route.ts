import { NextRequest, NextResponse } from "next/server";
import { streamGemini, GeminiMessage, CURATED_MODELS } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// With retries + failover, a single request can take up to ~25s in the worst
// case (3 retries × 2 models × ~3s each + backoff). 60s gives us headroom.
// vercel.json must also allow this — it does for /api/gemini/chat.
export const maxDuration = 60;

/**
 * POST /api/gemini/chat
 *
 * Body: {
 *   model: string,                // e.g. "gemini-flash-latest"
 *   messages: GeminiMessage[],    // [{ role: "user" | "model", content: string }]
 *   systemInstruction?: string,
 *   stream?: boolean              // default true
 * }
 *
 * Returns a text/plain streaming response when stream=true.
 *   - If Gemini fails over from the primary model to a fallback model
 *     (e.g. gemini-pro-latest → gemini-flash-latest due to 503 overload),
 *     we send a `X-Gemini-Model-Used` header on the response AND a
 *     `[STREAM_INFO] fell back to <model>` sentinel at the very start of
 *     the stream so the client can surface a "fell back to Flash" notice.
 * Returns a JSON object when stream=false.
 */
export async function POST(req: NextRequest) {
  let body: {
    model?: string;
    messages?: GeminiMessage[];
    systemInstruction?: string;
    stream?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const model = body.model ?? "gemini-flash-latest";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const systemInstruction = body.systemInstruction;
  const doStream = body.stream !== false;

  // Validate model.
  if (!CURATED_MODELS.some((m) => m.name === model)) {
    return new Response(
      JSON.stringify({
        error: `Unsupported model "${model}". Available: ${CURATED_MODELS.map(
          (m) => m.name
        ).join(", ")}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate messages.
  if (messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages[] is required and must not be empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "model") {
      return new Response(
        JSON.stringify({
          error: `Invalid message role "${m.role}". Must be "user" or "model".`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (typeof m.content !== "string") {
      return new Response(
        JSON.stringify({ error: "Each message.content must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Non-streaming path.
  if (!doStream) {
    try {
      const { completeGemini } = await import("@/lib/gemini");
      let usedModel = model;
      const text = await completeGemini(
        model,
        messages,
        systemInstruction,
        undefined,
        (m) => {
          usedModel = m;
        }
      );
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (usedModel !== model) {
        headers["X-Gemini-Model-Used"] = usedModel;
      }
      return new Response(
        JSON.stringify({ text, model: usedModel, requestedModel: model, streaming: false }),
        { status: 200, headers }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Streaming path — send raw text chunks (no SSE framing, the client just
  // appends). Use a ReadableStream so we can pipe the async generator.
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let usedModel = model;
      let infoSent = false;
      try {
        for await (const chunk of streamGemini(
          model,
          messages,
          systemInstruction,
          undefined,
          (m) => {
            usedModel = m;
            // If we fell back to a different model, prepend an info sentinel
            // ONCE at the very start of the stream so the client can surface
            // a "fell back to <model>" notice.
            if (!infoSent && m !== model) {
              infoSent = true;
              controller.enqueue(
                encoder.encode(
                  `[STREAM_INFO] Primary model "${model}" was overloaded; fell back to "${m}".\n\n`
                )
              );
            }
          }
        )) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown streaming error";

        // If the error is a known "high demand" message, give the user a
        // friendlier explanation with a hint to retry or switch models.
        const lower = message.toLowerCase();
        let friendly = message;
        if (
          lower.includes("high demand") ||
          lower.includes("overloaded") ||
          lower.includes("try again later") ||
          lower.includes("capacity") ||
          lower.includes("unavailable")
        ) {
          friendly =
            "Gemini is currently overloaded on this model. I retried with backoff and tried the alternate model, but all attempts failed. Please try again in a minute — these spikes are usually very short.";
        }

        // Send a final error sentinel that the client can detect.
        controller.enqueue(
          encoder.encode(`\n\n[STREAM_ERROR] ${friendly}`)
        );
        controller.close();
      }
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no", // disable proxy buffering (Vercel respects this)
  };
  // We don't know usedModel until the stream starts, so we can't set it on
  // the initial response headers. The client reads the [STREAM_INFO] sentinel
  // instead.

  return new Response(stream, { status: 200, headers });
}

/**
 * GET handler — useful for quick health checks from the browser.
 * Returns the curated model list + a 200 if the route is alive.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    models: CURATED_MODELS,
    default: "gemini-flash-latest",
  });
}
