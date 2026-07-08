import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/sessions/[id]
 * Delete a chat session and all of its messages. Scoped by org.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const session = await db.chatSession.findUnique({ where: { id } });
  if (!session || session.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "Session not found in this org" }, { status: 404 });
  }
  await db.chatSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/sessions/[id]
 * Rename a session. Body: { title }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const session = await db.chatSession.findUnique({ where: { id } });
  if (!session || session.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "Session not found in this org" }, { status: 404 });
  }

  const body = await req.json();
  if (!body?.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const updated = await db.chatSession.update({
    where: { id },
    data: { title: body.title },
  });
  return NextResponse.json({ session: updated });
}
