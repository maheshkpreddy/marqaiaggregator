import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie, slugify } from "@/lib/auth";

/**
 * POST /api/auth/signup
 * Body: { email, password, name, orgName }
 *
 * Creates a new Organization, a new User (as owner of that org), and a
 * session. Returns the user + org + token cookie.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password, name, orgName } = body ?? {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!orgName || typeof orgName !== "string" || orgName.trim().length < 2) {
    return NextResponse.json({ error: "Organization name is required (min 2 chars)" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const slug = slugify(orgName);
  const slugTaken = await db.organization.findUnique({ where: { slug } });
  const finalSlug = slugTaken ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;

  // Create org + user + membership in one transaction.
  const result = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: orgName.trim(),
        slug: finalSlug,
        plan: "free",
        seatsTotal: 5,
        seatsUsed: 1,
      },
    });

    const user = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        name: name?.trim() || null,
        passwordHash: hashPassword(password),
      },
    });

    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: "owner",
      },
    });

    return { org, user, membership };
  });

  const { token, expiresAt } = await createSession(result.user.id);

  const res = NextResponse.json({
    user: { id: result.user.id, email: result.user.email, name: result.user.name },
    org: { id: result.org.id, name: result.org.name, slug: result.org.slug, plan: result.org.plan, role: "owner" },
  });
  setSessionCookie(res, token, expiresAt);
  res.cookies.set("marq_org", result.org.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return res;
}
