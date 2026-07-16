import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";

/**
 * POST /api/auth/switch-org
 * Body: { orgId }
 *
 * Switches the active org (sets the marq_org cookie). The user must be a
 * member of that org.
 */
export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { orgId } = body ?? {};
  if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: ctx.user.id, orgId } },
    include: { org: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this organization" }, { status: 403 });
  }

  const res = NextResponse.json({
    org: {
      id: membership.org.id,
      name: membership.org.name,
      slug: membership.org.slug,
      plan: membership.org.plan,
      status: membership.org.status,
    },
    role: membership.role,
  });
  res.cookies.set("marq_org", membership.orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
