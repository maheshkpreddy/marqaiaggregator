import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

/**
 * GET /api/admin/plans
 *   — Super admin: returns ALL plans (including inactive).
 *   — Authenticated non-super-admin: returns only active, publicVisible plans
 *     (used by the public pricing matrix / signup flow).
 *   — Unauthenticated: same as above (public catalog).
 *
 * POST /api/admin/plans
 *   — Super admin only. Create a new subscription plan.
 */
export async function GET() {
  const ctx = await requireSuperAdmin().catch(() => null);
  const isSuperAdmin = ctx && !(ctx instanceof NextResponse) && ctx.isSuperAdmin;

  const plans = await db.subscriptionPlan.findMany({
    where: isSuperAdmin ? {} : { active: true, publicVisible: true },
    orderBy: [{ sortOrder: "asc" }, { priceMonthlyUsd: "asc" }],
  });

  return NextResponse.json({
    plans: plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      priceMonthlyUsd: p.priceMonthlyUsd,
      seatsIncluded: p.seatsIncluded,
      requestsPerMonth: p.requestsPerMonth,
      features: p.features.split(",").map((s) => s.trim()).filter(Boolean),
      publicVisible: p.publicVisible,
      sortOrder: p.sortOrder,
      active: p.active,
    })),
  });
}

export async function POST(req: NextRequest) {
  const ctx = await requireSuperAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { code, name, description, priceMonthlyUsd, seatsIncluded, requestsPerMonth, features, publicVisible, sortOrder, active } = body ?? {};

  if (!code || typeof code !== "string" || !/^[a-z0-9_-]+$/i.test(code)) {
    return NextResponse.json({ error: "Plan code must be a non-empty slug (letters, digits, _, -)" }, { status: 400 });
  }
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Plan name is required" }, { status: 400 });
  }

  const existing = await db.subscriptionPlan.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: "A plan with that code already exists" }, { status: 409 });
  }

  const plan = await db.subscriptionPlan.create({
    data: {
      code,
      name,
      description: typeof description === "string" ? description : null,
      priceMonthlyUsd: typeof priceMonthlyUsd === "number" ? priceMonthlyUsd : 0,
      seatsIncluded: typeof seatsIncluded === "number" ? seatsIncluded : 5,
      requestsPerMonth: typeof requestsPerMonth === "number" ? requestsPerMonth : 0,
      features: Array.isArray(features) ? features.join(",") : typeof features === "string" ? features : "chat,compare,agents,custom-api",
      publicVisible: typeof publicVisible === "boolean" ? publicVisible : true,
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      active: typeof active === "boolean" ? active : true,
    },
  });

  return NextResponse.json({ plan });
}
