import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, generateApiKey, hasMinRole } from "@/lib/auth";

/**
 * GET /api/custom-apis
 * Lists all custom API configs for the active org.
 */
export async function GET() {
  const ctx = await requireRole("viewer");
  if (ctx instanceof NextResponse) return ctx;

  const configs = await db.customApiConfig.findMany({
    where: { orgId: ctx.org.id },
    orderBy: { createdAt: "desc" },
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

  // Enrich with provider display names
  const allProviderIds = new Set<string>();
  for (const c of configs) {
    try {
      const ids = JSON.parse(c.providerIds) as string[];
      ids.forEach((id) => allProviderIds.add(id));
    } catch {}
  }
  const providers = await db.provider.findMany({
    where: { id: { in: Array.from(allProviderIds) } },
    select: { id: true, name: true, displayName: true, color: true, icon: true },
  });
  const providerMap = new Map(providers.map((p) => [p.id, p]));

  const enriched = configs.map((c) => {
    let providerIds: string[] = [];
    try {
      providerIds = JSON.parse(c.providerIds);
    } catch {}
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      rationale: c.rationale,
      openSourceFirst: c.openSourceFirst,
      timeoutMs: c.timeoutMs,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      providerIds,
      providers: providerIds
        .map((id) => providerMap.get(id))
        .filter(Boolean)
        .map((p) => ({
          id: p!.id,
          name: p!.name,
          displayName: p!.displayName,
          color: p!.color,
          icon: p!.icon,
        })),
      apiKey: c.apiKey
        ? {
            id: c.apiKey.id,
            name: c.apiKey.name,
            keyPrefix: c.apiKey.keyPrefix,
            scopes: c.apiKey.scopes,
            lastUsedAt: c.apiKey.lastUsedAt,
            revoked: c.apiKey.revokedAt !== null,
          }
        : null,
    };
  });

  return NextResponse.json({ customApis: enriched });
}

/**
 * POST /api/custom-apis
 * Creates a new custom API: generates an API key + links it to a
 * CustomApiConfig with the user-specified provider chain.
 *
 * Body:
 *   name: string
 *   description?: string
 *   rationale?: string
 *   providerIds: string[]          — ordered list (index 0 = primary)
 *   openSourceFirst?: boolean      — default true
 *   timeoutMs?: number             — default 12000
 *
 * Returns the new config + the ONE-TIME full API key token.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const {
    name,
    description,
    rationale,
    providerIds,
    openSourceFirst = true,
    timeoutMs = 12000,
  } = body ?? {};

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json(
      { error: "A descriptive name is required (min 2 chars)" },
      { status: 400 }
    );
  }

  if (!Array.isArray(providerIds) || providerIds.length < 1) {
    return NextResponse.json(
      { error: "providerIds must be a non-empty array" },
      { status: 400 }
    );
  }

  // Validate all provider IDs exist and belong to active providers.
  const providers = await db.provider.findMany({
    where: { id: { in: providerIds }, active: true },
    select: { id: true },
  });
  const validIds = new Set(providers.map((p) => p.id));
  const filteredIds = providerIds.filter((id: string) => validIds.has(id));
  if (filteredIds.length === 0) {
    return NextResponse.json(
      { error: "None of the specified provider IDs are valid active providers" },
      { status: 400 }
    );
  }

  // Generate the API key with the "custom" scope.
  const { token, prefix, hash } = generateApiKey();
  const apiKey = await db.apiKey.create({
    data: {
      orgId: ctx.org.id,
      name: name.trim(),
      keyPrefix: prefix,
      keyHash: hash,
      scopes: "custom",
    },
  });

  const config = await db.customApiConfig.create({
    data: {
      orgId: ctx.org.id,
      apiKeyId: apiKey.id,
      name: name.trim(),
      description: description ?? null,
      rationale: rationale ?? null,
      providerIds: JSON.stringify(filteredIds),
      openSourceFirst: Boolean(openSourceFirst),
      timeoutMs:
        typeof timeoutMs === "number" && timeoutMs >= 5000 && timeoutMs <= 30000
          ? Math.floor(timeoutMs)
          : 12000,
    },
  });

  return NextResponse.json(
    {
      id: config.id,
      name: config.name,
      description: config.description,
      rationale: config.rationale,
      providerIds: filteredIds,
      openSourceFirst: config.openSourceFirst,
      timeoutMs: config.timeoutMs,
      createdAt: config.createdAt,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
      },
      token, // ONE-TIME — only returned here, never again
    },
    { status: 201 }
  );
}
