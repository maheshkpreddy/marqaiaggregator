import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";

/**
 * GET /api/auth/me
 * Returns the current user + active org + all memberships (for the org switcher).
 * Surfaces globalRole (super_admin) and per-org status (pending_approval / approved / ...).
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ user: null, org: null, memberships: [], isSuperAdmin: false });

  const memberships = await db.membership.findMany({
    where: { userId: ctx.user.id },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    user: {
      ...ctx.user,
      isSuperAdmin: ctx.isSuperAdmin,
    },
    org: ctx.org.id ? ctx.org : null,
    role: ctx.role,
    isSuperAdmin: ctx.isSuperAdmin,
    memberships: memberships.map((m) => ({
      id: m.id,
      role: m.role,
      org: {
        id: m.org.id,
        name: m.org.name,
        slug: m.org.slug,
        plan: m.org.plan,
        status: m.org.status,
      },
    })),
  });
}
