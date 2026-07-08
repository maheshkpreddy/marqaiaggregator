import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";

/**
 * GET /api/auth/me
 * Returns the current user + active org + all memberships (for the org switcher).
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ user: null, org: null, memberships: [] });

  const memberships = await db.membership.findMany({
    where: { userId: ctx.user.id },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    user: ctx.user,
    org: ctx.org,
    role: ctx.role,
    memberships: memberships.map((m) => ({
      id: m.id,
      role: m.role,
      org: { id: m.org.id, name: m.org.name, slug: m.org.slug, plan: m.org.plan },
    })),
  });
}
