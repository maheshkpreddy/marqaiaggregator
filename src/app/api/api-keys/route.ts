import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, generateApiKey, hasMinRole } from "@/lib/auth";

/**
 * GET /api/api-keys
 * Lists all API keys for the active org (key values are NOT returned —
 * only the prefix and metadata).
 */
export async function GET() {
  const ctx = await requireRole("viewer");
  if (ctx instanceof NextResponse) return ctx;

  const keys = await db.apiKey.findMany({
    where: { orgId: ctx.org.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ apiKeys: keys });
}

/**
 * POST /api/api-keys
 * Body: { name, scopes? }
 *
 * Generates a new API key. The full token is returned ONCE in the response.
 * Only the SHA-256 hash is stored.
 *
 * Requires admin role.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { name, scopes } = body ?? {};
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "A descriptive name is required" }, { status: 400 });
  }

  const requestedScopes = Array.isArray(scopes) ? scopes : ["chat", "compare", "agents"];
  const validScopes = ["chat", "compare", "agents", "read", "admin"];
  const filtered = requestedScopes.filter((s: string) => validScopes.includes(s));
  if (filtered.length === 0) {
    return NextResponse.json({ error: `scopes must be a subset of: ${validScopes.join(", ")}` }, { status: 400 });
  }
  // `admin` scope grants everything — only owners can issue it.
  if (filtered.includes("admin") && !hasMinRole(ctx.role, "owner")) {
    return NextResponse.json({ error: "Only owners can issue admin-scoped API keys" }, { status: 403 });
  }

  const { token, prefix, hash } = generateApiKey();
  const apiKey = await db.apiKey.create({
    data: {
      orgId: ctx.org.id,
      name: name.trim(),
      keyPrefix: prefix,
      keyHash: hash,
      scopes: filtered.join(","),
    },
  });

  return NextResponse.json({
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    scopes: apiKey.scopes,
    createdAt: apiKey.createdAt,
    // The full token — only returned ONCE. The UI shows a copy dialog.
    token,
  }, { status: 201 });
}
