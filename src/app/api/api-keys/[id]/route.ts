import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, hasMinRole } from "@/lib/auth";

/**
 * DELETE /api/api-keys/{id}
 * Revokes an API key. Requires admin. Only owners can revoke admin-scoped keys.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRole("admin");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const key = await db.apiKey.findUnique({ where: { id } });
  if (!key || key.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "API key not found in this org" }, { status: 404 });
  }
  if (key.scopes.includes("admin") && !hasMinRole(ctx.role, "owner")) {
    return NextResponse.json({ error: "Only owners can revoke admin-scoped keys" }, { status: 403 });
  }

  await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
