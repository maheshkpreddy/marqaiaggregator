import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authApiKey } from "@/lib/auth";

/**
 * GET /api/v1/models
 *
 * OpenAI-compatible /v1/models endpoint. Lists all active providers and
 * the models configured on each. Useful for clients that want to enumerate
 * before calling /v1/chat/completions.
 */
export async function GET(req: NextRequest) {
  const auth = await authApiKey(req, "read");
  if (auth instanceof NextResponse) return auth;

  const providers = await db.provider.findMany({
    where: { active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  const data: any[] = [];
  for (const p of providers) {
    let models: string[] = [];
    try { models = JSON.parse(p.models); } catch {}
    for (const m of models) {
      data.push({
        id: `${p.name}/${m}`,
        object: "model",
        created: Math.floor(p.createdAt.getTime() / 1000),
        owned_by: p.name,
        marq: {
          provider: p.name,
          displayName: p.displayName,
          priority: p.priority,
          model: m,
        },
      });
    }
  }

  return NextResponse.json({ object: "list", data });
}
