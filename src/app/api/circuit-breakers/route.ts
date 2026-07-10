import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBreakerSnapshot, resetBreaker } from "@/lib/circuit-breaker";

/**
 * GET /api/circuit-breakers
 * Returns the current circuit-breaker state for every active provider,
 * along with the latest health log row for each.
 *
 * Authenticated: requires `member` role on the active org.
 *
 * Response shape:
 *   {
 *     providers: [
 *       {
 *         id, name, displayName,
 *         breaker: { status, failures, lastFailureAt, lastSuccessAt, openUntil, cooldownRemainingMs },
 *         health: { status, lastError, latencyMs, checkedAt } | null
 *       }
 *     ]
 *   }
 */
export async function GET(_req: NextRequest) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const providers = await db.provider.findMany({
    where: { active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  // Fetch the latest health log per provider in a single round-trip.
  // Prisma's `groupBy` won't give us the row contents, so we do a per-provider
  // findFirst with a take:1. With ~13 providers this is one batched query set
  // and is plenty fast.
  const latestHealths = await Promise.all(
    providers.map((p) =>
      db.healthLog.findFirst({
        where: { providerId: p.id },
        orderBy: { checkedAt: "desc" },
      }).catch(() => null),
    ),
  );

  const result = providers.map((p, idx) => {
    const latest = latestHealths[idx];
    return {
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      breaker: getBreakerSnapshot(p.id),
      health: latest
        ? {
            status: latest.status,
            lastError: latest.error ?? null,
            latencyMs: latest.latencyMs ?? null,
            checkedAt: latest.checkedAt,
          }
        : null,
    };
  });

  return NextResponse.json({ providers: result });
}

/**
 * POST /api/circuit-breakers
 * Reset one or all circuit breakers.
 *
 * Body:
 *   providerId?: string  — reset only this provider. If omitted, resets all.
 *
 * Use case: after fixing an API key or restarting a downstream service, the
 * user can manually clear the OPEN state so requests try the provider
 * immediately instead of waiting for the cooldown.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { providerId } = body ?? {};

  if (typeof providerId === "string") {
    resetBreaker(providerId);
    return NextResponse.json({ ok: true, reset: providerId });
  }

  // Reset all — re-fetch the list and reset each.
  const providers = await db.provider.findMany({
    where: { active: true },
    select: { id: true },
  });
  for (const p of providers) {
    resetBreaker(p.id);
  }
  return NextResponse.json({ ok: true, reset: "all", count: providers.length });
}
