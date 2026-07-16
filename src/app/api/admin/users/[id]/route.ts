import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

/**
 * PATCH /api/admin/users/[id]
 * Body: {
 *   globalRole?:  "user" | "super_admin"   (promote/demote super admin)
 *   suspend?:     boolean                  (true = suspend, false = unsuspend)
 * }
 *
 * Super admin only. Used to:
 *   - Promote a trusted user to super_admin
 *   - Demote a super_admin back to user
 *   - Suspend a user globally (blocks login)
 *   - Unsuspend a user
 *
 * Self-protection: a super admin cannot demote or suspend themselves.
 *
 * Returns the updated user.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSuperAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { globalRole, suspend } = body ?? {};

  if (id === ctx.user.id) {
    return NextResponse.json(
      { error: "You cannot modify your own super admin privileges or suspend yourself." },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};

  if (globalRole !== undefined) {
    if (!["user", "super_admin"].includes(globalRole)) {
      return NextResponse.json({ error: "globalRole must be 'user' or 'super_admin'" }, { status: 400 });
    }
    data.globalRole = globalRole;
  }

  if (suspend !== undefined) {
    if (typeof suspend !== "boolean") {
      return NextResponse.json({ error: "suspend must be a boolean" }, { status: 400 });
    }
    data.suspendedAt = suspend ? new Date() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update. Send globalRole or suspend." }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Safety: prevent demoting the LAST super admin (would lock out the platform).
  if (existing.globalRole === "super_admin" && data.globalRole === "user") {
    const superAdminCount = await db.user.count({ where: { globalRole: "super_admin" } });
    if (superAdminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot demote the last super admin. Promote another user first." },
        { status: 400 },
      );
    }
  }

  const updated = await db.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      globalRole: true,
      suspendedAt: true,
      updatedAt: true,
    },
  });

  // If the user was suspended, kill all their active sessions.
  if (suspend) {
    await db.authSession.deleteMany({ where: { userId: id } }).catch(() => {});
  }

  return NextResponse.json({ user: updated });
}
