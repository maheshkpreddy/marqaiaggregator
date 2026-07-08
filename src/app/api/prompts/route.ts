import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

/**
 * GET /api/prompts?category=&q=
 * Returns prompts for the active org, optionally filtered.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireRole("viewer");
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const q = url.searchParams.get("q");

  const prompts = await db.prompt.findMany({
    where: {
      orgId: ctx.org.id,
      ...(category && category !== "all" ? { category } : {}),
      ...(q ? { title: { contains: q } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ prompts });
}

/**
 * POST /api/prompts
 * Body: { title, body, category?, tags? }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { title, body: promptBody, category, tags } = body ?? {};
  if (!title || typeof title !== "string" || title.trim().length < 1) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!promptBody || typeof promptBody !== "string" || promptBody.trim().length < 1) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const prompt = await db.prompt.create({
    data: {
      orgId: ctx.org.id,
      title: title.trim(),
      body: promptBody,
      category: category?.trim() || "general",
      tags: Array.isArray(tags) ? tags.join(",") : (typeof tags === "string" ? tags : ""),
      createdBy: ctx.user.id,
    },
  });

  return NextResponse.json({ prompt }, { status: 201 });
}
