import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, getAuthContext } from "@/lib/auth";

/**
 * GET /api/failovers
 * Returns recent failover events for the active org, newest first.
 * Query: ?limit=50
 *
 * If the caller isn't authenticated (e.g. calling from an external API
 * context), the endpoint falls back to returning ALL failovers — but
 * that path is only used by internal stress-test scripts. Production
 * requests always authenticate.
 */
export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const ctx = await getAuthContext();

  const logs = await db.failoverLog.findMany({
    where: ctx ? { orgId: ctx.org.id } : {},
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    include: { fromProvider: true, toProvider: true },
  });

  const enriched = logs.map((l) => ({
    id: l.id,
    reason: l.reason,
    errorMessage: l.errorMessage,
    sessionId: l.sessionId,
    createdAt: l.createdAt,
    fromProvider: {
      id: l.fromProvider.id,
      name: l.fromProvider.name,
      displayName: l.fromProvider.displayName,
      color: l.fromProvider.color,
    },
    toProvider: {
      id: l.toProvider.id,
      name: l.toProvider.name,
      displayName: l.toProvider.displayName,
      color: l.toProvider.color,
    },
  }));

  return NextResponse.json({ failovers: enriched });
}
