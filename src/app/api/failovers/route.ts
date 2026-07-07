import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/failovers
 * Returns recent failover events, newest first.
 * Query: ?limit=50
 */
export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const logs = await db.failoverLog.findMany({
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
