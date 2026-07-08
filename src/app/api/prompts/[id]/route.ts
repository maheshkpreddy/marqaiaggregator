import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

/**
 * PATCH /api/prompts/{id}
 * Body: { title?, body?, category?, tags? }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.prompt.findUnique({ where: { id } });
  if (!existing || existing.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "Prompt not found in this org" }, { status: 404 });
  }

  const requestBody = await req.json().catch(() => ({}));
  const { title, body, category, tags } = requestBody ?? {};

  const updated = await db.prompt.update({
    where: { id },
    data: {
      ...(typeof title === "string" ? { title: title.trim() } : {}),
      ...(typeof body === "string" ? { body } : {}),
      ...(typeof category === "string" ? { category: category.trim() } : {}),
      ...(Array.isArray(tags) ? { tags: tags.join(",") } : typeof tags === "string" ? { tags } : {}),
    },
  });

  return NextResponse.json({ prompt: updated });
}

/**
 * DELETE /api/prompts/{id}
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.prompt.findUnique({ where: { id } });
  if (!existing || existing.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "Prompt not found in this org" }, { status: 404 });
  }

  await db.prompt.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
