import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

/**
 * GET /api/admin/users?q=jane&superAdmin=true
 *
 * Returns all users on the platform with their org memberships.
 * Super admin only.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireSuperAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const superAdminOnly = url.searchParams.get("superAdmin") === "true";
  const suspendedOnly = url.searchParams.get("suspended") === "true";

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { email: { contains: q } },
      { name: { contains: q } },
    ];
  }
  if (superAdminOnly) where.globalRole = "super_admin";
  if (suspendedOnly) where.NOT = { suspendedAt: null };

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      memberships: {
        include: {
          org: { select: { id: true, name: true, slug: true, plan: true, status: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    take: 200,
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      globalRole: u.globalRole,
      isSuperAdmin: u.globalRole === "super_admin",
      suspendedAt: u.suspendedAt,
      createdAt: u.createdAt,
      memberships: u.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        org: m.org,
      })),
    })),
  });
}
