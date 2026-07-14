import { NextRequest } from "next/server";
import { streamGemini, GeminiMessage, CURATED_MODELS } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/gemini/chat
 *
 * Body: {
 *   model: string,                // e.g. "gemini-2.5-flash"
 *   messages: GeminiMessage[],    // [{ role: "user" | "model", content: string }]
 *   systemInstruction?: string,
 *   stream?: boolean              // default true
 * }
 *
 * Returns a text/plain streaming response when stream=true.
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

  const model = body.model ?? "gemini-2.5-flash";
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
      const text = await completeGemini(model, messages, systemInstruction);
      return new Response(
        JSON.stringify({ text, model, streaming: false }),
        { status: 200, headers: { "Content-Type": "application/json" } }
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
      try {
        for await (const chunk of streamGemini(
          model,
          messages,
          systemInstruction
        )) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown streaming error";
        // Send a final error sentinel that the client can detect.
        controller.enqueue(
          encoder.encode(`\n\n[STREAM_ERROR] ${message}`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no", // disable proxy buffering (Vercel respects this)
    },
  });
}
