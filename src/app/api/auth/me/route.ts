import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, MODULE_KEYS, resolveOrgModules } from "@/lib/auth";

/**
 * GET /api/auth/me
 * Returns the current user + active org + all memberships (for the org switcher).
 * Surfaces globalRole (super_admin) and per-org status (pending_approval / approved / ...).
 *
 * Also returns `allowedModules` — the effective set of module keys the org's
 * users can see in the sidebar, computed by merging the plan's feature list
 * with per-org OrgModuleAccess overrides. Super admins get all modules.
 * The frontend uses this array to filter the sidebar tabs.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ user: null, org: null, memberships: [], isSuperAdmin: false, allowedModules: [] });

  const memberships = await db.membership.findMany({
    where: { userId: ctx.user.id },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });

  // For each membership, compute the effective module set so the frontend
  // can re-filter the sidebar when the user switches orgs.
  const membershipsRendered: Array<{
    id: string;
    role: string;
    org: { id: string; name: string; slug: string; plan: string; status: string };
    allowedModules: string[];
  }> = [];
  for (const m of memberships) {
    const modules = ctx.isSuperAdmin
      ? MODULE_KEYS
      : await resolveOrgModules(m.org.id, m.org.plan);
    membershipsRendered.push({
      id: m.id,
      role: m.role,
      org: {
        id: m.org.id,
        name: m.org.name,
        slug: m.org.slug,
        plan: m.org.plan,
        status: m.org.status,
      },
      allowedModules: modules,
    });
  }

  return NextResponse.json({
    user: {
      ...ctx.user,
      isSuperAdmin: ctx.isSuperAdmin,
    },
    org: ctx.org.id ? ctx.org : null,
    role: ctx.role,
    isSuperAdmin: ctx.isSuperAdmin,
    allowedModules: ctx.allowedModules,
    memberships: membershipsRendered,
  });
}
