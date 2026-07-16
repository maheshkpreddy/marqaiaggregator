import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

/**
 * GET /api/admin/orgs?status=pending_approval&plan=free&q=acme
 *
 * Returns all organizations on the platform with their owner + counts.
 * Super admin only.
 *
 * Query params:
 *   status — filter by org status (pending_approval | approved | rejected | suspended)
 *   plan   — filter by plan (free | pro | enterprise | ...)
 *   q      — search org name/slug
 */
export async function GET(req: NextRequest) {
  const ctx = await requireSuperAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const plan = url.searchParams.get("plan");
  const q = url.searchParams.get("q")?.trim();

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (plan) where.plan = plan;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { slug: { contains: q } },
    ];
  }

  const orgs = await db.organization.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          memberships: true,
          sessions: true,
          apiKeys: true,
          customApis: true,
        },
      },
    },
    take: 200,
  });

  // Fetch the owner (first membership with role=owner) for each org in one shot.
  const ownerMemberships = await db.membership.findMany({
    where: {
      orgId: { in: orgs.map((o) => o.id) },
      role: "owner",
    },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  const ownerByOrg = new Map(ownerMemberships.map((m) => [m.orgId, m.user]));

  return NextResponse.json({
    orgs: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      status: o.status,
      rejectionReason: o.rejectionReason,
      adminNote: o.adminNote,
      planAssignedAt: o.planAssignedAt,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      seatsTotal: o.seatsTotal,
      seatsUsed: o._count.memberships,
      counts: {
        members: o._count.memberships,
        sessions: o._count.sessions,
        apiKeys: o._count.apiKeys,
        customApis: o._count.customApis,
      },
      owner: ownerByOrg.get(o.id) ?? null,
    })),
  });
}
