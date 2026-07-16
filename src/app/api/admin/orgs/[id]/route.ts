import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

/**
 * PATCH /api/admin/orgs/[id]
 * Body: {
 *   status?:           "pending_approval" | "approved" | "rejected" | "suspended"
 *   plan?:             "free" | "starter" | "pro" | "enterprise" | "custom"
 *   seatsTotal?:       number  (override the seat cap for the org)
 *   rejectionReason?:  string  (required when status === "rejected")
 *   adminNote?:        string  (free-text note for the super admin)
 * }
 *
 * Super admin only. Used during the approval workflow:
 *   - Approve a pending org (sets status = approved, plan = whatever they chose)
 *   - Reject a pending org (sets status = rejected, requires rejectionReason)
 *   - Suspend an approved org (e.g. billing issue)
 *   - Re-assign the subscription plan at any time
 *   - Adjust the seat cap (e.g. for negotiated enterprise deals)
 *
 * Returns the updated org.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSuperAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status, plan, seatsTotal, rejectionReason, adminNote } = body ?? {};

  const data: Record<string, unknown> = {};
  const validStatuses = ["pending_approval", "approved", "rejected", "suspended"];
  const validPlans = ["free", "starter", "pro", "enterprise", "custom"];

  if (status !== undefined) {
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Allowed: ${validStatuses.join(", ")}` }, { status: 400 });
    }
    data.status = status;
    if (status === "rejected") {
      data.rejectionReason = typeof rejectionReason === "string" ? rejectionReason.slice(0, 500) : "Not specified";
    }
    if (status === "approved") {
      // Clear rejection reason if re-approving.
      data.rejectionReason = null;
    }
  }

  if (plan !== undefined) {
    if (!validPlans.includes(plan)) {
      return NextResponse.json({ error: `Invalid plan. Allowed: ${validPlans.join(", ")}` }, { status: 400 });
    }
    data.plan = plan;
    data.planAssignedAt = new Date();
  }

  if (seatsTotal !== undefined) {
    if (typeof seatsTotal !== "number" || seatsTotal < 1 || seatsTotal > 100000) {
      return NextResponse.json({ error: "seatsTotal must be a number between 1 and 100000" }, { status: 400 });
    }
    data.seatsTotal = seatsTotal;
  }

  if (adminNote !== undefined) {
    data.adminNote = typeof adminNote === "string" ? adminNote.slice(0, 1000) : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update. Send status, plan, seatsTotal, rejectionReason, or adminNote." }, { status: 400 });
  }

  const existing = await db.organization.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // If assigning a plan, pull the SubscriptionPlan defaults for seats.
  if (plan && plan !== existing.plan) {
    const planConfig = await db.subscriptionPlan.findUnique({ where: { code: plan } });
    if (planConfig && seatsTotal === undefined) {
      // Only auto-set seatsTotal if the super admin didn't manually override it.
      data.seatsTotal = planConfig.seatsIncluded;
    }
  }

  const updated = await db.organization.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    org: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      plan: updated.plan,
      status: updated.status,
      rejectionReason: updated.rejectionReason,
      adminNote: updated.adminNote,
      seatsTotal: updated.seatsTotal,
      planAssignedAt: updated.planAssignedAt,
      updatedAt: updated.updatedAt,
    },
  });
}
