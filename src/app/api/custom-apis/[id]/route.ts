import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/custom-apis/[id]
 *
 * Revokes the custom API config AND its linked API key. The config row
 * is deleted (hard delete — it's just metadata); the API key is soft-
 * revoked (revokedAt set) so audit logs remain intact.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await requireRole("admin");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const config = await db.customApiConfig.findUnique({
    where: { id },
    include: { apiKey: true },
  });

  if (!config || config.orgId !== ctx.org.id) {
    return NextResponse.json(
      { error: "Custom API not found in this org" },
      { status: 404 }
    );
  }

  // Revoke the API key (soft delete for audit).
  await db.apiKey.update({
    where: { id: config.apiKeyId },
    data: { revokedAt: new Date() },
  });

  // Delete the config row (hard delete — it's just metadata).
  await db.customApiConfig.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/custom-apis/[id]
 * Returns a single custom API config with full details.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await requireRole("viewer");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const config = await db.customApiConfig.findUnique({
    where: { id },
    include: {
      apiKey: {
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          lastUsedAt: true,
          revokedAt: true,
        },
      },
    },
  });

  if (!config || config.orgId !== ctx.org.id) {
    return NextResponse.json(
      { error: "Custom API not found in this org" },
      { status: 404 }
    );
  }

  let providerIds: string[] = [];
  try {
    providerIds = JSON.parse(config.providerIds);
  } catch {}

  const providers = await db.provider.findMany({
    where: { id: { in: providerIds } },
    select: {
      id: true,
      name: true,
      displayName: true,
      color: true,
      icon: true,
      description: true,
    },
  });
  const providerMap = new Map(providers.map((p) => [p.id, p]));

  return NextResponse.json({
    customApi: {
      id: config.id,
      name: config.name,
      description: config.description,
      rationale: config.rationale,
      openSourceFirst: config.openSourceFirst,
      timeoutMs: config.timeoutMs,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      providerIds,
      providers: providerIds
        .map((pid) => providerMap.get(pid))
        .filter(Boolean)
        .map((p) => ({
          id: p!.id,
          name: p!.name,
          displayName: p!.displayName,
          color: p!.color,
          icon: p!.icon,
          description: p!.description,
        })),
      apiKey: config.apiKey
        ? {
            id: config.apiKey.id,
            name: config.apiKey.name,
            keyPrefix: config.apiKey.keyPrefix,
            scopes: config.apiKey.scopes,
            lastUsedAt: config.apiKey.lastUsedAt,
            revoked: config.apiKey.revokedAt !== null,
          }
        : null,
    },
  });
}
