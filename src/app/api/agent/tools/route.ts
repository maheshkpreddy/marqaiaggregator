import { NextResponse } from "next/server";
import { TOOLS } from "@/lib/tools";

/**
 * GET /api/agent/tools
 * Returns the list of tools the agent can call, with their descriptions
 * and signatures. Useful for rendering the tools panel in the UI.
 */
export async function GET() {
  const tools = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    signature: t.signature,
    examples: t.examples,
  }));
  return NextResponse.json({ tools });
}
