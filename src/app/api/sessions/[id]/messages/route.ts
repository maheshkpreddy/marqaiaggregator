import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sessions/[id]/messages
 * Returns all messages for a session, oldest first. Scoped by org.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await requireRole("viewer");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const session = await db.chatSession.findUnique({ where: { id } });
  if (!session || session.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "Session not found in this org" }, { status: 404 });
  }

  const messages = await db.message.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
    include: { provider: true },
  });

  const enriched = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    model: m.model,
    latencyMs: m.latencyMs,
    tokensUsed: m.tokensUsed,
    failedOver: m.failedOver,
    originalProviderId: m.originalProviderId,
    createdAt: m.createdAt,
    provider: m.provider
      ? {
          id: m.provider.id,
          name: m.provider.name,
          displayName: m.provider.displayName,
          color: m.provider.color,
          icon: m.provider.icon,
        }
      : null,
  }));

  return NextResponse.json({ session, messages: enriched });
}

/**
 * DELETE /api/sessions/[id]/messages
 * Clears all messages in the session.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const session = await db.chatSession.findUnique({ where: { id } });
  if (!session || session.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "Session not found in this org" }, { status: 404 });
  }
  await db.message.deleteMany({ where: { sessionId: id } });
  return NextResponse.json({ ok: true });
}
