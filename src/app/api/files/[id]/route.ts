import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * GET /api/files/{id}
 * Downloads a file's bytes. Scoped by org.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRole("viewer");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const file = await db.fileUpload.findUnique({ where: { id } });
  if (!file || file.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const baseDir = process.env.VERCEL ? "/tmp/marq-uploads" : join(process.cwd(), "uploads");
  const buf = await readFile(join(baseDir, file.storageKey)).catch(() => null);
  if (!buf) {
    return NextResponse.json({ error: "File content missing (may have been evicted from ephemeral storage)" }, { status: 410 });
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename.replace(/"/g, "'")}"`,
      "Content-Length": String(buf.length),
    },
  });
}

/**
 * DELETE /api/files/{id}
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const file = await db.fileUpload.findUnique({ where: { id } });
  if (!file || file.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await db.fileUpload.delete({ where: { id } });
  // Best-effort delete the file on disk; ignore errors.
  const baseDir = process.env.VERCEL ? "/tmp/marq-uploads" : join(process.cwd(), "uploads");
  await import("fs/promises").then((fs) => fs.unlink(join(baseDir, file.storageKey)).catch(() => {}));

  return NextResponse.json({ ok: true });
}
