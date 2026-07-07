import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/sessions/[id]
 * Delete a chat session and all of its messages.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.chatSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/sessions/[id]
 * Rename a session. Body: { title }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  if (!body?.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const session = await db.chatSession.update({
    where: { id },
    data: { title: body.title },
  });
  return NextResponse.json({ session });
}
