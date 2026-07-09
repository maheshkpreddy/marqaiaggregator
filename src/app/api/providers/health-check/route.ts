import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callProvider, type ChatMessage } from "@/lib/providers";
import { getAuthContext } from "@/lib/auth";

/**
 * POST /api/providers/health-check
 *
 * Proactively pings every active provider with a tiny "ping" message and
 * records a fresh HealthLog row for each. This clears stale "down" errors
 * from the UI — after this runs, the Providers tab reflects the CURRENT
 * state of each provider rather than the last chat-attempt's outcome.
 *
 * In demo mode (no API key), this always succeeds (except for the small
 * simulated failure rate). In real mode (API key set), this makes a real
 * 1-token call to the provider's API.
 *
 * Also cleans up HealthLog rows older than 7 days to keep the table from
 * growing unboundedly.
 */
export async function POST() {
  const ctx = await getAuthContext();
  // Allow unauthenticated health checks so the demo works without login,
  // but mark the response accordingly.
  void ctx;

  const providers = await db.provider.findMany({
    where: { active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  if (providers.length === 0) {
    return NextResponse.json({ error: "No active providers configured." }, { status: 404 });
  }

  const pingMessages: ChatMessage[] = [
    { role: "user", content: "ping" },
  ];

  // Run all health checks in parallel for speed.
  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      const start = Date.now();
      try {
        const result = await callProvider(provider, {
          messages: pingMessages,
          // Use the provider's first model so real-mode calls have a valid model name.
          model: (() => {
            try { return JSON.parse(provider.models)[0] ?? undefined; } catch { return undefined; }
          })(),
        });

        await db.healthLog.create({
          data: {
            providerId: provider.id,
            status: "healthy",
            latencyMs: result.latencyMs,
          },
        }).catch(() => {/* ignore db logging errors */});

        return {
          providerId: provider.id,
          name: provider.name,
          displayName: provider.displayName,
          status: "healthy" as const,
          latencyMs: result.latencyMs,
          error: null,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await db.healthLog.create({
          data: {
            providerId: provider.id,
            status: "down",
            error: errorMessage.slice(0, 500),
            latencyMs: Date.now() - start,
          },
        }).catch(() => {/* ignore db logging errors */});

        return {
          providerId: provider.id,
          name: provider.name,
          displayName: provider.displayName,
          status: "down" as const,
          latencyMs: Date.now() - start,
          error: errorMessage,
        };
      }
    }),
  );

  // Clean up health logs older than 7 days to keep the table bounded.
  // Run in the background — don't block the response.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  db.healthLog.deleteMany({ where: { checkedAt: { lt: sevenDaysAgo } } })
    .catch(() => {/* ignore cleanup errors */});

  const checked = results.map((r) =>
    r.status === "fulfilled" ? r.value : {
      providerId: "unknown",
      name: "unknown",
      displayName: "unknown",
      status: "down" as const,
      latencyMs: 0,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    },
  );

  const healthy = checked.filter((c) => c.status === "healthy").length;
  const down = checked.filter((c) => c.status === "down").length;

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    total: checked.length,
    healthy,
    down,
    results: checked,
  });
}
