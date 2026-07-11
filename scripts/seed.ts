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
  let demoOrgId: string;
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
    demoOrgId = org.id;
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
    // Look up the demo org via the user's owner membership.
    const ownerMembership = await db.membership.findFirst({
      where: { userId: user.id, role: "owner" },
    });
    demoOrgId = ownerMembership?.orgId ?? "";
    console.log("  ✓ Demo user already exists");
  }

  const providers = [
    // ── TIER 1 — Open-source / free providers (tried first in auto mode) ──
    // These providers don't require per-token billing. marq_free is always
    // available (Pollinations anonymous tier); the rest are open-source
    // frameworks / packages / models that work without paid API keys.
    {
      name: "marq_free",
      displayName: "Marq Free (Always-On)",
      description: "Marq Free — the platform's GUARANTEED-AVAILABILITY provider backed by Pollinations.ai. No API key required, no rate limits to worry about. Uses open-source models (gpt-oss-20b and others) to deliver real AI responses when every paid provider is down or rate-limited. Seeded at the HIGHEST priority so the failover engine tries it FIRST in auto mode — ensuring the platform responds fast and never throws a fallback error to the user.",
      apiEndpoint: "https://text.pollinations.ai/openai",
      apiKey: null,
      models: JSON.stringify(["openai", "openai-large", "mistral", "qwen-coder"]),
      active: true,
      priority: 0,
      color: "#10b981",
      icon: "shield",
    },
    {
      name: "huggingface",
      displayName: "Hugging Face",
      description: "Open-source model zoo — Llama 3.1, Mistral, Phi-3, CodeLlama, BGE embeddings. Serverless Inference API for thousands of Hub models. Free anonymous tier available.",
      apiEndpoint: "https://api-inference.huggingface.co/models",
      apiKey: null,
      models: JSON.stringify(["meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3", "microsoft/Phi-3-mini-4k-instruct"]),
      active: true,
      priority: 1,
      color: "#ff9d00",
      icon: "bot",
    },
    {
      name: "ollama",
      displayName: "Ollama (Local)",
      description: "Run Llama 3.1, Mistral, Phi-3, and 100+ models locally on your own hardware. Privacy-first, offline-capable, OpenAI-compatible API at localhost:11434.",
      apiEndpoint: "http://localhost:11434/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["llama3.1", "mistral", "phi3", "qwen2.5", "gemma2", "deepseek-r1"]),
      active: true,
      priority: 2,
      color: "#22c55e",
      icon: "hard-drive",
    },
    {
      name: "vllm",
      displayName: "vLLM",
      description: "High-throughput LLM serving with PagedAttention — production inference for Llama, Mistral, Qwen, DeepSeek, and more. OpenAI-compatible API server. 2-4x throughput vs. naive serving.",
      apiEndpoint: "http://localhost:8000/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["llama3.1-8b", "llama3.1-70b", "mistral-7b", "qwen2.5-7b", "deepseek-r1", "codeqwen-7b"]),
      active: true,
      priority: 3,
      color: "#22c55e",
      icon: "server",
    },
    {
      name: "llama",
      displayName: "Llama (Meta AI)",
      description: "Meta's open-weight LLM family — the foundation of the open-source LLM ecosystem. Sizes from 1B to 405B params. Multimodal (Llama 3.2 Vision). Run via Ollama, vLLM, TGI, or HF Transformers. Open weights = auditability + zero per-token cost when self-hosted.",
      apiEndpoint: "http://localhost:11434/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["llama-3.1-8b", "llama-3.1-70b", "llama-3.1-405b", "llama-3.2-1b", "llama-3.2-3b", "llama-3.2-11b-vision", "llama-3.3-70b"]),
      active: true,
      priority: 4,
      color: "#0668e1",
      icon: "sparkles",
    },
    {
      name: "transformers",
      displayName: "Transformers (HF)",
      description: "Hugging Face Transformers library — run 500K+ pretrained models locally. Pipelines for text generation, classification, translation, summarization, vision, and audio. Trainer API for fine-tuning. Apache 2.0 license.",
      apiEndpoint: "http://localhost:8080/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3", "Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/deepseek-r1"]),
      active: true,
      priority: 5,
      color: "#ffd21e",
      icon: "boxes",
    },
    {
      name: "pytorch",
      displayName: "PyTorch",
      description: "Open-source tensor library — the foundation of modern deep learning. Flexible eager execution, GPU + TPU support, distributed training. Industry standard for ML research. Wrap with TorchServe to expose as a chat provider.",
      apiEndpoint: "http://localhost:8080/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["custom (your trained model)"]),
      active: true,
      priority: 6,
      color: "#ee4c2c",
      icon: "flask-conical",
    },
    {
      name: "tensorflow",
      displayName: "TensorFlow",
      description: "End-to-end ML platform from Google — from research to production at scale. TF Serving for production, TF Lite for mobile, TF.js for browser. TPU-optimized. Wrap with TF Serving to expose as a chat provider.",
      apiEndpoint: "http://localhost:8501/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["custom (your trained model)"]),
      active: true,
      priority: 7,
      color: "#ff6f00",
      icon: "flask-conical",
    },
    {
      name: "keras",
      displayName: "Keras",
      description: "High-level neural network API — friendly interface over TensorFlow, JAX, and PyTorch (Keras 3). Beginner-friendly, rapid prototyping. Educational resource for new ML hires.",
      apiEndpoint: "http://localhost:8080/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["custom (your Keras model)"]),
      active: true,
      priority: 8,
      color: "#d00000",
      icon: "layers",
    },
    {
      name: "opencv",
      displayName: "OpenCV",
      description: "Computer vision library — 2500+ algorithms for image and video processing. Real-time performance, cross-platform (C++, Python, Java, mobile). BSD license = commercial-friendly. Wrap with FastAPI to expose as a provider.",
      apiEndpoint: "http://localhost:8080/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["custom (Haar cascades, DNN models)"]),
      active: true,
      priority: 9,
      color: "#06a77d",
      icon: "eye",
    },
    {
      name: "scikit_learn",
      displayName: "Scikit-learn",
      description: "Classical ML library — random forests, SVMs, gradient boosting, clustering, dimensionality reduction. 30+ algorithms, pipeline + GridSearch for tuning. Interpretable models = compliance-friendly. BSD license.",
      apiEndpoint: "http://localhost:8080/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["custom (your trained sklearn model)"]),
      active: true,
      priority: 10,
      color: "#f7931e",
      icon: "flask-conical",
    },
    {
      name: "instructor",
      displayName: "Instructor",
      description: "Structured extraction from LLMs — Pydantic-powered typed outputs. Works with OpenAI, Anthropic, Gemini, Ollama. Validation + automatic retry on parse failure. Type-safe LLM outputs for production. MIT license.",
      apiEndpoint: "http://localhost:8080/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["custom (wraps your LLM client)"]),
      active: true,
      priority: 11,
      color: "#3b82f6",
      icon: "code",
    },
    {
      name: "autogen",
      displayName: "Microsoft AutoGen",
      description: "Multi-agent conversation framework from Microsoft Research. Conversational agents with roles, group chat, code execution via Docker, human-in-loop support. Research-grade agentic patterns. MIT license.",
      apiEndpoint: "http://localhost:8000/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["custom (uses any LLM as backbone)"]),
      active: true,
      priority: 12,
      color: "#0078d4",
      icon: "users",
    },
    {
      name: "crewai",
      displayName: "CrewAI Orchestrator",
      description: "Multi-agent orchestration framework — decompose goals across role-based agents (Researcher, Analyst, Writer) and synthesize their outputs. CrewAI+ hosted from $99/month.",
      apiEndpoint: "http://localhost:8000/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["marq-crewai-orchestrator", "researcher-writer-crew", "dev-qa-ops-crew"]),
      active: true,
      priority: 13,
      color: "#ec4899",
      icon: "users",
    },
    {
      name: "langchain",
      displayName: "LangChain / LangServe",
      description: "Compose prompts, retrievers, and tools into reproducible chains. Expose any deployed LangServe endpoint as a chat provider. RAG pipelines, tool-using chains, LangSmith monitoring.",
      apiEndpoint: "http://localhost:8000/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["marq-langchain-default", "rag-chain", "tool-use-chain"]),
      active: true,
      priority: 14,
      color: "#14b8a6",
      icon: "link",
    },
    {
      name: "mlflow",
      displayName: "MLflow AI Gateway",
      description: "MLflow AI Gateway / AI Serve — route chat through your own registered and version-controlled models. OpenAI-compatible gateway for MLOps workflows. A/B test model versions, audit trails.",
      apiEndpoint: "http://localhost:5000/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["marq-mlflow-default", "llama-3.1-registered", "mistral-registered"]),
      active: true,
      priority: 15,
      color: "#0ea5e9",
      icon: "database",
    },
    {
      name: "openclaw",
      displayName: "OpenClaw",
      description: "Open-source agentic framework — community-driven alternative to proprietary agent platforms. Customizable agent loops, tool calling + memory, plugin architecture. Fully self-hosted.",
      apiEndpoint: "http://localhost:8000/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["custom (uses any LLM you configure)"]),
      active: true,
      priority: 16,
      color: "#8b5cf6",
      icon: "wrench",
    },
    {
      name: "outerbounds",
      displayName: "Outerbounds",
      description: "Metaflow-based ML/AI platform — production-grade pipelines for serious ML teams. Netflix-battle-tested Metaflow. Versioning + resumability, cloud-native (k8s). Expose inference as OpenAI-compatible endpoint.",
      apiEndpoint: "http://localhost:8080/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["custom (your pipeline artifacts)"]),
      active: true,
      priority: 17,
      color: "#1e293b",
      icon: "server",
    },
    {
      name: "anaconda",
      displayName: "Anaconda Platform",
      description: "Enterprise Python data science platform — conda package + environment management, Anaconda Repository for private package hosting, Anaconda Enterprise for team collaboration. Reproducible environments, audit-ready package provenance.",
      apiEndpoint: "https://repo.anaconda.com/api",
      apiKey: null,
      models: JSON.stringify(["(package distribution \u2014 bundles PyTorch, TF, sklearn, etc.)"]),
      active: true,
      priority: 18,
      color: "#42b029",
      icon: "server",
    },
    {
      name: "gradio",
      displayName: "Gradio Spaces",
      description: "Hugging Face Gradio Spaces — interactive ML demo UIs. Point the apiEndpoint at any Space's API URL to chat with its underlying model. Great for evaluating niche models before self-hosting.",
      apiEndpoint: "https://api-inference.huggingface.co/spaces",
      apiKey: null,
      models: JSON.stringify(["marq-gradio-default", "whisper-gradio", "stable-diffusion-gradio"]),
      active: true,
      priority: 19,
      color: "#f97316",
      icon: "layout",
    },
    {
      name: "replit",
      displayName: "Replit",
      description: "Replit Code v1.5 — collaborative cloud IDE coding model tuned for short, runnable snippets with inline explanations. replit-code is open weights. OpenAI-compatible API at model-proxy.replit.com.",
      apiEndpoint: "https://model-proxy.replit.com/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["replit-code-v1_5-3b", "replit-code-v1_5-7b"]),
      active: true,
      priority: 20,
      color: "#f26207",
      icon: "code",
    },
    {
      name: "modal",
      displayName: "Modal (Serverless)",
      description: "Open-source serverless inference platform — package any model as a scalable Modal function. OpenAI-compatible gateway for custom-deployed models. Pay-per-invocation, scales to zero.",
      apiEndpoint: "https://modal.com/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["marq-modal-default", "llama-3.1-70b-modal", "mixtral-8x7b-modal"]),
      active: true,
      priority: 21,
      color: "#7c3aed",
      icon: "server",
    },
    {
      name: "marq_glm",
      displayName: "Marq GLM (Built-in)",
      description: "Built-in real-LLM provider powered by GLM-4-Plus via the z-ai SDK. Works on Vercel automatically when ZAI_TOKEN env var is set — no API key management needed.",
      apiEndpoint: null,
      apiKey: null,
      models: JSON.stringify(["glm-4-plus", "glm-4-air", "glm-4-long"]),
      active: true,
      priority: 22,
      color: "#3b82f6",
      icon: "sparkles",
    },
    {
      name: "zai",
      displayName: "Zai",
      description: "Zai (z.ai) — direct access to GLM-4-Plus, GLM-4-Air, and GLM-4-Long models via the official z.ai API. Same backend as Marq GLM. Activate by setting ZAI_TOKEN as env var.",
      apiEndpoint: null,
      apiKey: null,
      models: JSON.stringify(["glm-4-plus", "glm-4-air", "glm-4-long", "glm-4-flash"]),
      active: true,
      priority: 23,
      color: "#0ea5e9",
      icon: "sparkles",
    },
    {
      name: "mistral",
      displayName: "Mistral AI",
      description: "European frontier LLM — efficient, open-weight, GDPR-friendly. Mistral Large/Medium/Small/Nemo. Open weights for Mistral 7B / Mixtral 8x7B / 8x22B. Function calling + JSON mode. EU-hosted (La Plateforme).",
      apiEndpoint: "https://api.mistral.ai/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "open-mistral-nemo", "open-mixtral-8x22b"]),
      active: true,
      priority: 24,
      color: "#ff7000",
      icon: "wind",
    },
    {
      name: "deepseek",
      displayName: "DeepSeek",
      description: "Cost-efficient frontier LLM — strong reasoning at 1/10th the price. DeepSeek-V3, DeepSeek-R1 (reasoning rivals o1), DeepSeek-Coder. Open weights for V3 + R1. Industry-leading cost-per-token. Long context (128K).",
      apiEndpoint: "https://api.deepseek.com/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["deepseek-chat", "deepseek-reasoner", "deepseek-coder"]),
      active: true,
      priority: 25,
      color: "#4d6bfe",
      icon: "brain",
    },
    {
      name: "qwen",
      displayName: "Qwen (Alibaba Cloud)",
      description: "Alibaba's flagship LLM family — strong bilingual (EN/CN), code (Qwen-Coder rivals GPT-4o), math (Qwen-Math), long context (Qwen-Long 128K). DashScope API or self-host the open weights via vLLM/Ollama.",
      apiEndpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["qwen2.5-72b-instruct", "qwen2.5-coder-32b", "qwen2.5-math-72b", "qwen2.5-7b-instruct", "qwen-long"]),
      active: true,
      priority: 26,
      color: "#615ced",
      icon: "sparkles",
    },
    {
      name: "openai",
      displayName: "OpenAI",
      description: "GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo and o-series reasoning models. Strong general-purpose reasoning, code generation, and tool use.",
      apiEndpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "o1-mini"]),
      active: true,
      priority: 27,
      color: "#10a37f",
      icon: "openai",
    },
    {
      name: "gemini",
      displayName: "Google Gemini",
      description: "Gemini 2.5 Flash, Gemini 2.5 Pro. Long-context multimodal reasoning, strong at grounded factual answers and code.",
      apiEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
      apiKey: null,
      models: JSON.stringify(["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-lite"]),
      active: true,
      priority: 28,
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
      priority: 29,
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
      priority: 30,
      color: "#1d9bf0",
      icon: "sparkles",
    },
    {
      name: "qvac",
      displayName: "Qvac Quantum-Inspired",
      description: "Quantum-inspired parallel reasoning — explores multiple solution paths simultaneously and recommends the most defensible one.",
      apiEndpoint: "https://api.qvac.ai/v1/chat/completions",
      apiKey: null,
      models: JSON.stringify(["marq-qvac-default", "qvac-reason-v1", "qvac-decide-v1"]),
      active: true,
      priority: 31,
      color: "#8b5cf6",
      icon: "atom",
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
    // Don't pin a primary provider on seeded tasks — leave primaryProviderId
    // null so the failover engine applies the "open source first" auto-mode
    // policy (marq_free → huggingface → ollama → … → openai → claude → …).
    const primaryProviderId = null;

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

  // ── Seed sample prompts into the Prompt Library ──
  // Gives users a starter library across common categories so the Prompts
  // tab isn't empty on first load. Skipped if any prompts already exist.
  const existingPrompts = await db.prompt.count();
  if (existingPrompts === 0) {
    console.log("  Seeding sample prompts...");
    const samplePrompts = [
      // ── Writing ──
      { title: "Blog post outline generator", body: "Create a detailed outline for a blog post on the topic: {{topic}}. Include an engaging introduction, 4-6 main sections with sub-points, and a conclusion with a call-to-action. Target audience: {{audience}}. Tone: {{tone}}.", category: "writing", tags: "blog,content,marketing" },
      { title: "Email subject line A/B test", body: "Write 5 email subject lines for a campaign about {{product}}. The goal is {{goal}} (e.g. open rates, sign-ups, demo bookings). Vary the angle: curiosity, urgency, benefit, personalization, social proof. Then rank them from highest to lowest expected open rate and explain why.", category: "writing", tags: "email,marketing,ab-test" },
      { title: "Press release first draft", body: "Write a press release for {{announcement}}. Company: {{company}}. Include: a strong headline, dateline, an opening paragraph that answers who/what/when/where/why, a quote from a spokesperson, background on the company, and a boilerplate. Keep it under 400 words.", category: "writing", tags: "pr,communications,formal" },
      { title: "LinkedIn thought leadership post", body: "Write a LinkedIn post (max 1300 characters) on the topic: {{topic}}. Hook the reader in the first line, share a personal insight or contrarian take, end with a question that invites comments. Avoid buzzwords like 'synergy' and 'circle back'. Tone: professional but conversational.", category: "writing", tags: "linkedin,social,thought-leadership" },
      // ── Engineering ──
      { title: "Code review checklist generator", body: "Generate a code review checklist for a {{language}} {{framework}} pull request. Cover: correctness, security, performance, readability, test coverage, error handling, and framework-specific concerns. Output as a markdown table with columns: Check | Why it matters | Severity (blocker/warning/nit).", category: "engineering", tags: "code-review,checklist,quality" },
      { title: "Refactor for readability", body: "Refactor this {{language}} function for readability without changing behavior. Apply: meaningful names, single-responsibility helpers, early returns, comments only when intent isn't obvious. Show the before/after side by side and explain each change.\n\n```\n{{code}}\n```", category: "engineering", tags: "refactor,readability,clean-code" },
      { title: "API endpoint design review", body: "Review the design of this REST API endpoint and suggest improvements:\n\n{{endpoint_description}}\n\nEvaluate against REST best practices: resource naming, HTTP methods, status codes, versioning, pagination, error format, and idempotency. Output: a list of findings with severity (blocker/warning/suggestion) and a recommended fix.", category: "engineering", tags: "api,rest,design" },
      { title: "Test case generator", body: "Generate test cases for this {{language}} function:\n\n```\n{{code}}\n```\n\nCover: happy path, edge cases (empty/null/large inputs), error cases, boundary conditions, and any concurrency concerns. Output as a {{test_framework}} test file with descriptive test names.", category: "engineering", tags: "testing,qa,unit-tests" },
      // ── Analysis ──
      { title: "SWOT analysis", body: "Conduct a SWOT analysis for {{subject}}. For each quadrant (Strengths, Weaknesses, Opportunities, Threats), list 4-5 specific, evidence-backed points. Then synthesize: which 2 strategic moves does the SWOT suggest, and why?", category: "analysis", tags: "strategy,swot,business" },
      { title: "Competitor feature matrix", body: "Build a competitor feature matrix for {{product_category}}. Compare {{our_product}} against {{competitor_1}} and {{competitor_2}} across 8-10 features that matter to buyers. Use ✓ / ✗ / ~ (partial) for each cell, then write a 1-paragraph takeaway on where we win and where we lose.", category: "analysis", tags: "competitive,matrix,product" },
      { title: "Root cause analysis (5 Whys)", body: "Run a 5 Whys root cause analysis on this incident:\n\nIncident: {{incident_description}}\n\nFor each 'Why', give the most likely answer based on the previous layer. End with the identified root cause and a proposed fix that addresses the root cause (not just the symptom).", category: "analysis", tags: "rca,incident,postmortem" },
      { title: "Data summary + insights", body: "Summarize this dataset and surface 3 actionable insights:\n\n{{data_sample}}\n\nFor each insight, explain: (1) what the data shows, (2) why it matters for the business, (3) a recommended action. Be specific — avoid generic advice.", category: "analysis", tags: "data,insights,reporting" },
      // ── Business ──
      { title: "Pricing tier designer", body: "Design 3 pricing tiers for {{product}}. Target customer: {{target_customer}}. For each tier, specify: name, price, included features, feature limits, and the buyer persona it's designed for. End with a recommendation on which tier should be the default and why.", category: "sales", tags: "pricing,monetization,strategy" },
      { title: "Sales discovery call script", body: "Write a discovery call script for a sales rep calling {{persona}} at {{company_type}} companies. Include: opener (30s), 5-7 discovery questions in order (pain → impact → capability → decision), a demo transition, and a close for next steps. Keep it under 800 words.", category: "sales", tags: "sales,discovery,script" },
      { title: "Customer success onboarding plan", body: "Create a 30-60-90 day onboarding plan for a new customer of {{product}}. Customer segment: {{segment}}. For each phase, list: goals, key activities, success metrics, and red flags that should trigger an escalation. Format as a table.", category: "business", tags: "customer-success,onboarding,retention" },
      { title: "OKR draft for a team", body: "Draft 3 Objectives with 3 Key Results each for the {{team}} team in Q{{quarter}}. Each Objective should be inspirational and time-bound. Each Key Result should be measurable with a clear starting baseline and target. Avoid activity-based KRs — focus on outcomes.", category: "business", tags: "okr,goals,planning" },
      // ── Creative ──
      { title: "Product naming brainstorm", body: "Brainstorm 15 name candidates for a new {{product_type}} targeting {{audience}}. Mix categories: descriptive, evocative, invented, founder-name, and metaphorical. For each, note whether the .com is likely available and any obvious trademark concerns. End with your top 3 picks and why.", category: "creative", tags: "naming,branding,brainstorm" },
      { title: "Tagline generator", body: "Write 10 tagline options for {{brand}}. Brand promise: {{promise}}. Audience: {{audience}}. Vary the structure: benefit-led, aspiration-led, contrast-led, question-led, and short/punchy. Then rank them from strongest to weakest and explain the top pick.", category: "creative", tags: "tagline,branding,copy" },
      { title: "Customer story narrative", body: "Turn this raw customer feedback into a 250-word case study narrative:\n\n{{feedback}}\n\nStructure: challenge → solution → results. Use specific numbers where the feedback provides them. Keep the customer's voice — quote them at least once. End with a forward-looking sentence.", category: "creative", tags: "case-study,storytelling,marketing" },
      // ── Agent task starters ──
      { title: "Agent: research a topic", body: "Research {{topic}} and produce a 1-page brief. Cover: definition, why it matters now, 3 key trends, 2-3 notable companies/people, and 2 open questions. Cite sources where possible.", category: "general", tags: "agent,research,brief" },
      { title: "Agent: write a function with tests", body: "Write a {{language}} function that {{does_what}}. Include: the function, comprehensive unit tests using {{test_framework}}, a brief docstring explaining inputs/outputs/edge cases, and a usage example. Make sure the tests cover at least: happy path, empty input, null/invalid input, and a boundary case.", category: "general", tags: "agent,code,testing" },
      { title: "Agent: incident response plan", body: "Create an incident response plan for {{scenario}}. Include: severity classification (SEV1-SEV4), the on-call escalation tree, a communication template for stakeholders, a step-by-step mitigation playbook, and a post-incident review checklist.", category: "general", tags: "agent,incident,ops" },
      // ── Prompts for AI Directory use ──
      { title: "Compare model responses side-by-side", body: "Use the Compare tab to send this prompt to multiple providers and compare their answers:\n\n{{prompt}}\n\nLook for: factual accuracy, reasoning quality, tone, length, and whether the model asked clarifying questions or made assumptions.", category: "general", tags: "compare,evaluation,models" },
      { title: "Generate a system prompt", body: "Write a system prompt for an AI assistant that {{does_what}}. The assistant should have this persona: {{persona}}. Include: role definition, tone guidelines, do's and don'ts, output format expectations, and 2 example interactions. Test the prompt against at least 2 providers in Compare mode.", category: "general", tags: "system-prompt,prompt-engineering" },
      { title: "Summarize a long document", body: "Summarize this document in 3 layers:\n1. A 1-sentence TL;DR.\n2. A 5-bullet executive summary.\n3. A 200-word detailed summary with key numbers and quotes.\n\nDocument:\n{{document}}", category: "general", tags: "summary,document,long-context" },
      { title: "Translate + localize", body: "Translate the following text from {{source_language}} to {{target_language}}. Don't translate literally — localize for the target culture. Flag any idioms, jokes, or cultural references that don't translate and propose a localized alternative.\n\n{{text}}", category: "general", tags: "translation,localization,i18n" },
    ];
    for (const p of samplePrompts) {
      await db.prompt.create({
        data: {
          orgId: demoOrgId,
          title: p.title,
          body: p.body,
          category: p.category,
          tags: p.tags,
          createdBy: user?.id,
        },
      });
    }
    console.log(`  ✓ Seeded ${samplePrompts.length} sample prompts across ${new Set(samplePrompts.map(p => p.category)).size} categories`);
  } else {
    console.log(`  ✓ Prompt library already has ${existingPrompts} prompts — skipping seed`);
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
