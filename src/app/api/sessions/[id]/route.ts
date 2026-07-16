import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/sessions/[id]
 *
 * Two modes:
 *  1. Soft-delete (default): sets `deletedAt` + `deletedBy`. The session
 *     disappears from the owning user's sidebar but remains in the database
 *     so org owners can audit it via /api/sessions/admin.
 *  2. Permanent hard-delete (?permanent=true): physically removes the
 *     session and all its messages. Org-owner-only. Cannot be undone.
 *
 * Authorization:
 *  - Soft-delete: session owner OR org owner/admin.
 *  - Hard-delete: org owner only.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const url = new URL(req.url);
  const permanent = url.searchParams.get("permanent") === "true";

  const session = await db.chatSession.findUnique({ where: { id } });
  if (!session || session.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "Session not found in this org" }, { status: 404 });
  }

  // Permanent hard-delete — owner only.
  if (permanent) {
    if (ctx.role !== "owner") {
      return NextResponse.json(
        { error: "Only org owners can permanently delete sessions" },
        { status: 403 }
      );
    }
    await db.chatSession.delete({ where: { id } });
    return NextResponse.json({ ok: true, permanent: true });
  }

  // Soft-delete — owner of the session OR org owner/admin.
  const isOwnerOfSession = session.userId === ctx.user.id;
  const isOrgAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isOwnerOfSession && !isOrgAdmin) {
    return NextResponse.json(
      { error: "You can only delete your own sessions" },
      { status: 403 }
    );
  }

  await db.chatSession.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedBy: ctx.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/sessions/[id]
 *
 * Two modes:
 *  1. Rename: Body { title: string } — updates the session title.
 *  2. Restore: Body { restore: true } — clears `deletedAt` + `deletedBy`,
 *     making the session visible to the user again. Org-owner-only.
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

  // Restore mode — owner only.
  if (body?.restore === true) {
    if (ctx.role !== "owner") {
      return NextResponse.json(
        { error: "Only org owners can restore deleted sessions" },
        { status: 403 }
      );
    }
    const updated = await db.chatSession.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    });
    return NextResponse.json({ session: updated });
  }

  // Rename mode.
  if (!body?.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Authorization: owner of the session OR org owner/admin.
  const isOwnerOfSession = session.userId === ctx.user.id;
  const isOrgAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isOwnerOfSession && !isOrgAdmin) {
    return NextResponse.json(
      { error: "You can only rename your own sessions" },
      { status: 403 }
    );
  }

  const updated = await db.chatSession.update({
    where: { id },
    data: { title: body.title },
  });
  return NextResponse.json({ session: updated });
}
