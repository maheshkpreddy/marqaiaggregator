import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, getAuthContext } from "@/lib/auth";

/**
 * GET /api/providers
 * Returns all configured AI providers, ordered by priority.
 *
 * Providers are global (shared across orgs in this build — every org sees
 * the same provider registry). Read access requires at least viewer role,
 * but we fall back to unauthenticated listing so the local stress-test
 * script can still exercise the platform.
 */
export async function GET() {
  const ctx = await getAuthContext();
  // Read is allowed unauthenticated for the legacy demo path; once a user
  // is logged in we still allow them to read providers (providers are not
  // org-scoped in this build).

  const providers = await db.provider.findMany({
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    include: {
      healthLogs: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
    },
  });

  const enriched = providers.map((p) => {
    const latest = p.healthLogs[0];
    return {
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      apiEndpoint: p.apiEndpoint,
      hasApiKey: Boolean(p.apiKey),
      models: JSON.parse(p.models) as string[],
      active: p.active,
      priority: p.priority,
      color: p.color,
      icon: p.icon,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      status: latest?.status ?? "unknown",
      lastLatencyMs: latest?.latencyMs ?? null,
      lastError: latest?.error ?? null,
      lastCheckedAt: latest?.checkedAt ?? null,
    };
  });

  return NextResponse.json({ providers: enriched, authenticated: Boolean(ctx) });
}

/**
 * POST /api/providers
 * Body: { name, displayName, description?, apiEndpoint?, apiKey?, models[], color?, icon? }
 *
 * Creating providers requires admin role (since providers are shared across
 * all orgs on the instance, only admins should add/remove them).
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { name, displayName, description, apiEndpoint, apiKey, models, color, icon } = body ?? {};

  if (!name || !displayName) {
    return NextResponse.json({ error: "name and displayName are required" }, { status: 400 });
  }
  if (!Array.isArray(models) || models.length === 0) {
    return NextResponse.json({ error: "models must be a non-empty array" }, { status: 400 });
  }

  const existing = await db.provider.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: `Provider '${name}' already exists` }, { status: 409 });
  }

  const maxPriority = await db.provider.aggregate({ _max: { priority: true } });
  const provider = await db.provider.create({
    data: {
      name,
      displayName,
      description: description ?? null,
      apiEndpoint: apiEndpoint ?? null,
      apiKey: apiKey || null,
      models: JSON.stringify(models),
      priority: (maxPriority._max.priority ?? -1) + 1,
      color: color ?? "#64748b",
      icon: icon ?? "bot",
    },
  });

  return NextResponse.json({ provider }, { status: 201 });
}
