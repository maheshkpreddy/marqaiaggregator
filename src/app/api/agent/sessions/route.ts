import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/sessions
 * List agent chat sessions for the active org, newest first.
 * Only sessions with a non-null agentType are returned (regular chat
 * sessions are listed via /api/sessions).
 *
 * Optional query:
 *   ?agentType=sales  — filter by agent type
 */
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  const filterAgentType = req.nextUrl.searchParams.get("agentType");

  const where = {
    ...(ctx ? { orgId: ctx.org.id } : {}),
    agentType: filterAgentType ?? { not: null },
  };

  const sessions = await db.chatSession.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const enriched = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    agentType: s.agentType,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    messageCount: s._count.messages,
    lastMessagePreview: s.messages[0]?.content?.slice(0, 100) ?? null,
  }));

  return NextResponse.json({ sessions: enriched });
}
