import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin, MODULE_CATALOG, MODULE_KEYS, ALWAYS_ON_MODULES, resolveOrgModules } from "@/lib/auth";

/**
 * GET /api/admin/orgs/[id]/modules
 *
 * Returns the per-org module access configuration for the super admin's
 * "Module Access" dialog. The response includes:
 *   - catalog:       the full list of modules (key, label, group, description, alwaysOn)
 *   - planFeatures:  the module keys granted by the org's current plan (CSV split)
 *   - overrides:     per-org rows from OrgModuleAccess (id, moduleKey, enabled, note, updatedAt)
 *   - effective:     the final computed set of allowed modules (plan ∪ +enabled − +disabled)
 *
 * Super admin only.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSuperAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const org = await db.organization.findUnique({ where: { id } });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const plan = await db.subscriptionPlan.findUnique({ where: { code: org.plan } });
  const planFeaturesCsv = plan?.features ?? "";
  const planFeatures = planFeaturesCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Empty plan features = ALL modules enabled (Enterprise / Custom convention).
  const planFeaturesSet = planFeatures.length === 0 ? new Set(MODULE_KEYS) : new Set(planFeatures);

  const overrides = await db.orgModuleAccess.findMany({
    where: { orgId: id },
    orderBy: { moduleKey: "asc" },
  });

  const effective = await resolveOrgModules(id, org.plan);

  return NextResponse.json({
    catalog: MODULE_CATALOG,
    planCode: org.plan,
    planName: plan?.name ?? org.plan,
    planFeatures: Array.from(planFeaturesSet).sort(),
    alwaysOn: ALWAYS_ON_MODULES,
    overrides: overrides.map((o) => ({
      id: o.id,
      moduleKey: o.moduleKey,
      enabled: o.enabled,
      note: o.note,
      updatedBy: o.updatedBy,
      updatedAt: o.updatedAt,
    })),
    effective,
  });
}

/**
 * PUT /api/admin/orgs/[id]/modules
 *
 * Body: { modules: Array<{ moduleKey: string; enabled: boolean; note?: string }> }
 *
 * Replaces the per-org overrides with the supplied set. Any module NOT in the
 * array will have its override removed (reverting to the plan default).
 * Modules marked `alwaysOn` in MODULE_CATALOG are always enabled regardless
 * of what the super admin sends — they cannot be revoked.
 *
 * Super admin only.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSuperAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const incoming = body?.modules;
  if (!Array.isArray(incoming)) {
    return NextResponse.json({ error: "Body must be { modules: Array<{ moduleKey, enabled, note? }> }" }, { status: 400 });
  }

  const org = await db.organization.findUnique({ where: { id } });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const validKeys = new Set(MODULE_KEYS);
  const alwaysOn = new Set(ALWAYS_ON_MODULES);

  // Normalize incoming rows: drop invalid keys, force always-on to enabled=true.
  const normalized: Array<{ moduleKey: string; enabled: boolean; note: string | null }> = [];
  for (const row of incoming) {
    if (!row || typeof row.moduleKey !== "string") continue;
    if (!validKeys.has(row.moduleKey)) continue;
    const enabled = alwaysOn.has(row.moduleKey) ? true : Boolean(row.enabled);
    const note = typeof row.note === "string" ? row.note.slice(0, 500) : null;
    normalized.push({ moduleKey: row.moduleKey, enabled, note });
  }

  // Build a map for fast lookup.
  const incomingMap = new Map(normalized.map((r) => [r.moduleKey, r]));

  // Determine which modules need an override row vs. which should inherit the plan default.
  // A module needs an override when the super admin's choice differs from the plan's default.
  // To compute the plan default we need the plan's feature CSV.
  const plan = await db.subscriptionPlan.findUnique({ where: { code: org.plan } });
  const planFeaturesCsv = plan?.features ?? "";
  const planFeatureArr = planFeaturesCsv.split(",").map((s) => s.trim()).filter(Boolean);
  const planFeaturesSet = planFeatureArr.length === 0 ? new Set(MODULE_KEYS) : new Set(planFeatureArr);

  const desiredRows: Array<{ moduleKey: string; enabled: boolean; note: string | null }> = [];
  for (const key of MODULE_KEYS) {
    const isAlwaysOn = alwaysOn.has(key);
    const planDefault = isAlwaysOn ? true : planFeaturesSet.has(key);
    const incomingRow = incomingMap.get(key);
    // If the super admin didn't mention this module, inherit the plan default.
    // We still need an override only if their choice differs from the plan default.
    const chosen = incomingRow ? incomingRow.enabled : planDefault;
    const effective = isAlwaysOn ? true : chosen;
    if (effective !== planDefault || incomingRow?.note) {
      desiredRows.push({
        moduleKey: key,
        enabled: effective,
        note: incomingRow?.note ?? null,
      });
    }
  }

  // Atomically replace all overrides for this org.
  await db.$transaction(async (tx) => {
    await tx.orgModuleAccess.deleteMany({ where: { orgId: id } });
    if (desiredRows.length > 0) {
      await tx.orgModuleAccess.createMany({
        data: desiredRows.map((r) => ({
          orgId: id,
          moduleKey: r.moduleKey,
          enabled: r.enabled,
          note: r.note,
          updatedBy: ctx.user.id,
        })),
      });
    }
  });

  const effective = await resolveOrgModules(id, org.plan);

  return NextResponse.json({
    ok: true,
    orgId: id,
    effective,
    overrides: desiredRows,
  });
}
