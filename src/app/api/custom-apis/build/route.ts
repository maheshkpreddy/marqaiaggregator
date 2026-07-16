import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { runWithFailover } from "@/lib/failover";
import {
  reorderProvidersOpenSourceFirst,
  providerTier,
  hasEffectiveApiKey,
  type ChatMessage,
} from "@/lib/providers";

/**
 * POST /api/custom-apis/build
 *
 * Analyzes a natural-language requirement and suggests a small, ordered
 * chain of providers (open-source first, paid as fallback) that together
 * guarantee the requirement is met with minimal failover.
 *
 * Body:
 *   requirement: string  — e.g. "I need a fast chat API for a customer
 *                          support bot. Must be reliable, low-latency,
 *                          and free if possible."
 *   maxProviders?: number — default 4, max 6
 *
 * Returns:
 *   {
 *     providers: [{ id, name, displayName, tier, hasKey, rationale }],
 *     overallRationale: string,
 *     suggestedName: string,
 *     openSourceFirst: true
 *   }
 *
 * The AI picks providers by reasoning over the provider catalog. It
 * ALWAYS prefers open-source/free providers first (marq_free, HuggingFace,
 * Ollama) because they don't require API keys and never hit billing/quota
 * issues — which is the #1 cause of failovers. Paid providers (OpenAI,
 * Gemini, Claude) are included only as paid fallback, and ONLY if the
 * user's requirement explicitly demands a capability that free providers
 * can't deliver (e.g., GPT-4o vision, Claude 200K context).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  const ctx = await requireRole("admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { requirement } = body ?? {};
  const maxProviders = Math.min(
    Math.max(typeof body?.maxProviders === "number" ? body.maxProviders : 4, 2),
    6
  );

  if (!requirement || typeof requirement !== "string" || requirement.trim().length < 10) {
    return NextResponse.json(
      { error: "requirement must be at least 10 characters" },
      { status: 400 }
    );
  }

  // ── Load all active providers with their live-key status ──
  const allProviders = await db.provider.findMany({
    where: { active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  if (allProviders.length === 0) {
    return NextResponse.json(
      { error: "No active providers configured" },
      { status: 503 }
    );
  }

  // ── Build a compact catalog for the AI to reason over ──
  // We include: name, displayName, tier, hasKey (live vs demo), models,
  // and a short description. This keeps the prompt small enough to fit
  // in any model's context window.
  const catalog = allProviders.map((p) => {
    const tier = providerTier(p);
    const hasKey = hasEffectiveApiKey(p);
    let models: string[] = [];
    try {
      models = JSON.parse(p.models);
    } catch {}
    return {
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      tier,
      hasKey,
      models: models.slice(0, 3), // keep compact
      description: (p.description ?? "").slice(0, 120),
    };
  });

  const openSourceCount = catalog.filter((p) => p.tier === "open_source").length;
  const paidWithKeyCount = catalog.filter(
    (p) => p.tier === "paid" && p.hasKey
  ).length;

  // ── Build the AI prompt ──
  const systemPrompt = `You are Marq AI's provider selection assistant. Your job is to pick a SMALL, ordered chain of 2-${maxProviders} AI providers from the platform's catalog that best satisfies the user's requirement.

CRITICAL RULES (non-negotiable):
1. OPEN-SOURCE FIRST: Always prefer providers with tier "open_source". These are free, don't require API keys, and never hit billing/quota issues — which eliminates the #1 cause of failovers.
2. PAID AS FALLBACK: Include paid providers ONLY as the last 1-2 entries in the chain, and ONLY if they have hasKey=true (a real API key is configured). Skip paid providers with hasKey=false — they're demo-only and will be skipped by the failover engine anyway.
3. MINIMAL CHAIN: Pick the FEWEST providers that satisfy the requirement. A chain of 2-3 live providers is better than 6 providers. The goal is fast, reliable output — not maximum coverage.
4. ORDER: Index 0 is the primary (tried first). Order by: open-source live → open-source demo → paid live. Never put a paid provider first if an open-source one can do the job.
5. GUARANTEED AVAILABILITY: Always include "marq_free" (Pollinations.ai) as the LAST entry in the chain if it's available — it's the platform's guaranteed-availability safety net.

Return STRICT JSON only (no markdown, no explanation outside JSON):
{
  "providers": [
    { "id": "<providerId>", "rationale": "<one sentence why this provider, at this position>" }
  ],
  "overallRationale": "<2-3 sentences explaining the overall selection strategy>",
  "suggestedName": "<short snake_case name for this custom API, e.g. 'support_bot_fast'>"
}`;

  const userPrompt = `## User's requirement
${requirement.trim()}

## Available providers catalog
${JSON.stringify(catalog, null, 2)}

## Summary
- ${catalog.length} active providers total
- ${openSourceCount} open-source (free, no key needed)
- ${paidWithKeyCount} paid providers with live API keys configured
- ${catalog.length - openSourceCount - paidWithKeyCount} paid providers in demo mode (no key — will be skipped)

Pick the best ${maxProviders} providers for this requirement, ordered by priority. Remember: open-source first, paid fallback only if needed, marq_free last.`;

  // ── Call the LLM via the existing failover engine ──
  // We use the platform's own failover to pick providers — meta!
  // This means the AI analysis itself benefits from open-source-first ordering.
  let providersForAnalysis = reorderProvidersOpenSourceFirst(allProviders);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let aiResponse: string;
  try {
    const outcome = await runWithFailover({
      providers: providersForAnalysis,
      messages,
      timeoutMs: 20000,
      enableDemoFallback: false, // we want a REAL AI response, not a demo canned text
    });
    aiResponse = outcome.result.content;
  } catch (err) {
    // If all real providers fail, fall back to a rule-based selection.
    aiResponse = "";
  }

  // ── Parse the AI response ──
  let selection: {
    providers: { id: string; rationale: string }[];
    overallRationale: string;
    suggestedName: string;
  } | null = null;

  if (aiResponse) {
    try {
      // Strip markdown code fences if present.
      const cleaned = aiResponse
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      selection = JSON.parse(cleaned);
    } catch {
      // AI returned non-JSON — fall through to rule-based selection.
    }
  }

  // ── Fallback: rule-based selection if AI didn't return valid JSON ──
  if (!selection || !Array.isArray(selection.providers) || selection.providers.length === 0) {
    selection = ruleBasedSelection(allProviders, requirement, maxProviders);
  }

  // ── Validate and enrich the selection ──
  const providerMap = new Map(allProviders.map((p) => [p.id, p]));
  const enrichedProviders: Array<{
    id: string;
    name: string;
    displayName: string;
    tier: "open_source" | "paid";
    hasKey: boolean;
    rationale: string;
  }> = [];

  const seenIds = new Set<string>();
  for (const pick of selection.providers) {
    if (seenIds.has(pick.id)) continue;
    const provider = providerMap.get(pick.id);
    if (!provider) continue;
    seenIds.add(pick.id);
    enrichedProviders.push({
      id: provider.id,
      name: provider.name,
      displayName: provider.displayName,
      tier: providerTier(provider),
      hasKey: hasEffectiveApiKey(provider),
      rationale: pick.rationale || "",
    });
    if (enrichedProviders.length >= maxProviders) break;
  }

  // Safety net: if the AI picked nothing valid, use rule-based.
  if (enrichedProviders.length === 0) {
    const fallback = ruleBasedSelection(allProviders, requirement, maxProviders);
    for (const pick of fallback.providers) {
      const provider = providerMap.get(pick.id);
      if (!provider) continue;
      enrichedProviders.push({
        id: provider.id,
        name: provider.name,
        displayName: provider.displayName,
        tier: providerTier(provider),
        hasKey: hasEffectiveApiKey(provider),
        rationale: pick.rationale,
      });
    }
    selection.overallRationale = fallback.overallRationale;
    selection.suggestedName = fallback.suggestedName;
  }

  return NextResponse.json({
    providers: enrichedProviders,
    overallRationale: selection.overallRationale,
    suggestedName: selection.suggestedName,
    openSourceFirst: true,
    maxProviders,
  });
}

/**
 * Rule-based fallback: picks providers deterministically when the AI
 * is unavailable. Strategy:
 *  1. marq_free (always first — guaranteed availability, free)
 *  2. Any other open-source provider with a live key (HuggingFace, etc.)
 *  3. Up to 2 paid providers with live keys (for capability fallback)
 *  4. marq_free again as the last safety net (if not already #1)
 */
function ruleBasedSelection(
  allProviders: Array<{
    id: string;
    name: string;
    displayName: string;
    priority: number;
  }>,
  requirement: string,
  maxProviders: number
): {
  providers: { id: string; rationale: string }[];
  overallRationale: string;
  suggestedName: string;
} {
  const reordered = reorderProvidersOpenSourceFirst(
    allProviders as Array<{ name: string }>
  ) as typeof allProviders;

  const picks: { id: string; rationale: string }[] = [];
  const req = requirement.toLowerCase();

  // 1. First open-source provider (marq_free if available)
  const firstOpen = reordered.find(
    (p) => providerTier(p) === "open_source"
  );
  if (firstOpen) {
    picks.push({
      id: firstOpen.id,
      rationale: "Primary open-source provider — free, no API key needed, always available.",
    });
  }

  // 2. A second open-source provider for diversity (if room)
  const secondOpen = reordered.find(
    (p) =>
      providerTier(p) === "open_source" &&
      p.id !== firstOpen?.id
  );
  if (secondOpen && picks.length < maxProviders - 1) {
    picks.push({
      id: secondOpen.id,
      rationale: "Secondary open-source provider — adds model diversity to the failover chain.",
    });
  }

  // 3. Paid providers with keys (for capability the free ones can't deliver)
  const paidProviders = reordered.filter(
    (p) =>
      providerTier(p) === "paid" &&
      hasEffectiveApiKey(p as any) &&
      !picks.some((pick) => pick.id === p.id)
  );
  for (const p of paidProviders.slice(0, maxProviders - picks.length - 1)) {
    picks.push({
      id: p.id,
      rationale: "Paid fallback — provides premium capability if free providers are insufficient.",
    });
  }

  // 4. marq_free as the absolute last safety net
  const marqFree = reordered.find((p) => p.name === "marq_free");
  if (
    marqFree &&
    !picks.some((pick) => pick.id === marqFree.id) &&
    picks.length < maxProviders
  ) {
    picks.push({
      id: marqFree.id,
      rationale: "Guaranteed-availability safety net — always responds, even if all other providers fail.",
    });
  }

  // Derive a name from the requirement
  const words = req
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3);
  const suggestedName = words.length > 0 ? words.join("_") : "custom_api";

  return {
    providers: picks.slice(0, maxProviders),
    overallRationale:
      "Rule-based selection: open-source providers first for free, reliable responses; paid providers as fallback for advanced capabilities; marq_free as the guaranteed-availability safety net.",
    suggestedName,
  };
}
