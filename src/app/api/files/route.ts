import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/**
 * GET /api/files
 * Lists files for the active org.
 */
export async function GET() {
  const ctx = await requireRole("viewer");
  if (ctx instanceof NextResponse) return ctx;

  const files = await db.fileUpload.findMany({
    where: { orgId: ctx.org.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      filename: true,
      contentType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ files });
}

/**
 * POST /api/files
 * Multipart form: file=...
 *
 * Stores the file under /home/z/my-project/uploads/<orgId>/<random>.<ext>
 * (or /tmp on Vercel). For production with large files, swap this for
 * Vercel Blob (`@vercel/blob`) — the storageKey field is the abstraction
 * boundary.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("member");
  if (ctx instanceof NextResponse) return ctx;

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart/form-data with a 'file' field" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded. Use field name 'file'." }, { status: 400 });
  }

  // 25 MB cap
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "bin").toLowerCase();
  const storageKey = `${ctx.org.id}/${randomBytes(8).toString("hex")}.${ext}`;

  // Pick a writable base dir: /tmp on Vercel, project uploads/ locally.
  const baseDir = process.env.VERCEL ? "/tmp/marq-uploads" : join(process.cwd(), "uploads");
  const fullPath = join(baseDir, storageKey);
  await mkdir(join(baseDir, ctx.org.id), { recursive: true }).catch(() => {});
  await writeFile(fullPath, buf);

  const record = await db.fileUpload.create({
    data: {
      orgId: ctx.org.id,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      storageKey,
      uploadedBy: ctx.user.id,
    },
  });

  return NextResponse.json({
    file: {
      id: record.id,
      filename: record.filename,
      contentType: record.contentType,
      sizeBytes: record.sizeBytes,
      createdAt: record.createdAt,
    },
  }, { status: 201 });
}
