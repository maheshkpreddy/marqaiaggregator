/**
 * Marq AI Aggregator — Provider Benefits Catalog
 *
 * Rich, user-facing metadata for every provider on the platform. This is the
 * data behind the "Provider Guide" tab — it explains what each provider is
 * good at, what you can do with it, when to pick it, sample prompts, and
 * practical setup notes.
 *
 * The catalog is keyed by the provider `name` field (the same value stored
 * in the Provider row in the database), so the UI can look up the matching
 * entry for any provider the user has configured.
 */

export interface ProviderBenefit {
  /** Stable key matching Provider.name in the database. */
  name: string;
  /** Human-friendly name (matches Provider.displayName). */
  displayName: string;
  /** One-line tagline shown at the top of the card. */
  tagline: string;
  /** Lucide icon name (resolved in the UI via the icon map). */
  icon: string;
  /** Brand color (matches Provider.color). */
  color: string;
  /** Category for grouping in the UI. */
  category: "frontier" | "open-source" | "local" | "specialized" | "orchestration";

  /** What this provider is genuinely best at — the differentiator. */
  bestFor: string[];
  /** Concrete things a user can do with this provider through Marq AI. */
  capabilities: string[];
  /** When a user should pick THIS provider over the others. */
  whenToUse: string[];
  /** Honest limitations to set expectations. */
  limitations: string[];
  /** 3 sample prompts the user can copy/paste into Chat or Compare. */
  samplePrompts: string[];
  /** Practical setup notes — how to get a real API key wired up. */
  setupNotes: string;
  /** Pricing tier summary (rough, public-listed). */
  pricingTier: string;
  /** Official docs URL. */
  docsUrl: string;
}

export const PROVIDER_BENEFITS: ProviderBenefit[] = [
  // ─────────────────────────────────────────────────────────────
  // Frontier cloud providers
  // ─────────────────────────────────────────────────────────────
  {
    name: "openai",
    displayName: "OpenAI",
    tagline: "The industry default — best all-rounder for chat, code, and tool use.",
    icon: "Sparkles",
    color: "#10a37f",
    category: "frontier",
    bestFor: [
      "General-purpose chat with the lowest user-facing latency",
      "Structured tool calling and function-calling workflows",
      "Code generation across TypeScript, Python, SQL, Bash",
      "Reasoning tasks via the o1 / o3-mini family",
      "Vision and image understanding (gpt-4o is multimodal)",
    ],
    capabilities: [
      "Chat with GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo, and o-series reasoning models",
      "Run comparison mode to see OpenAI's answer next to Gemini and Claude",
      "Use as the primary provider in the failover chain — if it 429s, Gemini picks up",
      "Pin as the primary provider for any of the 8 agent templates",
      "Use as the LLM backbone for the unified external API (/api/v1/chat)",
    ],
    whenToUse: [
      "You need the most predictable, well-documented API behavior",
      "Your team already has OpenAI muscle memory and SDK examples",
      "You're building tool-using agents (function calling is rock-solid here)",
      "You want vision + text in a single model (gpt-4o)",
    ],
    limitations: [
      "Token-based pricing can compound quickly on high-traffic apps",
      "Training data has a cutoff — pair with web_search for current info",
      "Strict rate limits on the free / Tier-1 quotas",
    ],
    samplePrompts: [
      "Refactor this TypeScript function to use async/await instead of .then() chains, and explain each change.",
      "I'm building a SaaS pricing page. Suggest 3 pricing tiers for an AI aggregator product, with rationale for each.",
      "Write a SQL query to find the top 5 customers by total revenue in the last 90 days, including their email and last order date.",
    ],
    setupNotes:
      "Sign up at platform.openai.com, create an API key under 'API Keys', then paste it into the Providers tab. " +
      "The default endpoint (api.openai.com/v1/chat/completions) is correct for direct OpenAI access. " +
      "If you're routing through Azure OpenAI, change the apiEndpoint to your Azure deployment URL.",
    pricingTier: "Pay-as-you-go from $0.15 / 1M input tokens (gpt-4o-mini) up to ~$15 / 1M (o-series).",
    docsUrl: "https://platform.openai.com/docs",
  },

  {
    name: "gemini",
    displayName: "Google Gemini",
    tagline: "Long-context multimodal reasoning with grounded search built in.",
    icon: "Sparkles",
    color: "#4285f4",
    category: "frontier",
    bestFor: [
      "Very long context windows (up to 2M tokens on Gemini 1.5 Pro)",
      "Multimodal tasks — text + images + video + audio in one prompt",
      "Grounded answers via Google Search integration",
      "Code reasoning across large codebases",
      "Cost-efficient batch processing at scale",
    ],
    capabilities: [
      "Chat with Gemini 2.0 Flash, Gemini 1.5 Pro, and Gemini 1.5 Flash",
      "Drop in PDFs, images, and audio for analysis (multimodal)",
      "Use as a failover target when OpenAI or Claude hit rate limits",
      "Compare Gemini's step-by-step reasoning style against OpenAI and Claude",
      "Power the Research Analyst agent for grounded web-style answers",
    ],
    whenToUse: [
      "You need to analyze a 500-page document or whole codebase in one prompt",
      "Your task involves images, audio, or video alongside text",
      "You want grounded, source-cited answers without a separate RAG pipeline",
      "You're cost-sensitive on large batches (Flash is very cheap)",
    ],
    limitations: [
      "Outputs can be more verbose than OpenAI — set explicit length limits",
      "Tool calling API shape differs from OpenAI (Marq normalizes this for you)",
      "Rate limits on the free tier are aggressive — recommend paid tier for production",
    ],
    samplePrompts: [
      "Summarize this 80-page PDF in 5 bullet points, then extract every dollar amount mentioned into a table.",
      "Look at this screenshot of my UI and tell me 3 things that could be improved for accessibility.",
      "I have a 50-file TypeScript codebase. Find every function that returns a Promise without proper error handling, and list them with file:line.",
    ],
    setupNotes:
      "Get a key from aistudio.google.com (free tier available) or Google Cloud Console. " +
      "Paste the key into the Providers tab. The default endpoint (generativelanguage.googleapis.com/v1beta/models) is correct for the AI Studio API. " +
      "For Vertex AI, change the endpoint to your Vertex region URL and use a GCP service account JSON as the key.",
    pricingTier: "Free tier available. Paid: Flash from $0.075 / 1M tokens, Pro from $1.25 / 1M.",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
  },

  {
    name: "claude",
    displayName: "Anthropic Claude",
    tagline: "Careful, nuanced long-form writing and safety-aligned reasoning.",
    icon: "Sparkles",
    color: "#d97757",
    category: "frontier",
    bestFor: [
      "Long-form writing — emails, essays, marketing copy, documentation",
      "Careful, balanced analysis that acknowledges trade-offs",
      "Code refactoring with explanations (Claude is uniquely good at this)",
      "Constitutional-AI safety alignment for sensitive use cases",
      "200K-token context window for medium-long documents",
    ],
    capabilities: [
      "Chat with Claude 3.5 Sonnet, Claude 3 Opus, and Claude 3 Haiku",
      "Use as the primary writer agent for content-heavy tasks",
      "Run as a failover target — Claude rarely rate-limits aggressively",
      "Compare Claude's thoughtful tone against OpenAI's structured tone",
      "Power the Business Analyst and Product Manager agents (long-form reasoning)",
    ],
    whenToUse: [
      "Quality of writing matters more than raw speed",
      "You're drafting content that will be read by humans (emails, blogs, docs)",
      "You need careful reasoning about edge cases, ethics, or trade-offs",
      "You want a 'second opinion' on a problem OpenAI already answered",
    ],
    limitations: [
      "Slightly higher per-token latency than GPT-4o-mini",
      "No native vision on Claude 3 (vision is on Claude 3.5 Sonnet only)",
      "Conservative refusal behavior can require careful prompting",
    ],
    samplePrompts: [
      "Write a thoughtful 3-paragraph product update email announcing our new 'comparison mode' feature. Audience: existing SaaS customers. Tone: warm but professional.",
      "Refactor this function and explain each change. I care about readability more than micro-optimization.",
      "I'm deciding between Postgres and DynamoDB for a multi-tenant SaaS. Give me a balanced analysis with concrete trade-offs, not a default recommendation.",
    ],
    setupNotes:
      "Get a key from console.anthropic.com. Paste it into the Providers tab. " +
      "The default endpoint (api.anthropic.com/v1/messages) is correct. " +
      "Anthropic uses x-api-key header (Marq handles this for you). " +
      "If you're on AWS Bedrock or GCP Vertex, change the endpoint and key format accordingly.",
    pricingTier: "Haiku from $0.25 / 1M tokens, Sonnet from $3 / 1M, Opus from $15 / 1M.",
    docsUrl: "https://docs.anthropic.com",
  },

  {
    name: "grok",
    displayName: "xAI Grok",
    tagline: "Real-time-aware assistant with a witty, irreverent voice.",
    icon: "Sparkles",
    color: "#1d9bf0",
    category: "frontier",
    bestFor: [
      "Real-time information (Grok has live X/Twitter data access)",
      "Conversational tone with personality — not corporate-hedged",
      "Quick takes on trending topics and breaking news",
      "Pushing back on assumptions and finding holes in arguments",
      "Humor and creative writing with an edge",
    ],
    capabilities: [
      "Chat with Grok-2 and Grok-2-mini",
      "Get real-time-aware answers (pair with web_search for grounding)",
      "Use as a creative-writing failover when you want a different voice",
      "Compare Grok's blunt takes against Claude's careful takes",
      "Run as a third-tier failover so your chain has personality variety",
    ],
    whenToUse: [
      "You want a 'hot take' rather than a hedge",
      "You need current-event context that other models might lack",
      "Your brand voice is casual and you want the model to match it",
      "You're stuck in an echo chamber and want a contrarian read",
    ],
    limitations: [
      "Smaller model zoo than OpenAI/Anthropic",
      "OpenAI-compatible API but fewer SDK examples in the wild",
      "Personality can be too casual for regulated industries",
    ],
    samplePrompts: [
      "Give me the no-fluff take on whether I should use serverless or containers for a side project that gets 100 users/day.",
      "What's actually trending in AI this week? Skip the hype, tell me what's real.",
      "Roast my landing page copy: 'AI-powered synergy for the modern enterprise.' Then suggest 3 better alternatives.",
    ],
    setupNotes:
      "Get a key from x.ai (console.x.ai). The API is OpenAI-compatible at api.x.ai/v1/chat/completions. " +
      "Paste the key into the Providers tab — Marq treats it as an OpenAI-compatible provider automatically.",
    pricingTier: "Pay-as-you-go, comparable to GPT-4o-mini for Grok-2-mini.",
    docsUrl: "https://docs.x.ai",
  },

  // ─────────────────────────────────────────────────────────────
  // Open-source / model-zoo providers
  // ─────────────────────────────────────────────────────────────
  {
    name: "huggingface",
    displayName: "Hugging Face",
    tagline: "The open-source model zoo — 500K+ models, one API.",
    icon: "Bot",
    color: "#ff9d00",
    category: "open-source",
    bestFor: [
      "Trying open-source models (Llama, Mistral, Phi, CodeLlama) without hosting",
      "Specialized tasks — translation, embeddings, classification, summarization",
      "Research and benchmarking across many model families",
      "Cost-efficient inference on small open models",
      "Privacy-sensitive workloads where you want to self-host eventually",
    ],
    capabilities: [
      "Chat with Llama 3.1, Mistral 7B, Phi-3-mini, and 1000s more via the Inference API",
      "Switch models per-request — useful for A/B testing model quality",
      "Use as a cheap failover target on the lowest-priority tier",
      "Run specialized models (Whisper for audio, BGE for embeddings) through the same gateway",
      "Compare open vs. frontier models side-by-side in Compare mode",
    ],
    whenToUse: [
      "You want to evaluate open-source alternatives before committing to OpenAI/Anthropic",
      "Your task maps to a specialized model (translation, classification, embeddings)",
      "You're cost-sensitive and a small open model is 'good enough'",
      "You need to run the same model locally later (Ollama) — start on HF, move to local",
    ],
    limitations: [
      "Inference API can cold-start — first request may take 5-20s",
      "Quality varies wildly across the 500K+ models — stick to verified ones",
      "Not all models support chat format — some are completion-only",
    ],
    samplePrompts: [
      "Summarize this support ticket thread in 2 sentences, and classify the issue as 'bug', 'feature request', or 'how-to'.",
      "Translate this error message into plain English a non-technical user could understand.",
      "Given this list of customer reviews, extract the top 3 most-mentioned pain points.",
    ],
    setupNotes:
      "Create a free account at huggingface.co, generate an access token under Settings → Access Tokens. " +
      "Paste the token into the Providers tab. The default endpoint (api-inference.huggingface.co/models) works for the Inference API. " +
      "To pin a specific model, set it as the first item in the models list.",
    pricingTier: "Free tier (rate-limited). PRO from $9/mo. Dedicated instances from $99/mo.",
    docsUrl: "https://huggingface.co/docs/api-inference",
  },

  {
    name: "ollama",
    displayName: "Ollama (Local)",
    tagline: "Run open-source models on your own hardware. Zero data leaves the box.",
    icon: "HardDrive",
    color: "#22c55e",
    category: "local",
    bestFor: [
      "Privacy-first / air-gapped / HIPAA / FedRAMP workloads",
      "Offline development and testing without API costs",
      "Predictable latency — no network round-trip",
      "Experimenting with many open models locally before picking one",
      "Cost = $0 per token (you already own the hardware)",
    ],
    capabilities: [
      "Chat with Llama 3.1, Mistral, Phi-3, Qwen 2.5, Gemma 2, and 100+ local models",
      "Use as a private fallback when cloud providers are down",
      "Run agents entirely offline (great for classified environments)",
      "Compare local model quality vs. frontier models",
      "Pin as primary provider for an entirely on-prem deployment",
    ],
    whenToUse: [
      "Compliance forbids sending data to external APIs",
      "You're iterating on prompts and don't want to burn API credits",
      "You have a beefy GPU and want zero per-token cost",
      "You want deterministic, reproducible runs (no provider-side model swaps)",
    ],
    limitations: [
      "Quality is below frontier models (Llama 3.1 70B is close but not equal to GPT-4o)",
      "Requires local GPU/CPU — not available on Vercel/serverless by default",
      "You manage your own uptime, model updates, and security patches",
    ],
    samplePrompts: [
      "Draft a release notes document for version 2.3 of our internal auth service. Use a professional tone.",
      "Generate 10 test cases for a function that validates email addresses. Include edge cases.",
      "Explain the difference between optimistic and pessimistic locking, with a SQL example of each.",
    ],
    setupNotes:
      "Install Ollama from ollama.com (one-line installer for macOS/Linux/Windows). " +
      "Run 'ollama serve' to start the local API server on port 11434. " +
      "Pull models with 'ollama pull llama3.1' etc. " +
      "In the Providers tab, the endpoint defaults to http://localhost:11434/v1/chat/completions — " +
      "if you're running Ollama on a different host, change the endpoint accordingly. " +
      "No API key is needed for a default local install; leave the key field blank.",
    pricingTier: "Free, open-source. You pay only for your own hardware/electricity.",
    docsUrl: "https://ollama.com",
  },

  {
    name: "replit",
    displayName: "Replit",
    tagline: "Cloud IDE-tuned coding model for short, runnable snippets.",
    icon: "Code",
    color: "#f26207",
    category: "specialized",
    bestFor: [
      "Generating short, immediately-runnable code snippets",
      "Cloud IDE workflows — explain-in-context, fix-and-run loops",
      "Onboarding new developers with inline explanations",
      "Quick prototyping without leaving the chat",
      "Multi-language snippets (Python, JS, Go, Rust, etc.)",
    ],
    capabilities: [
      "Chat with Replit Code v1.5 (3B and 7B variants)",
      "Use as a coding-specialist failover after a general model",
      "Power the Full-Stack Developer agent's code-generation step",
      "Generate boilerplate that drops into a Replit workspace",
      "Compare Replit's terse code style against OpenAI/Claude",
    ],
    whenToUse: [
      "You're already in the Replit ecosystem and want native-style output",
      "You want short, copy-pasteable snippets (not large multi-file refactors)",
      "You're teaching and want the model to explain each line",
      "You need a cheap coding-focused model for high-volume batch work",
    ],
    limitations: [
      "Small model size means it can struggle on complex multi-file refactors",
      "Less general knowledge than frontier models — stick to coding tasks",
      "API access requires a Replit account",
    ],
    samplePrompts: [
      "Write a Python function that downloads a URL, saves it to /tmp, and returns the file size. Include error handling.",
      "Generate a Rust struct for a 'User' with id, email, created_at, and a method to format it as JSON.",
      "Show me a 5-line bash script to find the 10 largest files in a directory.",
    ],
    setupNotes:
      "Sign in to Replit, generate an API key under Account → API Keys. " +
      "Paste the key into the Providers tab. The default endpoint (model-proxy.replit.com/v1/chat/completions) " +
      "is the public OpenAI-compatible gateway.",
    pricingTier: "Included with Replit Core ($20/mo). Pay-as-you-go for non-subscribers.",
    docsUrl: "https://docs.replit.com",
  },

  {
    name: "modal",
    displayName: "Modal (Serverless)",
    tagline: "Serverless inference for any model you can containerize.",
    icon: "Server",
    color: "#7c3aed",
    category: "specialized",
    bestFor: [
      "Custom fine-tuned models that don't fit other providers' catalogs",
      "Serverless scaling with cold-start / warm-pool control",
      "GPU choice (T4, A10G, A100) per workload",
      "Pinning exact model versions for reproducibility",
      "Cost control via per-workload autoscaling",
    ],
    capabilities: [
      "Chat with any model you've deployed to Modal (vLLM, TGI, custom)",
      "Use as a low-cost high-volume backend for batch workloads",
      "Pin as primary for fine-tuned model deployments",
      "Failover target with custom SLA you control",
      "Compare custom fine-tunes against frontier baselines",
    ],
    whenToUse: [
      "You've fine-tuned a model and need to serve it like an API",
      "You need exact reproducibility — same model version, same hardware, every call",
      "Your traffic is spiky and you want true scale-to-zero between bursts",
      "You want to choose specific GPUs (e.g. A100 for a 70B model)",
    ],
    limitations: [
      "Cold start can be 3-30s depending on model size — set keep_warm appropriately",
      "You own the deployment — packaging, dependencies, model weights",
      "Less 'batteries included' than calling OpenAI directly",
    ],
    samplePrompts: [
      "Classify this customer message as 'urgent', 'normal', or 'low-priority', and route accordingly.",
      "Generate a 3-sentence product description from this spec sheet: [paste spec].",
      "Score this support reply for tone (1-5) and rewrite it to be more empathetic.",
    ],
    setupNotes:
      "Sign up at modal.com, install the Modal CLI, deploy your model with @app.function and @modal.web_endpoint. " +
      "Paste your Modal Token ID and Token Secret into the Providers tab. " +
      "Set apiEndpoint to your deployed function's URL (e.g. https://your-workspace--your-function.modal.run/v1/chat/completions).",
    pricingTier: "Pay per second of compute. T4 from $0.000164/s, A100 from $0.00102/s.",
    docsUrl: "https://modal.com/docs",
  },

  {
    name: "gradio",
    displayName: "Gradio Spaces",
    tagline: "Interactive ML demos from the Hugging Face Spaces ecosystem.",
    icon: "Layout",
    color: "#f97316",
    category: "specialized",
    bestFor: [
      "Trying niche ML demos (Stable Diffusion, Whisper, Bark, etc.) without setup",
      "Non-technical stakeholders poking at a model via UI",
      "Prototyping — spin up a Space in minutes, chat with it from Marq",
      "Multi-modal experiments (image gen, audio transcription, TTS)",
      "Educational use — show how a model behaves before integrating it",
    ],
    capabilities: [
      "Chat with any Gradio Space's underlying model via its API",
      "Run image-generation Spaces (Stable Diffusion, Flux, etc.)",
      "Run audio Spaces (Whisper transcription, Bark TTS, music gen)",
      "Compare Space-based models against frontier APIs",
      "Use as a 'playground' failover for creative / experimental tasks",
    ],
    whenToUse: [
      "You want to try a niche model (e.g. a specific fine-tune) without deploying it",
      "You're prototyping and want quick access to many model types",
      "You need image/audio/video gen that the chat providers don't offer",
      "You're teaching or demoing and want a UI the audience can interact with",
    ],
    limitations: [
      "Spaces can sleep when idle — first request may cold-start 10-30s",
      "API shape varies per Space — Marq uses the OpenAI-compat wrapper where available",
      "Not intended for production SLAs — use Modal or HF Dedicated for that",
    ],
    samplePrompts: [
      "Transcribe this 30-second audio clip and summarize the key points in 2 sentences.",
      "Generate an image of a futuristic library at sunset, watercolor style, 16:9.",
      "Read this product description aloud in a friendly voice, then suggest 3 improvements to the copy.",
    ],
    setupNotes:
      "Find a Space on huggingface.co/spaces that exposes an OpenAI-compatible endpoint (or use the Gradio Client API). " +
      "Set the apiEndpoint to the Space's URL (e.g. https://your-username-your-space.hf.space/run/predict). " +
      "If the Space is private, paste your HF token as the API key.",
    pricingTier: "Free for public Spaces. Private Spaces from $5/mo (CPU) / $15/mo (GPU).",
    docsUrl: "https://www.gradio.app/guides",
  },

  {
    name: "mlflow",
    displayName: "MLflow AI Gateway",
    tagline: "Route chat through your own version-controlled, registered models.",
    icon: "Database",
    color: "#0ea5e9",
    category: "specialized",
    bestFor: [
      "MLOps teams managing model lifecycle (dev → staging → prod)",
      "Reproducibility — every chat call goes through a versioned, registered model",
      "Centralized governance — one gateway for all your models across providers",
      "Audit trails — track which model version answered which request",
      "A/B testing model versions in production",
    ],
    capabilities: [
      "Chat with any model registered in your MLflow Model Registry",
      "Pin specific model versions (e.g. 'llama-3.1-v3') for reproducibility",
      "Use as a governance layer — all chat calls hit your MLflow gateway, not external APIs",
      "Compare registered model versions against each other and against frontier APIs",
      "Failover between MLflow-registered model versions automatically",
    ],
    whenToUse: [
      "You have an MLOps team and a model registry already",
      "Compliance requires full audit of which model version answered each request",
      "You're A/B testing fine-tunes in production and need clean traffic splitting",
      "You want one gateway to rule them all (OpenAI, Anthropic, internal models)",
    ],
    limitations: [
      "Requires standing up an MLflow AI Gateway server (self-hosted or Databricks-managed)",
      "Adds a network hop — slight latency overhead vs. calling providers directly",
      "Overkill for solo devs or simple apps",
    ],
    samplePrompts: [
      "Classify this support ticket and route it to the right queue. (Model: ticket-classifier-v4)",
      "Score this lead from 1-100 based on firmographic data. (Model: lead-scorer-v2)",
      "Generate a SQL query from this natural-language question. (Model: text2sql-v1)",
    ],
    setupNotes:
      "Install MLflow (`pip install mlflow`), start the AI Gateway with `mlflow gateway start --config-path config.yaml`. " +
      "Configure routes in the YAML to map chat endpoints to underlying providers. " +
      "In the Providers tab, set apiEndpoint to your gateway URL (e.g. http://your-host:5000/v1/chat/completions). " +
      "Use your MLflow gateway API key if you've secured it.",
    pricingTier: "Open-source MLflow is free. Databricks-hosted MLflow pricing varies by workspace.",
    docsUrl: "https://mlflow.org/docs/latest/llms/deployments/index.html",
  },

  // ─────────────────────────────────────────────────────────────
  // Orchestration / framework providers
  // ─────────────────────────────────────────────────────────────
  {
    name: "crewai",
    displayName: "CrewAI Orchestrator",
    tagline: "Multi-agent orchestration — decompose goals across roles.",
    icon: "Users",
    color: "#ec4899",
    category: "orchestration",
    bestFor: [
      "Complex tasks that benefit from role decomposition (Researcher + Analyst + Writer)",
      "Multi-step workflows where different agents use different tools",
      "Tasks too big for a single LLM call (long research, multi-perspective analysis)",
      "Mimicking a real team's workflow in software",
      "Producing structured deliverables (report, brief, plan) from a single goal",
    ],
    capabilities: [
      "Chat with a CrewAI backend that runs multi-agent crews server-side",
      "Send a goal, get back a synthesized deliverable produced by 2-5 specialized agents",
      "Use as a 'heavy lift' provider for complex tasks, failover to single-model providers for simple ones",
      "Compare a crew's output against a single-model baseline",
      "Pin as primary for the Research Analyst or Product Manager agents",
    ],
    whenToUse: [
      "The task is genuinely complex — research + analysis + drafting",
      "A single LLM call produces shallow or one-sided answers",
      "You want a structured deliverable (report, plan, brief), not just a chat reply",
      "You're willing to wait 30-90s for higher-quality output",
    ],
    limitations: [
      "Much higher latency (each crew runs multiple LLM calls internally)",
      "Higher token cost (multiple agents each consume tokens)",
      "Requires standing up a CrewAI backend and exposing it as an OpenAI-compatible endpoint",
    ],
    samplePrompts: [
      "Research the top 3 competitors to our AI aggregator product, analyze their pricing models, and draft a 1-page recommendation for our pricing strategy.",
      "Take this product brief and produce: (1) a functional spec, (2) a QA test plan, (3) a launch runbook.",
      "Analyze this incident report from 3 perspectives (engineering, customer success, exec) and produce a single coordinated action plan.",
    ],
    setupNotes:
      "Install CrewAI (`pip install crewai`), define your agents and crew in Python, then expose the crew as an HTTP endpoint " +
      "(use FastAPI or LangServe). In the Providers tab, set apiEndpoint to your crew's URL and use any auth header your backend requires.",
    pricingTier: "Open-source CrewAI is free. CrewAI Enterprise / Cloud pricing varies.",
    docsUrl: "https://docs.crewai.com",
  },

  {
    name: "langchain",
    displayName: "LangChain / LangServe",
    tagline: "Compose prompts, retrievers, and tools into reproducible chains.",
    icon: "Link",
    color: "#14b8a6",
    category: "orchestration",
    bestFor: [
      "RAG workflows (retrieval-augmented generation) over your own documents",
      "Multi-step LLM pipelines (prompt → LLM → parser → tool → LLM)",
      "Reproducible, version-controlled chain definitions",
      "Exposing internal tools (SQL lookups, API calls) to an LLM in a structured way",
      "Replacing ad-hoc prompt engineering with composable, testable chains",
    ],
    capabilities: [
      "Chat with any chain deployed via LangServe (your own backend)",
      "Use as a RAG provider — chat against your own vector store / knowledge base",
      "Pin as primary for tasks that need your internal tools (SQL, APIs, search)",
      "Compare a chain's output (with retrieval) against a raw LLM call",
      "Failover between LangServe-deployed chains",
    ],
    whenToUse: [
      "You need RAG over your own documents (PDFs, Notion, Confluence, etc.)",
      "You want the LLM to call your internal APIs (e.g. 'look up this customer's orders')",
      "Your team already writes LangChain chains in Python/JS",
      "You want testable, versioned prompt pipelines, not prompt strings in your app code",
    ],
    limitations: [
      "Requires standing up a LangServe backend (FastAPI wrapper around your chains)",
      "Adds a network hop — slight latency",
      "Chain design is a skill — bad chains produce bad output",
    ],
    samplePrompts: [
      "Search our internal docs and answer: what's our refund policy for annual subscriptions?",
      "Look up customer ACME Corp's last 5 orders and summarize any recurring issues.",
      "Based on our internal API docs, write a curl command to create a new webhook subscription.",
    ],
    setupNotes:
      "Define your chain in LangChain (Python or JS), deploy with LangServe (`pip install langserve-cli` + `langserve deploy`). " +
      "In the Providers tab, set apiEndpoint to your LangServe URL (e.g. https://your-deploy.langserve.app/v1/chat/completions). " +
      "Use your LangServe API key as the auth token.",
    pricingTier: "Open-source LangChain is free. LangSmith (observability) from $39/mo. LangServe Cloud varies.",
    docsUrl: "https://python.langchain.com/docs/langserve",
  },

  {
    name: "qvac",
    displayName: "Qvac Quantum-Inspired",
    tagline: "Explores multiple solution paths in parallel — recommends the most defensible.",
    icon: "Atom",
    color: "#8b5cf6",
    category: "specialized",
    bestFor: [
      "Decisions with multiple defensible answers (architectural, strategic, ethical)",
      "Tasks where you want a 'second opinion' framed as parallel reasoning",
      "Risk-aware recommendations — conservative vs. balanced vs. bold paths",
      "Complex trade-off analysis with explicit reasoning traces",
      "Educational use — showing how different framings produce different answers",
    ],
    capabilities: [
      "Chat with the Qvac reasoning model",
      "Use as a 'devil's advocate' failover after a confident single-model answer",
      "Compare Qvac's multi-path reasoning against single-model direct answers",
      "Pin as primary for high-stakes decisions where you want explicit reasoning traces",
      "Run for tasks where the 'right' answer is genuinely ambiguous",
    ],
    whenToUse: [
      "The decision is high-stakes and you want multiple framings",
      "A single model gives a confident answer but you suspect it's overfitting",
      "You're documenting a decision and need to show alternatives considered",
      "You're teaching reasoning and want to expose the multi-path approach",
    ],
    limitations: [
      "Higher latency — parallel path exploration adds time",
      "Output is more verbose (3 paths + synthesis) — set length expectations",
      "Specialized — overkill for simple factual lookups",
    ],
    samplePrompts: [
      "Should we migrate from Postgres to DynamoDB? Explore 3 paths (conservative, balanced, bold) and recommend one.",
      "We have $50K to spend on growth. Explore 3 allocation strategies and recommend the most defensible.",
      "A customer is asking for a feature our roadmap doesn't include. Explore 3 responses and recommend the best.",
    ],
    setupNotes:
      "Get an API key from your Qvac account (or self-hosted Qvac instance). " +
      "Set the apiEndpoint to your Qvac gateway URL. The API is OpenAI-compatible.",
    pricingTier: "Varies by deployment. Self-hosted is free + hardware costs.",
    docsUrl: "https://docs.qvac.ai",
  },
];

/** Quick lookup by provider name. */
export const PROVIDER_BENEFITS_MAP: Record<string, ProviderBenefit> = Object.fromEntries(
  PROVIDER_BENEFITS.map((p) => [p.name, p]),
);

/** Get benefits for a provider, falling back to a minimal default. */
export function getProviderBenefits(name: string): ProviderBenefit | null {
  return PROVIDER_BENEFITS_MAP[name] ?? null;
}

/** Category metadata for the UI filter. */
export const CATEGORY_META: Record<ProviderBenefit["category"], { label: string; description: string }> = {
  frontier: {
    label: "Frontier Cloud Models",
    description: "The big-name hosted APIs — highest quality, pay-per-token, managed by the vendor.",
  },
  "open-source": {
    label: "Open-Source Model Zoos",
    description: "Hosted catalogs of open-source models — cheaper, more variety, some cold-start latency.",
  },
  local: {
    label: "Local / Self-Hosted",
    description: "Run on your own hardware — zero per-token cost, full privacy, you own uptime.",
  },
  specialized: {
    label: "Specialized / Vertical",
    description: "Tuned for a specific use case — coding, ML demos, MLOps, multi-path reasoning.",
  },
  orchestration: {
    label: "Orchestration Frameworks",
    description: "Multi-agent / multi-step backends you host — wrap your own chains and crews.",
  },
};
