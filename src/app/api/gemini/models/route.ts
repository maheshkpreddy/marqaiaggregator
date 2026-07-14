import { NextResponse } from "next/server";
import { CURATED_MODELS } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/gemini/models
 *
 * Returns the curated list of Gemini models we expose in the UI.
 * The full /models list from Google is huge and contains many deprecated
 * entries; we hand-pick the stable, useful ones.
 */
export async function GET() {
  return NextResponse.json({
    models: CURATED_MODELS,
    default: CURATED_MODELS[0]?.name ?? "gemini-2.5-flash",
  });
}
