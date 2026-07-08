import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

/**
 * GET /api/org
 * Returns the active org + its members + seats info.
 */
export async function GET() {
  const ctx = await requireRole("viewer");
  if (ctx instanceof NextResponse) return ctx;

  const [org, members] = await Promise.all([
    db.organization.findUnique({
      where: { id: ctx.org.id },
      include: { _count: { select: { memberships: true } } },
    }),
    db.membership.findMany({
      where: { orgId: ctx.org.id },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    org: {
      id: org!.id,
      name: org!.name,
      slug: org!.slug,
      plan: org!.plan,
      seatsTotal: org!.seatsTotal,
      seatsUsed: members.length,
    },
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      user: m.user,
      createdAt: m.createdAt,
    })),
    currentUserId: ctx.user.id,
    currentUserRole: ctx.role,
  });
}

/**
 * PATCH /api/org
 * Body: { name? }
 * Updates the org name. Requires admin.
 */
export async function PATCH(req: Request) {
  const ctx = await requireRole("admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { name } = body ?? {};
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Valid name is required" }, { status: 400 });
  }

  const org = await db.organization.update({
    where: { id: ctx.org.id },
    data: { name: name.trim() },
  });

  return NextResponse.json({ org: { id: org.id, name: org.name, slug: org.slug, plan: org.plan } });
}
