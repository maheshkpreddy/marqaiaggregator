import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authApiKey } from "@/lib/auth";
import { callProvider } from "@/lib/providers";
import type { ChatMessage } from "@/lib/providers";

/**
 * POST /api/v1/compare
 *
 * Runs the same prompt across multiple providers in parallel and returns
 * all results side-by-side. This endpoint does NOT use failover — each
 * provider returns its raw output (or error) so you can compare models.
 *
 * Body:
 *   prompt: string
 *   providers?: string[]    — provider names (default: all active)
 *   system_prompt?: string
 */
export async function POST(req: NextRequest) {
  const auth = await authApiKey(req, "compare");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const { prompt, providers: providerNames, system_prompt } = body ?? {};

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  let providers = await db.provider.findMany({
    where: { active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  if (Array.isArray(providerNames) && providerNames.length > 0) {
    const set = new Set(providerNames as string[]);
    providers = providers.filter((p) => set.has(p.name));
  }
  if (providers.length < 2) {
    return NextResponse.json({ error: "Select at least 2 providers" }, { status: 400 });
  }

  const messages: ChatMessage[] = [];
  if (system_prompt) messages.push({ role: "system", content: system_prompt });
  messages.push({ role: "user", content: prompt });

  const results = await Promise.all(
    providers.map(async (p) => {
      const start = Date.now();
      try {
        const result = await withTimeout(callProvider(p, { messages }), 25000);
        return {
          provider: p.name,
          displayName: p.displayName,
          model: result.model,
          content: result.content,
          latencyMs: Date.now() - start,
          tokensUsed: result.tokensUsed ?? null,
          error: null,
        };
      } catch (err) {
        return {
          provider: p.name,
          displayName: p.displayName,
          model: null,
          content: null,
          latencyMs: Date.now() - start,
          tokensUsed: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  // Persist the run for org history.
  await db.comparisonRun.create({
    data: {
      orgId: auth.orgId,
      prompt,
      providerIds: JSON.stringify(providers.map((p) => p.id)),
      results: JSON.stringify(results),
    },
  }).catch(() => {});

  return NextResponse.json({
    object: "marq.compare",
    prompt,
    results,
    createdAt: new Date().toISOString(),
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
