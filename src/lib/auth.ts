/**
 * Marq AI Aggregator — Auth & RBAC library
 *
 * Session-based auth: on login we issue a random opaque token stored in a
 * cookie. The token maps to a User via the AuthSession table. We avoid
 * JWTs so we can revoke sessions server-side instantly.
 *
 * Password hashing uses Node's built-in scrypt (no extra deps), which is
 * roughly equivalent to bcrypt in security.
 *
 * RBAC: every User has a role on each Organization they belong to:
 *   owner  — full control (billing, delete org, manage members + keys)
 *   admin  — manage members + API keys, can't delete org or change plan
 *   member — full app use: chat, agents, prompts, files; can't manage members
 *   viewer — read-only: can view chats/agents/health/failovers, can't write
 *
 * The middleware helpers below (`requireAuth`, `requireRole`, `requireScope`)
 * are designed to be called at the top of any Next.js route handler.
 */

import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// ── Types ─────────────────────────────────────────────────────

export type Role = "owner" | "admin" | "member" | "viewer";
export type Scope = "chat" | "compare" | "agents" | "read" | "admin" | "custom";

export interface AuthContext {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
  role: Role;
  membershipId: string;
}

// ── Password hashing (scrypt) ─────────────────────────────────

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALTLEN = 16;

export function hashPassword(plaintext: string): string {
  const salt = randomBytes(SCRYPT_SALTLEN);
  const hash = scryptSync(plaintext, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plaintext: string, stored: string): boolean {
  try {
    const [scheme, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(plaintext, salt, SCRYPT_KEYLEN);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ── Session tokens ────────────────────────────────────────────

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const COOKIE_NAME = "marq_session";

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.authSession.create({ data: { userId, token, expiresAt } });
  return { token, expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  await db.authSession.deleteMany({ where: { token } }).catch(() => {});
}

/** Read the session token from the request cookie. */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  const c = store.get(COOKIE_NAME);
  return c?.value ?? null;
}

/** Set the session cookie on a response. */
export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date): void {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

// ── Auth context resolution ───────────────────────────────────

/**
 * Resolve the AuthContext for the current request:
 *   1. Read session cookie → look up user.
 *   2. Read `x-org-id` cookie OR fall back to the user's first membership.
 *   3. Look up the membership for that org to determine role.
 *
 * Returns null if the user isn't authenticated.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const authSession = await db.authSession.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          memberships: { include: { org: true } },
        },
      },
    },
  });
  if (!authSession || authSession.expiresAt < new Date()) {
    if (authSession) await db.authSession.delete({ where: { id: authSession.id } }).catch(() => {});
    return null;
  }

  // Pick the active org: prefer the `x-org-id` cookie if set, else the
  // user's first membership.
  const orgStore = await cookies();
  const activeOrgId = orgStore.get("marq_org")?.value ?? null;
  const membership =
    (activeOrgId
      ? authSession.user.memberships.find((m) => m.orgId === activeOrgId)
      : null) ?? authSession.user.memberships[0];

  if (!membership) return null; // user has no orgs

  return {
    user: {
      id: authSession.user.id,
      email: authSession.user.email,
      name: authSession.user.name,
    },
    org: {
      id: membership.org.id,
      name: membership.org.name,
      slug: membership.org.slug,
      plan: membership.org.plan,
    },
    role: membership.role as Role,
    membershipId: membership.id,
  };
}

// ── Route-handler guards ──────────────────────────────────────

/**
 * Require an authenticated user. Returns the AuthContext or a 401 response.
 * Usage:
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return ctx;
}

/**
 * Require an authenticated user with at least the given role on the active org.
 */
export async function requireRole(minRole: Role): Promise<AuthContext | NextResponse> {
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;
  if (!hasMinRole(ctx.role, minRole)) {
    return NextResponse.json(
      { error: "Forbidden", detail: `Requires role >= ${minRole}` },
      { status: 403 },
    );
  }
  return ctx;
}

/**
 * Role ladder: owner > admin > member > viewer.
 */
export function hasMinRole(role: Role, min: Role): boolean {
  const rank: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
  return rank[role] >= rank[min];
}

// ── API key auth (for the unified /api/v1/* external API) ─────

export interface ApiKeyContext {
  orgId: string;
  orgName: string;
  orgSlug: string;
  apiKeyId: string;
  apiKeyName: string;
  scopes: Scope[];
}

/**
 * Authenticate a request via Bearer API key (marq_live_...).
 * Used by the unified external API. Does NOT require a session cookie.
 *
 * The `requiredScope` is checked against the key's scopes.
 */
export async function authApiKey(
  req: NextRequest,
  requiredScope: Scope,
): Promise<ApiKeyContext | NextResponse> {
  const authHeader = req.headers.get("authorization") ?? "";
  // base64url tokens can contain A-Z, a-z, 0-9, -, and _ (after the marq_live_ prefix).
  const m = authHeader.match(/^Bearer\s+(marq_live_[A-Za-z0-9_-]+)$/i);
  if (!m) {
    return NextResponse.json(
      { error: "Unauthorized", detail: "Missing or malformed Bearer token. Expected: Bearer marq_live_..." },
      { status: 401 },
    );
  }
  const token = m[1];

  // Hash the key with SHA-256 and look it up.
  const keyHash = sha256Hex(token);
  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: { org: true },
  });

  if (!apiKey || apiKey.revokedAt) {
    return NextResponse.json({ error: "Unauthorized", detail: "API key not found or revoked" }, { status: 401 });
  }

  const scopes = apiKey.scopes.split(",").map((s) => s.trim()) as Scope[];
  if (!scopes.includes(requiredScope) && !scopes.includes("admin")) {
    return NextResponse.json(
      { error: "Forbidden", detail: `API key lacks required scope: ${requiredScope}` },
      { status: 403 },
    );
  }

  // Update lastUsedAt in the background — don't block the request.
  db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return {
    orgId: apiKey.org.id,
    orgName: apiKey.org.name,
    orgSlug: apiKey.org.slug,
    apiKeyId: apiKey.id,
    apiKeyName: apiKey.name,
    scopes,
  };
}

// ── API key generation ────────────────────────────────────────

export function generateApiKey(): { token: string; prefix: string; hash: string } {
  const rand = randomBytes(24).toString("base64url");
  const token = `marq_live_${rand}`;
  return {
    token,
    prefix: token.slice(0, 16),
    hash: sha256Hex(token),
  };
}

export function sha256Hex(s: string): string {
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(s).digest("hex");
}

// ── Org slug helpers ──────────────────────────────────────────

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || `org-${randomBytes(3).toString("hex")}`;
}
