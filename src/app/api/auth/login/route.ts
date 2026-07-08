import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Verifies credentials and issues a session token cookie.
 * The active org is set to the user's first membership.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password } = body ?? {};

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      memberships: { include: { org: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (user.memberships.length === 0) {
    return NextResponse.json({ error: "Account has no organization. Contact support." }, { status: 403 });
  }

  const { token, expiresAt } = await createSession(user.id);
  const primaryMembership = user.memberships[0];

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    org: {
      id: primaryMembership.org.id,
      name: primaryMembership.org.name,
      slug: primaryMembership.org.slug,
      plan: primaryMembership.org.plan,
      role: primaryMembership.role,
    },
    memberships: user.memberships.map((m) => ({
      id: m.id,
      role: m.role,
      org: { id: m.org.id, name: m.org.name, slug: m.org.slug, plan: m.org.plan },
    })),
  });

  setSessionCookie(res, token, expiresAt);
  res.cookies.set("marq_org", primaryMembership.orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return res;
}
