/**
 * Seed Marq AI Aggregator with default providers + sample agent tasks.
 * Run with: bun run /home/z/my-project/scripts/seed.ts
 */
import { db } from "../src/lib/db";
import { AGENT_TEMPLATES } from "../src/lib/agent-templates";

async function main() {
  console.log("Seeding Marq AI Aggregator default providers...");

  const providers = [
    {
      name: "openai",
      displayName: "OpenAI",
      description: "GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo and o-series reasoning models. Strong general-purpose reasoning, code generation, and tool use.",
      apiEndpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "o1-mini"]),
      active: true,
      priority: 0,
      color: "#10a37f",
      icon: "openai",
    },
    {
      name: "gemini",
      displayName: "Google Gemini",
      description: "Gemini 2.0 Flash, Gemini 1.5 Pro. Long-context multimodal reasoning, strong at grounded factual answers and code.",
      apiEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
      apiKey: null,
      models: JSON.stringify(["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"]),
      active: true,
      priority: 1,
      color: "#4285f4",
      icon: "gemini",
    },
    {
      name: "claude",
      displayName: "Anthropic Claude",
      description: "Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku. Excellent for long-form writing, careful reasoning, and safety-aligned tasks.",
      apiEndpoint: "https://api.anthropic.com/v1/messages",
      apiKey: null,
      models: JSON.stringify(["claude-3-5-sonnet", "claude-3-opus", "claude-3-haiku"]),
      active: true,
      priority: 2,
      color: "#d97757",
      icon: "claude",
    },
  ];

  for (const p of providers) {
    const existing = await db.provider.findUnique({ where: { name: p.name } });
    if (existing) {
      await db.provider.update({ where: { name: p.name }, data: p });
      console.log(`  ✓ Updated: ${p.displayName}`);
    } else {
      await db.provider.create({ data: p });
      console.log(`  ✓ Created: ${p.displayName}`);
    }
  }

  // Create a default welcome session if none exists.
  const sessionCount = await db.chatSession.count();
  if (sessionCount === 0) {
    const session = await db.chatSession.create({
      data: { title: "Welcome to Marq AI" },
    });
    await db.message.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content:
          "Hi! I'm Marq AI — your unified gateway to OpenAI, Gemini, and Claude. " +
          "Send a message below and I'll route it through your primary provider. " +
          "If that provider fails, I'll automatically fall over to the next one in your priority list. " +
          "Try asking something to see it in action!",
      },
    });
    console.log("  ✓ Created welcome session");
  }

  // Seed one agent task per template (skipping "general" to avoid duplicates
  // if the user already ran the agent before). These give the Agent tab a
  // populated history on first load so users can see what each persona does.
  const existingTasks = await db.agentTask.count();
  if (existingTasks === 0) {
    console.log("  Seeding sample agent tasks per template...");
    const openaiProvider = await db.provider.findUnique({ where: { name: "openai" } });
    const primaryProviderId = openaiProvider?.id ?? null;

    // Pick the first suggested goal for each template as the seeded task.
    for (const tpl of AGENT_TEMPLATES) {
      if (tpl.key === "general") continue; // skip — user will run their own
      const goal = tpl.suggestedGoals[0];
      if (!goal) continue;
      await db.agentTask.create({
        data: {
          title: goal.slice(0, 60) + (goal.length > 60 ? "…" : ""),
          goal,
          agentType: tpl.key,
          maxSteps: tpl.defaultMaxSteps,
          primaryProviderId,
          // Mark as pending so the user can run it themselves to see the
          // template in action. (We deliberately don't auto-run on seed.)
          status: "pending",
        },
      });
      console.log(`    ✓ ${tpl.displayName}: seeded "${goal.slice(0, 50)}…"`);
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
