import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Verifies credentials and issues a session token cookie.
 * The active org is set to the user's first membership.
 *
 * Super admins (globalRole === "super_admin") can log in even with no org
 * membership or a suspended/rejected org — they need access to the admin
 * console to approve pending orgs.
 *
 * Regular users are blocked if their org is `pending_approval`, `rejected`,
 * or `suspended` — they get a descriptive error message instead.
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

  if (user.suspendedAt) {
    return NextResponse.json(
      { error: "Your account has been suspended. Contact support@marq.ai." },
      { status: 403 },
    );
  }

  const isSuperAdmin = user.globalRole === "super_admin";

  // Super admins can always log in (no org membership required).
  if (!isSuperAdmin && user.memberships.length === 0) {
    return NextResponse.json({ error: "Account has no organization. Contact support." }, { status: 403 });
  }

  // For regular users, surface org status as a friendly error.
  if (!isSuperAdmin) {
    const primaryOrg = user.memberships[0]?.org;
    if (primaryOrg) {
      if (primaryOrg.status === "pending_approval") {
        return NextResponse.json(
          { error: "Your organization is pending approval by our team. You'll get an email once approved." },
          { status: 403 },
        );
      }
      if (primaryOrg.status === "rejected") {
        return NextResponse.json(
          { error: `Your organization registration was declined. Reason: ${primaryOrg.rejectionReason || "Not specified"}` },
          { status: 403 },
        );
      }
      if (primaryOrg.status === "suspended") {
        return NextResponse.json(
          { error: "Your organization is currently suspended. Contact support@marq.ai." },
          { status: 403 },
        );
      }
    }
  }

  const { token, expiresAt } = await createSession(user.id);
  const primaryMembership = user.memberships[0];

  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
    },
    isSuperAdmin,
    org: primaryMembership
      ? {
          id: primaryMembership.org.id,
          name: primaryMembership.org.name,
          slug: primaryMembership.org.slug,
          plan: primaryMembership.org.plan,
          role: isSuperAdmin ? "owner" : primaryMembership.role,
          status: primaryMembership.org.status,
        }
      : null,
    memberships: user.memberships.map((m) => ({
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

  setSessionCookie(res, token, expiresAt);
  if (primaryMembership) {
    res.cookies.set("marq_org", primaryMembership.orgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
  }
  return res;
}
