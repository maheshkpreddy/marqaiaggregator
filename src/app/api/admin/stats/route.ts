import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

/**
 * GET /api/admin/stats
 *
 * Returns high-level platform metrics for the super admin dashboard:
 *   - Total orgs + breakdown by status (pending/approved/rejected/suspended)
 *   - Total users + breakdown by global role
 *   - Total chat sessions, agent tasks, API keys
 *   - Plan distribution across approved orgs
 *
 * Super admin only.
 */
export async function GET() {
  const ctx = await requireSuperAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const [
    totalOrgs,
    pendingOrgs,
    approvedOrgs,
    rejectedOrgs,
    suspendedOrgs,
    totalUsers,
    superAdmins,
    suspendedUsers,
    totalSessions,
    totalAgentTasks,
    totalApiKeys,
    totalCustomApis,
    planDistributionRaw,
  ] = await Promise.all([
    db.organization.count(),
    db.organization.count({ where: { status: "pending_approval" } }),
    db.organization.count({ where: { status: "approved" } }),
    db.organization.count({ where: { status: "rejected" } }),
    db.organization.count({ where: { status: "suspended" } }),
    db.user.count(),
    db.user.count({ where: { globalRole: "super_admin" } }),
    db.user.count({ where: { NOT: { suspendedAt: null } } }),
    db.chatSession.count(),
    db.agentTask.count(),
    db.apiKey.count(),
    db.customApiConfig.count(),
    db.organization.groupBy({
      by: ["plan", "status"],
      where: { status: "approved" },
      _count: { _all: true },
    }),
  ]);

  // Reshape plan distribution into a flat map: { free: 5, pro: 3, enterprise: 1 }
  const planDistribution: Record<string, number> = {};
  for (const row of planDistributionRaw) {
    planDistribution[row.plan] = (planDistribution[row.plan] ?? 0) + row._count._all;
  }

  return NextResponse.json({
    orgs: {
      total: totalOrgs,
      pending: pendingOrgs,
      approved: approvedOrgs,
      rejected: rejectedOrgs,
      suspended: suspendedOrgs,
    },
    users: {
      total: totalUsers,
      superAdmins,
      suspended: suspendedUsers,
    },
    activity: {
      chatSessions: totalSessions,
      agentTasks: totalAgentTasks,
      apiKeys: totalApiKeys,
      customApis: totalCustomApis,
    },
    planDistribution,
  });
}
