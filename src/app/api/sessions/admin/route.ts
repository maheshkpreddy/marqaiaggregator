import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

/**
 * GET /api/sessions/admin
 *
 * Org-owner-only endpoint that returns ALL chat sessions in the active org
 * — including soft-deleted ones — grouped by user. This is the "super admin
 * audit view": even when a user deletes a chat from their own sidebar, the
 * org owner can still see it here, organized user-wise.
 *
 * Returns:
 *   {
 *     users: [
 *       {
 *         userId, userName, userEmail, role,
 *         sessions: [
 *           { id, title, createdAt, updatedAt, deletedAt, deletedByName?, messageCount, lastMessage }
 *         ]
 *       }
 *     ],
 *     totals: { users, sessions, activeSessions, deletedSessions }
 *   }
 *
 * Query params:
 *   ?includeDeleted=true  (default: true) — include soft-deleted sessions
 *   ?userId=<id>          — filter to a single user
 */
export async function GET(req: Request) {
  const ctx = await requireRole("owner");
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const includeDeleted = url.searchParams.get("includeDeleted") !== "false";
  const filterUserId = url.searchParams.get("userId");

  // Pull all members of this org so we can group sessions by user — including
  // users who have zero sessions (they should still appear in the list).
  const memberships = await db.membership.findMany({
    where: { orgId: ctx.org.id },
    include: { user: true },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
  });

  // Pull all sessions in this org (optionally excluding soft-deleted).
  const sessions = await db.chatSession.findMany({
    where: {
      orgId: ctx.org.id,
      ...(includeDeleted ? {} : { deletedAt: null }),
      ...(filterUserId ? { userId: filterUserId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  // Index sessions by userId for fast grouping. Sessions with null userId
  // (legacy, pre-user-ownership) go into a synthetic "Unknown user" bucket.
  const sessionsByUser = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = s.userId ?? "__legacy__";
    if (!sessionsByUser.has(key)) sessionsByUser.set(key, []);
    sessionsByUser.get(key)!.push(s);
  }

  // Build the per-user view.
  const users = memberships.map((m) => {
    const userSessions = sessionsByUser.get(m.userId) ?? [];
    return {
      userId: m.userId,
      userName: m.user.name ?? m.user.email.split("@")[0],
      userEmail: m.user.email,
      role: m.role,
      sessions: userSessions.map((s) => ({
        id: s.id,
        title: s.title,
        agentType: s.agentType,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        deletedAt: s.deletedAt,
        messageCount: s._count.messages,
        lastMessage: s.messages[0]?.content?.slice(0, 120) ?? null,
      })),
    };
  });

  // Legacy bucket: sessions with no userId (created before the field existed).
  const legacySessions = sessionsByUser.get("__legacy__") ?? [];
  const legacyBucket =
    legacySessions.length > 0
      ? [
          {
            userId: "__legacy__",
            userName: "Legacy (no owner)",
            userEmail: "",
            role: "—",
            sessions: legacySessions.map((s) => ({
              id: s.id,
              title: s.title,
              agentType: s.agentType,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
              deletedAt: s.deletedAt,
              messageCount: s._count.messages,
              lastMessage: s.messages[0]?.content?.slice(0, 120) ?? null,
            })),
          },
        ]
      : [];

  const allBuckets = [...users, ...legacyBucket];
  // Sort: users with sessions first, then by name.
  allBuckets.sort((a, b) => {
    if (a.sessions.length > 0 && b.sessions.length === 0) return -1;
    if (a.sessions.length === 0 && b.sessions.length > 0) return 1;
    return a.userName.localeCompare(b.userName);
  });

  const totalSessions = sessions.length;
  const deletedSessions = sessions.filter((s) => s.deletedAt !== null).length;

  return NextResponse.json({
    users: allBuckets,
    totals: {
      users: allBuckets.length,
      sessions: totalSessions,
      activeSessions: totalSessions - deletedSessions,
      deletedSessions,
    },
  });
}
