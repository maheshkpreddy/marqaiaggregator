/**
 * Seed Marq AI Aggregator with default providers + a demo org/user so the
 * freshly-deployed app is immediately usable. Run with:
 *   bun run /home/z/my-project/scripts/seed.ts
 *
 * If a demo user already exists, this script is idempotent — it only
 * creates what's missing.
 */
import { db } from "../src/lib/db";
import { AGENT_TEMPLATES } from "../src/lib/agent-templates";
import { hashPassword, slugify } from "../src/lib/auth";

async function main() {
  console.log("Seeding Marq AI Aggregator default providers...");

  // ── Demo org + user (so a fresh Vercel deploy is immediately usable) ──
  const demoEmail = "demo@marq.ai";
  let user = await db.user.findUnique({ where: { email: demoEmail } });
  if (!user) {
    const org = await db.organization.create({
      data: {
        name: "Marq Demo",
        slug: slugify("Marq Demo"),
        plan: "free",
        seatsTotal: 5,
        seatsUsed: 1,
      },
    });
    user = await db.user.create({
      data: {
        email: demoEmail,
        name: "Marq Demo",
        passwordHash: hashPassword("marq-demo-123"),
      },
    });
    await db.membership.create({
      data: { userId: user.id, orgId: org.id, role: "owner" },
    });
    console.log("  ✓ Created demo org 'Marq Demo' + demo user demo@marq.ai / marq-demo-123");
  } else {
    console.log("  ✓ Demo user already exists");
  }

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
    {
      name: "grok",
      displayName: "xAI Grok",
      description: "Grok-2, Grok-2-mini. Real-time-aware assistant with a witty, irreverent voice. OpenAI-compatible API at api.x.ai.",
      apiEndpoint: "https://api.x.ai/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["grok-2", "grok-2-mini", "grok-beta"]),
      active: true,
      priority: 3,
      color: "#1d9bf0",
      icon: "sparkles",
    },
    {
      name: "huggingface",
      displayName: "Hugging Face",
      description: "Open-source model zoo — Llama 3.1, Mistral, Phi-3, CodeLlama, BGE embeddings. Serverless Inference API for thousands of Hub models.",
      apiEndpoint: "https://api-inference.huggingface.co/models",
      apiKey: null,
      models: JSON.stringify(["meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3", "microsoft/Phi-3-mini-4k-instruct"]),
      active: true,
      priority: 4,
      color: "#ff9d00",
      icon: "bot",
    },
    {
      name: "ollama",
      displayName: "Ollama (Local)",
      description: "Run Llama 3.1, Mistral, Phi-3, and 100+ models locally on your own hardware. Privacy-first, offline-capable, OpenAI-compatible API at localhost:11434.",
      apiEndpoint: "http://localhost:11434/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["llama3.1", "mistral", "phi3", "qwen2.5", "gemma2"]),
      active: true,
      priority: 5,
      color: "#22c55e",
      icon: "hard-drive",
    },
    {
      name: "replit",
      displayName: "Replit",
      description: "Replit Code v1.5 — collaborative cloud IDE coding model tuned for short, runnable snippets with inline explanations.",
      apiEndpoint: "https://model-proxy.replit.com/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["replit-code-v1_5-3b", "replit-code-v1_5-7b"]),
      active: true,
      priority: 6,
      color: "#f26207",
      icon: "code",
    },
    {
      name: "modal",
      displayName: "Modal (Serverless)",
      description: "Serverless inference platform — package any model as a scalable Modal function. OpenAI-compatible gateway for custom-deployed models.",
      apiEndpoint: "https://modal.com/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["marq-modal-default", "llama-3.1-70b-modal", "mixtral-8x7b-modal"]),
      active: true,
      priority: 7,
      color: "#7c3aed",
      icon: "server",
    },
    {
      name: "gradio",
      displayName: "Gradio Spaces",
      description: "Hugging Face Gradio Spaces — interactive ML demo UIs. Point the apiEndpoint at any Space's API URL to chat with its underlying model.",
      apiEndpoint: "https://api-inference.huggingface.co/spaces",
      apiKey: null,
      models: JSON.stringify(["marq-gradio-default", "whisper-gradio", "stable-diffusion-gradio"]),
      active: true,
      priority: 8,
      color: "#f97316",
      icon: "layout",
    },
    {
      name: "mlflow",
      displayName: "MLflow AI Gateway",
      description: "MLflow AI Gateway / AI Serve — route chat through your own registered and version-controlled models. OpenAI-compatible gateway for MLOps workflows.",
      apiEndpoint: "http://localhost:5000/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["marq-mlflow-default", "llama-3.1-registered", "mistral-registered"]),
      active: true,
      priority: 9,
      color: "#0ea5e9",
      icon: "database",
    },
    {
      name: "crewai",
      displayName: "CrewAI Orchestrator",
      description: "Multi-agent orchestration framework — decompose goals across role-based agents (Researcher, Analyst, Writer) and synthesize their outputs.",
      apiEndpoint: "http://localhost:8000/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["marq-crewai-orchestrator", "researcher-writer-crew", "dev-qa-ops-crew"]),
      active: true,
      priority: 10,
      color: "#ec4899",
      icon: "users",
    },
    {
      name: "langchain",
      displayName: "LangChain / LangServe",
      description: "Compose prompts, retrievers, and tools into reproducible chains. Expose any deployed LangServe endpoint as a chat provider.",
      apiEndpoint: "http://localhost:8000/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["marq-langchain-default", "rag-chain", "tool-use-chain"]),
      active: true,
      priority: 11,
      color: "#14b8a6",
      icon: "link",
    },
    {
      name: "qvac",
      displayName: "Qvac Quantum-Inspired",
      description: "Quantum-inspired parallel reasoning — explores multiple solution paths simultaneously and recommends the most defensible one.",
      apiEndpoint: "https://api.qvac.ai/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["marq-qvac-default", "qvac-reason-v1", "qvac-decide-v1"]),
      active: true,
      priority: 12,
      color: "#8b5cf6",
      icon: "atom",
    },
    {
      name: "marq_glm",
      displayName: "Marq GLM (Built-in)",
      description: "Built-in real-LLM provider powered by GLM-4-Plus via the z-ai SDK. Works on Vercel automatically when ZAI_TOKEN env var is set — no API key management needed. This is the recommended default for real chat responses.",
      apiEndpoint: null,
      apiKey: null,
      models: JSON.stringify(["glm-4-plus", "glm-4-air", "glm-4-long"]),
      active: true,
      priority: -1, // highest priority — tried first by the failover engine
      color: "#3b82f6",
      icon: "sparkles",
    },
    {
      name: "zai",
      displayName: "Zai",
      description:
        "Zai (z.ai) — direct access to GLM-4-Plus, GLM-4-Air, and GLM-4-Long models via the official z.ai API. " +
        "Same backend as Marq GLM, exposed as a first-class provider so it shows up alongside OpenAI, Gemini, and Claude in the provider picker, comparison view, and guide. " +
        "Activate by setting ZAI_TOKEN (and optionally ZAI_BASE_URL) as env vars — no key management needed in the UI.",
      apiEndpoint: null,
      apiKey: null,
      models: JSON.stringify(["glm-4-plus", "glm-4-air", "glm-4-long", "glm-4-flash"]),
      active: true,
      priority: 13,
      color: "#0ea5e9",
      icon: "sparkles",
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
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Seed failed:", e?.message ?? e);
    // Exit 0 even on error so Vercel build doesn't fail just because seeding
    // had a transient issue (e.g. DB connection limit). The build script
    // already prints a warning; the user can re-run `bun run seed` later.
    process.exit(0);
  })
  .finally(async () => {
    try { await db.$disconnect(); } catch {}
  });
