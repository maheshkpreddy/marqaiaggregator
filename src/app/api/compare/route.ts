import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { callProvider } from "@/lib/providers";
import type { ChatMessage } from "@/lib/providers";

/**
 * POST /api/compare
 * Body:
 *   prompt: string                  — the prompt to run across all selected providers
 *   providerIds?: string[]          — explicit list (defaults to all active providers)
 *   systemPrompt?: string           — optional system prompt prepended to all runs
 *   save?: boolean                  — if true, persists a ComparisonRun row (default true)
 *
 * Runs the SAME prompt against each provider in parallel (no failover —
 * we want each provider's raw output for comparison). Returns one result
 * per provider: { providerId, displayName, color, content, model, latencyMs,
 * tokensUsed, error? }.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { prompt, providerIds, systemPrompt, save } = body ?? {};

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 1) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  let providers = await db.provider.findMany({
    where: { active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  if (Array.isArray(providerIds) && providerIds.length > 0) {
    const idSet = new Set(providerIds as string[]);
    providers = providers.filter((p) => idSet.has(p.id));
  }
  if (providers.length < 2) {
    return NextResponse.json({ error: "Select at least 2 providers to compare" }, { status: 400 });
  }

  const messages: ChatMessage[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  // Run all providers in parallel. Each runs with a 25s timeout.
  const results = await Promise.all(
    providers.map(async (p) => {
      const start = Date.now();
      try {
        const result = await withTimeout(callProvider(p, { messages }), 25000);
        return {
          providerId: p.id,
          name: p.name,
          displayName: p.displayName,
          color: p.color,
          icon: p.icon,
          content: result.content,
          model: result.model,
          latencyMs: Date.now() - start,
          tokensUsed: result.tokensUsed ?? null,
          error: null,
        };
      } catch (err) {
        return {
          providerId: p.id,
          name: p.name,
          displayName: p.displayName,
          color: p.color,
          icon: p.icon,
          content: null,
          model: null,
          latencyMs: Date.now() - start,
          tokensUsed: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  // Persist the run for history (unless caller disabled it).
  if (save !== false) {
    try {
      await db.comparisonRun.create({
        data: {
          orgId: ctx.org.id,
          prompt,
          providerIds: JSON.stringify(providers.map((p) => p.id)),
          results: JSON.stringify(results),
        },
      });
    } catch { /* ignore DB errors */ }
  }

  return NextResponse.json({
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
