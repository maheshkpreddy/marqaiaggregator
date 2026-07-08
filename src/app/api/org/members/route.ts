import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, hasMinRole } from "@/lib/auth";

/**
 * POST /api/org/members
 * Body: { email, role }
 *
 * Adds an existing user (by email) as a member of the active org.
 * Requires admin. Cannot add the org owner as a lower role.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { email, role } = body ?? {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  const validRoles = ["admin", "member", "viewer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: `Role must be one of: ${validRoles.join(", ")}` }, { status: 400 });
  }

  const targetUser = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!targetUser) {
    return NextResponse.json({ error: "No user found with that email. Ask them to sign up first." }, { status: 404 });
  }

  const existing = await db.membership.findUnique({
    where: { userId_orgId: { userId: targetUser.id, orgId: ctx.org.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "User is already a member of this organization" }, { status: 409 });
  }

  const org = await db.organization.findUnique({ where: { id: ctx.org.id } });
  const memberCount = await db.membership.count({ where: { orgId: ctx.org.id } });
  if (memberCount >= (org?.seatsTotal ?? 5)) {
    return NextResponse.json({ error: `Seat limit reached (${org?.seatsTotal}). Upgrade plan to add more members.` }, { status: 402 });
  }

  const membership = await db.membership.create({
    data: { userId: targetUser.id, orgId: ctx.org.id, role },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  await db.organization.update({
    where: { id: ctx.org.id },
    data: { seatsUsed: memberCount + 1 },
  });

  return NextResponse.json({
    id: membership.id,
    role: membership.role,
    user: membership.user,
    createdAt: membership.createdAt,
  }, { status: 201 });
}

/**
 * PATCH /api/org/members
 * Body: { membershipId, role }
 *
 * Change a member's role. Admins can promote/demote up to admin.
 * Only owners can grant admin role or demote other admins.
 */
export async function PATCH(req: NextRequest) {
  const ctx = await requireRole("admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { membershipId, role } = body ?? {};
  if (!membershipId || !role) {
    return NextResponse.json({ error: "membershipId and role are required" }, { status: 400 });
  }
  const validRoles = ["admin", "member", "viewer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: `Role must be one of: ${validRoles.join(", ")}` }, { status: 400 });
  }

  // Granting admin requires owner.
  if (role === "admin" && !hasMinRole(ctx.role, "owner")) {
    return NextResponse.json({ error: "Only owners can grant admin role" }, { status: 403 });
  }

  const target = await db.membership.findUnique({ where: { id: membershipId } });
  if (!target || target.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "Membership not found in this org" }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot change the role of an owner" }, { status: 400 });
  }

  const updated = await db.membership.update({
    where: { id: membershipId },
    data: { role },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return NextResponse.json({ id: updated.id, role: updated.role, user: updated.user });
}

/**
 * DELETE /api/org/members?membershipId=...
 *
 * Remove a member from the org. Admins can remove members/viewers.
 * Only owners can remove admins. Owners cannot be removed.
 */
export async function DELETE(req: NextRequest) {
  const ctx = await requireRole("admin");
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const membershipId = url.searchParams.get("membershipId");
  if (!membershipId) return NextResponse.json({ error: "membershipId is required" }, { status: 400 });

  const target = await db.membership.findUnique({ where: { id: membershipId } });
  if (!target || target.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "Membership not found in this org" }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot remove the owner of the org" }, { status: 400 });
  }
  if (target.role === "admin" && !hasMinRole(ctx.role, "owner")) {
    return NextResponse.json({ error: "Only owners can remove admins" }, { status: 403 });
  }

  await db.membership.delete({ where: { id: membershipId } });
  await db.organization.update({
    where: { id: ctx.org.id },
    data: { seatsUsed: { decrement: 1 } },
  });

  return NextResponse.json({ ok: true });
}
