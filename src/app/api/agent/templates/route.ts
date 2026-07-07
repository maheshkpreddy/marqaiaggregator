import { NextResponse } from "next/server";
import { AGENT_TEMPLATES } from "@/lib/agent-templates";
import { getToolsByNames } from "@/lib/tools";

/**
 * GET /api/agent/templates
 * Returns all available agent templates with their tools, personas, and
 * suggested goals. Used by the Agent tab UI to render the template picker.
 */
export async function GET() {
  const templates = AGENT_TEMPLATES.map((t) => ({
    key: t.key,
    displayName: t.displayName,
    tagline: t.tagline,
    description: t.description,
    icon: t.icon,
    color: t.color,
    category: t.category,
    defaultMaxSteps: t.defaultMaxSteps,
    tools: getToolsByNames(t.tools).map((tool) => ({
      name: tool.name,
      description: tool.description,
      signature: tool.signature,
    })),
    suggestedGoals: t.suggestedGoals,
  }));
  return NextResponse.json({ templates });
}
