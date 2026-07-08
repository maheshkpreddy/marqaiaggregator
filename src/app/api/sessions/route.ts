import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

/**
 * GET /api/sessions
 * List chat sessions for the active org, most-recent first.
 */
export async function GET() {
  const ctx = await requireRole("viewer");
  if (ctx instanceof NextResponse) return ctx;

  const sessions = await db.chatSession.findMany({
    where: { orgId: ctx.org.id },
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
 * Create a new chat session in the active org. Body: { title? }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const title = body?.title || "New Conversation";
  const session = await db.chatSession.create({ data: { orgId: ctx.org.id, title } });
  return NextResponse.json({ session }, { status: 201 });
}
