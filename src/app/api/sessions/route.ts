import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/sessions
 * List all chat sessions, most-recent first.
 */
export async function GET() {
  const sessions = await db.chatSession.findMany({
    orderBy: { updatedAt: "desc" },
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
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    messageCount: s._count.messages,
    lastMessage: s.messages[0]?.content?.slice(0, 100) ?? null,
  }));

  return NextResponse.json({ sessions: enriched });
}

/**
 * POST /api/sessions
 * Create a new chat session. Body: { title? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = body?.title || "New Conversation";
  const session = await db.chatSession.create({ data: { title } });
  return NextResponse.json({ session }, { status: 201 });
}
