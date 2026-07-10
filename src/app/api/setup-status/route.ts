import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnvApiKey } from "@/lib/providers";

/**
 * GET /api/setup-status
 *
 * Returns a quick summary of which providers are "live" (have a real API key
 * from the DB or an env var) vs "demo" (no key configured). This helps users
 * verify their Vercel env vars are being picked up correctly.
 *
 * No auth required — this endpoint only reveals which env vars are SET (bool),
 * not their values. Safe to expose.
 */
export async function GET() {
  const providers = await db.provider.findMany({
    where: { active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      displayName: true,
      priority: true,
      apiKey: true,
    },
  });

  const result = providers.map((p) => {
    // marq_free is always live — uses Pollinations.ai free no-auth endpoint.
    if (p.name === "marq_free") {
      return {
        id: p.id,
        name: p.name,
        displayName: p.displayName,
        priority: p.priority,
        isLive: true,
        keySource: "always_on" as const,
        envVarHint: null,
      };
    }
    const envKey = getEnvApiKey(p.name);
    const hasDbKey = !!p.apiKey;
    const hasEnvKey = !!envKey;
    const hasZaiToken = !!(process.env.ZAI_TOKEN || process.env.ZAI_API_TOKEN);
    const usesZaiToken = p.name === "marq_glm" || p.name === "zai";
    const isLive = hasDbKey || hasEnvKey ||
      (usesZaiToken && hasZaiToken);

    return {
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      priority: p.priority,
      isLive,
      keySource: hasDbKey ? "database" : hasEnvKey ? "env_var" :
        (usesZaiToken && hasZaiToken) ? "env_var" : null,
      envVarHint: envVarHintFor(p.name),
    };
  });

  const liveCount = result.filter((r) => r.isLive).length;
  const demoCount = result.length - liveCount;

  return NextResponse.json({
    total: result.length,
    live: liveCount,
    demo: demoCount,
    anyLive: liveCount > 0,
    providers: result,
  });
}

function envVarHintFor(name: string): string | null {
  if (name === "openai") return "OPENAI_API_KEY";
  if (name === "gemini") return "GEMINI_API_KEY or GOOGLE_AI_API_KEY";
  if (name === "claude") return "ANTHROPIC_API_KEY";
  if (name === "grok") return "XAI_API_KEY or GROK_API_KEY";
  if (name === "huggingface") return "HF_API_KEY or HUGGINGFACE_API_KEY";
  if (name === "marq_glm" || name === "zai") return "ZAI_TOKEN";
  return `${name.toUpperCase()}_API_KEY`;
}
