import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/providers/[id]
 * Update provider fields. Body: any subset of { displayName, description, apiEndpoint, apiKey, models, active, priority, color, icon }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.displayName !== undefined) data.displayName = body.displayName;
  if (body.description !== undefined) data.description = body.description;
  if (body.apiEndpoint !== undefined) data.apiEndpoint = body.apiEndpoint;
  if (body.apiKey !== undefined) data.apiKey = body.apiKey || null;
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.priority !== undefined) data.priority = Number(body.priority);
  if (body.color !== undefined) data.color = body.color;
  if (body.icon !== undefined) data.icon = body.icon;
  if (Array.isArray(body.models)) data.models = JSON.stringify(body.models);

  const updated = await db.provider.update({ where: { id }, data });
  return NextResponse.json({ provider: updated });
}

/**
 * DELETE /api/providers/[id]
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.provider.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
