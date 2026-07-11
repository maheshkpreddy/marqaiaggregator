/**
 * Marq AI Aggregator — Provider Benefits Catalog
 *
 * Rich, user-facing metadata for every provider on the platform. This is the
 * data behind the "Provider Guide" tab and the "AI Directory" tab — it
 * explains what each provider is good at, what you can do with it, when to
 * pick it, sample prompts, and practical setup notes.
 *
 * The catalog is keyed by the provider `name` field (the same value stored
 * in the Provider row in the database), so the UI can look up the matching
 * entry for any provider the user has configured.
 *
 * SCHEMA (extended for the AI Directory tab):
 *  - kind: "platform" | "package" | "framework" | "model" | "service"
 *      Platform = full dev platform (Anaconda, HF, Outerbounds, Modal)
 *      Package  = installable library (PyTorch, TF, Keras, OpenCV, sklearn, Transformers, Instructor, MLflow, LangChain)
 *      Framework = agent/runtime framework (CrewAI, AutoGen, vLLM, Ollama)
 *      Model    = open-weight model family (Qwen, Mistral, DeepSeek, Llama)
 *      Service  = hosted inference API (OpenAI, Gemini, Claude, Grok, Zai, etc.)
 *  - popularity: "very-high" | "high" | "medium" | "low"
 *  - availableModels: model IDs the provider exposes (or "custom" for self-hosted)
 *  - availableAgents: Marq agent template keys that pair well with this provider
 *  - advantages: technical advantages (5 max)
 *  - businessAdvantages: business/ops advantages (5 max)
 *  - apiIntegrationDetails: concrete API call shape (endpoint, auth, body)
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
  /** Category for grouping in the Provider Guide. */
  category: "frontier" | "open-source" | "local" | "specialized" | "orchestration";
  /** Kind for the AI Directory (platform/package/framework/model/service). */
  kind: "platform" | "package" | "framework" | "model" | "service";
  /** Popularity tier for the AI Directory sort/filter. */
  popularity: "very-high" | "high" | "medium" | "low";

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

  // ── AI Directory fields ──
  /** Model IDs the provider exposes (or ["custom"] / ["(any HF Hub model)"] etc.). */
  availableModels: string[];
  /** Marq agent template keys that pair well with this provider. */
  availableAgents: string[];
  /** Technical advantages (concise bullets, 5 max). */
  advantages: string[];
  /** Business / operational advantages (concise bullets, 5 max). */
  businessAdvantages: string[];
  /** Concrete API call shape: endpoint, auth header, body shape. */
  apiIntegrationDetails: string;
}

export const PROVIDER_BENEFITS: ProviderBenefit[] = [
  {
    name: `openai`,
    displayName: `OpenAI`,
    tagline: `The industry default — best all-rounder for chat, code, and tool use.`,
    icon: `Sparkles`,
    color: `#10a37f`,
    category: "frontier",
    kind: "service",
    popularity: "very-high",
    bestFor: [
    `General-purpose chat with the lowest user-facing latency`,
    `Structured tool calling and function-calling workflows`,
    `Code generation across TypeScript, Python, SQL, Bash`,
    `Reasoning tasks via the o1 / o3-mini family`,
    `Vision and image understanding (gpt-4o is multimodal)`,
  ],
    capabilities: [
    `Chat with GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo, and o-series reasoning models`,
    `Run comparison mode to see OpenAI's answer next to Gemini and Claude`,
    `Use as the primary provider in the failover chain — if it 429s, Gemini picks up`,
    `Pin as the primary provider for any of the 147 agent templates`,
    `Use as the LLM backbone for the unified external API (/api/v1/chat)`,
  ],
    whenToUse: [
    `You need the most predictable, well-documented API behavior`,
    `Your team already has OpenAI muscle memory and SDK examples`,
    `You're building tool-using agents (function calling is rock-solid here)`,
    `You want vision + text in a single model (gpt-4o)`,
  ],
    limitations: [
    `Token-based pricing can compound quickly on high-traffic apps`,
    `Training data has a cutoff — pair with web_search for current info`,
    `Strict rate limits on the free / Tier-1 quotas`,
  ],
    samplePrompts: [
    `Refactor this TypeScript function to use async/await instead of .then() chains, and explain each change.`,
    `I'm building a SaaS pricing page. Suggest 3 pricing tiers for an AI aggregator product, with rationale for each.`,
    `Write a SQL query to find the top 5 customers by total revenue in the last 90 days, including their email and last order date.`,
  ],
    setupNotes: `Sign up at platform.openai.com, create an API key under 'API Keys', then paste it into the Providers tab. The default endpoint (api.openai.com/v1/chat/completions) is correct for direct OpenAI access. If you're routing through Azure OpenAI, change the apiEndpoint to your Azure deployment URL.`,
    pricingTier: `Pay-as-you-go from $0.15 / 1M input tokens (gpt-4o-mini) up to ~$15 / 1M (o-series).`,
    docsUrl: `https://platform.openai.com/docs`,
    availableModels: [
    `gpt-4o`,
    `gpt-4o-mini`,
    `gpt-4-turbo`,
    `o1`,
    `o1-mini`,
    `o3-mini`,
  ],
    availableAgents: [
    `general`,
    `fullstack_dev`,
    `research`,
    `business_analyst`,
    `product_manager`,
  ],
    advantages: [
    `Best-in-class tool calling`,
    `Multimodal (vision + text)`,
    `Lowest latency among frontier models`,
    `Massive ecosystem of SDKs and examples`,
  ],
    businessAdvantages: [
    `Predictable per-token pricing`,
    `Enterprise SOC 2 / HIPAA available`,
    `Most team members already know the API`,
    `Fast time-to-production for any chat feature`,
  ],
    apiIntegrationDetails: `POST https://api.openai.com/v1/chat/completions with Authorization: Bearer <key>. Body: {model, messages, ...}. OpenAI-compatible — works with any OpenAI SDK.`,
  },
  {
    name: `gemini`,
    displayName: `Google Gemini`,
    tagline: `Long-context multimodal reasoning with grounded search built in.`,
    icon: `Sparkles`,
    color: `#4285f4`,
    category: "frontier",
    kind: "service",
    popularity: "very-high",
    bestFor: [
    `Very long context windows (up to 2M tokens on Gemini 1.5 Pro)`,
    `Multimodal tasks — text + images + video + audio in one prompt`,
    `Grounded answers via Google Search integration`,
    `Code reasoning across large codebases`,
    `Cost-efficient batch processing at scale`,
  ],
    capabilities: [
    `Chat with Gemini 2.0 Flash, Gemini 1.5 Pro, and Gemini 1.5 Flash`,
    `Drop in PDFs, images, and audio for analysis (multimodal)`,
    `Use as a failover target when OpenAI or Claude hit rate limits`,
    `Compare Gemini's step-by-step reasoning style against OpenAI and Claude`,
    `Power the Research Analyst agent for grounded web-style answers`,
  ],
    whenToUse: [
    `You need to analyze a 500-page document or whole codebase in one prompt`,
    `Your task involves images, audio, or video alongside text`,
    `You want grounded, source-cited answers without a separate RAG pipeline`,
    `You're cost-sensitive on large batches (Flash is very cheap)`,
  ],
    limitations: [
    `Outputs can be more verbose than OpenAI — set explicit length limits`,
    `Tool calling API shape differs from OpenAI (Marq normalizes this for you)`,
    `Rate limits on the free tier are aggressive — recommend paid tier for production`,
  ],
    samplePrompts: [
    `Summarize this 80-page PDF in 5 bullet points, then extract every dollar amount mentioned into a table.`,
    `Look at this screenshot of my UI and tell me 3 things that could be improved for accessibility.`,
    `I have a 50-file TypeScript codebase. Find every function that returns a Promise without proper error handling, and list them with file:line.`,
  ],
    setupNotes: `Get a key from aistudio.google.com (free tier available) or Google Cloud Console. Paste the key into the Providers tab. The default endpoint (generativelanguage.googleapis.com/v1beta/models) is correct for the AI Studio API. For Vertex AI, change the endpoint to your Vertex region URL and use a GCP service account JSON as the key.`,
    pricingTier: `Free tier available. Paid: Flash from $0.075 / 1M tokens, Pro from $1.25 / 1M.`,
    docsUrl: `https://ai.google.dev/gemini-api/docs`,
    availableModels: [
    `gemini-2.5-flash`,
    `gemini-2.5-pro`,
    `gemini-2.0-flash-lite`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `business_analyst`,
  ],
    advantages: [
    `Longest context window in the industry (2M tokens)`,
    `Native multimodal`,
    `Free tier available`,
    `Grounded Google Search integration`,
  ],
    businessAdvantages: [
    `Lower cost per token than OpenAI/Claude on long contexts`,
    `Tight integration with Google Workspace`,
    `Strong for document-heavy verticals (legal, finance, healthcare)`,
  ],
    apiIntegrationDetails: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=<key>. Different request shape than OpenAI — Marq's callGemini adapter handles the translation.`,
  },
  {
    name: `claude`,
    displayName: `Anthropic Claude`,
    tagline: `Careful, nuanced long-form writing and safety-aligned reasoning.`,
    icon: `Sparkles`,
    color: `#d97757`,
    category: "frontier",
    kind: "service",
    popularity: "very-high",
    bestFor: [
    `Long-form writing with nuance and balanced perspective`,
    `Careful reasoning on ethically-sensitive tasks`,
    `Code review and refactoring with detailed explanations`,
    `Tasks where safety and alignment matter`,
    `Constitutional AI — Claude refuses unsafe asks gracefully`,
  ],
    capabilities: [
    `Chat with Claude 3.5 Sonnet, Claude 3 Opus, and Claude 3 Haiku`,
    `Use as the primary writer for long-form content generation`,
    `Compare Claude's thoughtful style against OpenAI's brisk style`,
    `Pin as the primary provider for the Research Analyst agent`,
    `Use as a 'second opinion' failover for high-stakes decisions`,
  ],
    whenToUse: [
    `You're writing content that needs a careful, nuanced voice`,
    `The task involves ethical considerations or sensitive topics`,
    `You want detailed explanations, not just answers`,
    `You're reviewing code or design decisions and want pros/cons`,
  ],
    limitations: [
    `Slower than OpenAI on simple tasks (Claude thinks longer)`,
    `Smaller context window than Gemini (200K vs 2M)`,
    `No native image generation — pair with DALL-E or Stable Diffusion`,
  ],
    samplePrompts: [
    `Review this pull request for security, performance, and maintainability. Be specific about what to change and why.`,
    `Write a thoughtful blog post (800 words) on the trade-offs of microservices vs. monoliths for a 50-engineer startup.`,
    `I'm deciding between two job offers. Help me think through the trade-offs beyond just salary.`,
  ],
    setupNotes: `Sign up at console.anthropic.com, create an API key, paste it into the Providers tab. The default endpoint (api.anthropic.com/v1/messages) is correct. Use the x-api-key header (Marq handles this automatically).`,
    pricingTier: `Pay-as-you-go: Haiku from $0.25 / 1M, Sonnet from $3 / 1M, Opus from $15 / 1M.`,
    docsUrl: `https://docs.anthropic.com`,
    availableModels: [
    `claude-3-5-sonnet`,
    `claude-3-opus`,
    `claude-3-haiku`,
    `claude-3-5-haiku`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `business_analyst`,
    `product_manager`,
  ],
    advantages: [
    `Best-in-class writing quality`,
    `Constitutional AI for safety`,
    `Long, careful reasoning`,
    `Lowest hallucination rate among frontier models`,
  ],
    businessAdvantages: [
    `Ideal for customer-facing content`,
    `Strong in regulated industries (safety-aligned)`,
    `Reduces need for human review on writing tasks`,
  ],
    apiIntegrationDetails: `POST https://api.anthropic.com/v1/messages with headers x-api-key and anthropic-version: 2023-06-01. Body: {model, messages, max_tokens}. Marq's callClaude adapter handles the shape.`,
  },
  {
    name: `grok`,
    displayName: `xAI Grok`,
    tagline: `Real-time-aware assistant with a witty, irreverent voice.`,
    icon: `Sparkles`,
    color: `#1d9bf0`,
    category: "frontier",
    kind: "service",
    popularity: "high",
    bestFor: [
    `Real-time-aware answers (Grok has live X/Twitter access)`,
    `Witty, irreverent voice for casual content`,
    `Pushing back on premises — Grok doesn't always agree`,
    `Tasks where you want a non-corporate tone`,
    `Quick takes on trending topics`,
  ],
    capabilities: [
    `Chat with Grok-2 and Grok-2-mini`,
    `Use as a real-time-aware failover for news/trending questions`,
    `Compare Grok's voice against OpenAI's corporate neutrality`,
    `Pin for social-media-adjacent writing tasks`,
  ],
    whenToUse: [
    `You want a take on something trending in the last 24 hours`,
    `You're writing social content and want a less corporate voice`,
    `You want an LLM that will push back on a flawed premise`,
  ],
    limitations: [
    `Smaller model zoo than OpenAI/Anthropic`,
    `Real-time access is gated — verify the tier you're on`,
    `Voice can be too casual for B2B content`,
  ],
    samplePrompts: [
    `What's the latest on the AI industry this week? Give me the 5 most important stories.`,
    `Roast my landing page copy and tell me how to make it less corporate.`,
    `Push back on my plan to migrate everything to microservices — what am I missing?`,
  ],
    setupNotes: `Sign up at console.x.ai, create an API key, paste it into the Providers tab. The endpoint (api.x.ai/v1/chat/completions) is OpenAI-compatible, so any OpenAI SDK works.`,
    pricingTier: `Pay-as-you-go. Grok-2 from $2 / 1M input, $10 / 1M output. Grok-2-mini is cheaper.`,
    docsUrl: `https://docs.x.ai`,
    availableModels: [
    `grok-2`,
    `grok-2-mini`,
    `grok-beta`,
  ],
    availableAgents: [
    `general`,
    `research`,
  ],
    advantages: [
    `Real-time web/X access`,
    `Distinct personality (not corporate)`,
    `OpenAI-compatible API`,
    `Good at pushing back on flawed premises`,
  ],
    businessAdvantages: [
    `Great for social/content teams`,
    `Differentiated voice for brand`,
    `Real-time awareness for news/journalism use cases`,
  ],
    apiIntegrationDetails: `POST https://api.x.ai/v1/chat/completions with Authorization: Bearer <key>. Body shape identical to OpenAI — drop-in compatible.`,
  },
  {
    name: `marq_glm`,
    displayName: `Marq GLM (Built-in)`,
    tagline: `Built-in GLM-4-Plus access via the z-ai SDK — works on Vercel automatically when ZAI_TOKEN is set.`,
    icon: `Sparkles`,
    color: `#3b82f6`,
    category: "frontier",
    kind: "service",
    popularity: "medium",
    bestFor: [
    `Real LLM responses on Vercel without managing API keys in the UI`,
    `Bilingual English/Chinese workloads`,
    `Long-context tasks via GLM-4-Long`,
    `Cost-sensitive high-volume runs via GLM-4-Air`,
  ],
    capabilities: [
    `Chat with GLM-4-Plus, GLM-4-Air, GLM-4-Long`,
    `Activate instantly with ZAI_TOKEN env var`,
    `Use as primary or failover in the chat + agent engines`,
    `Run in Compare mode against OpenAI/Gemini/Claude`,
  ],
    whenToUse: [
    `You want a real LLM on Vercel without per-row key management`,
    `Your workload is bilingual English/Chinese`,
    `You want a long-context model without paying Gemini/Claude premiums`,
  ],
    limitations: [
    `Requires a z.ai JWT token (different from typical API keys)`,
    `Custom auth headers (handled by adapter)`,
    `GLM-4-Flash has lower reasoning depth than Plus`,
  ],
    samplePrompts: [
    `Summarize this 30-page spec and extract the top 5 risks.`,
    `Translate this changelog into fluent Chinese and back-translate to verify.`,
    `Refactor this TypeScript function and explain each change.`,
  ],
    setupNotes: `Set ZAI_TOKEN as a Vercel env var (Project → Settings → Environment Variables → Redeploy). Optionally set ZAI_BASE_URL. No per-row API key needed.`,
    pricingTier: `Pay-as-you-go per token. Flash is cheapest; Plus is premium.`,
    docsUrl: `https://docs.z.ai`,
    availableModels: [
    `glm-4-plus`,
    `glm-4-air`,
    `glm-4-long`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `fullstack_dev`,
  ],
    advantages: [
    `Zero-config on Vercel (env var only)`,
    `Strong bilingual capability`,
    `Long-context tier (GLM-4-Long)`,
    `Open-source-friendly licensing`,
  ],
    businessAdvantages: [
    `Lower TCO than US-centric providers for bilingual workloads`,
    `No per-row key management reduces ops burden`,
    `Single env var lights up two providers (Marq GLM + Zai)`,
  ],
    apiIntegrationDetails: `POST https://internal-api.z.ai/v1/chat/completions with headers Authorization: Bearer Z.ai, X-Token: <jwt>, X-Z-AI-From: Z. Marq's callZaiGlm adapter handles the custom auth.`,
  },
  {
    name: `zai`,
    displayName: `Zai`,
    tagline: `Direct z.ai API access to the GLM-4 family.`,
    icon: `Sparkles`,
    color: `#0ea5e9`,
    category: "frontier",
    kind: "service",
    popularity: "medium",
    bestFor: [
    `Frontier-class model without US-centric billing`,
    `Bilingual English/Chinese workloads`,
    `Long-context tasks (GLM-4-Long up to 128K)`,
    `Low-latency interactive chat (GLM-4-Flash)`,
  ],
    capabilities: [
    `Chat with GLM-4-Plus, GLM-4-Air, GLM-4-Long, GLM-4-Flash`,
    `Use as primary or failover`,
    `Run in Compare mode`,
    `Activate instantly with ZAI_TOKEN env var`,
  ],
    whenToUse: [
    `You want frontier-class without US billing footprint`,
    `Workload is bilingual English/Chinese`,
    `Need long-context without Gemini/Claude premiums`,
  ],
    limitations: [
    `Requires z.ai JWT token`,
    `Custom auth headers`,
    `Flash has lower reasoning depth`,
  ],
    samplePrompts: [
    `Summarize this 30-page product spec and extract the top 5 risks.`,
    `Translate this English changelog into natural Chinese and back-translate.`,
    `Refactor this TypeScript function and explain each change.`,
  ],
    setupNotes: `Sign in at z.ai, generate a JWT token from the developer console, set ZAI_TOKEN as a Vercel env var.`,
    pricingTier: `Pay-as-you-go per token. Flash cheapest; Plus premium.`,
    docsUrl: `https://docs.z.ai`,
    availableModels: [
    `glm-4-plus`,
    `glm-4-air`,
    `glm-4-long`,
    `glm-4-flash`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `fullstack_dev`,
  ],
    advantages: [
    `Bilingual fluency (EN + CN)`,
    `Long-context tier`,
    `Env-var-only activation`,
    `Same backend as Marq GLM`,
  ],
    businessAdvantages: [
    `Lower TCO on bilingual workloads`,
    `No US billing footprint`,
    `Single env var activates two providers`,
  ],
    apiIntegrationDetails: `Same as Marq GLM — POST https://internal-api.z.ai/v1/chat/completions with custom X-Token header.`,
  },
  {
    name: `marq_free`,
    displayName: `Marq Free (Always-On)`,
    tagline: `Guaranteed-availability free provider backed by Pollinations.ai. Tried FIRST in auto mode.`,
    icon: `Shield`,
    color: `#10b981`,
    category: "open-source",
    kind: "service",
    popularity: "high",
    bestFor: [
    `Guaranteed real-AI responses when every paid provider is down`,
    `Zero-config deployment`,
    `Cost-free development and prototyping`,
    `Educational use cases where reliability > frontier quality`,
    `Quick smoke-tests without spending tokens`,
  ],
    capabilities: [
    `OpenAI-compatible chat via Pollinations.ai`,
    `Open-source models: gpt-oss-20b, openai-large, mistral, qwen-coder`,
    `Always-on — no API key, no rate limits, no billing`,
    `Tried FIRST in the open-source-first auto mode`,
  ],
    whenToUse: [
    `You want the platform to NEVER throw an error`,
    `First-time testing with no API keys`,
    `You want a real AI response during outages`,
    `Building a demo / POC with zero ongoing API costs`,
  ],
    limitations: [
    `Open-source models — quality below GPT-4o / Claude 3.5`,
    `No tool-use / function-calling support`,
    `Higher latency than dedicated providers`,
    `Not for production workloads with strict SLAs`,
  ],
    samplePrompts: [
    `Hi! Just say hello back.`,
    `What's the capital of France? Answer in one sentence.`,
    `Explain what an API gateway is in 3 bullet points.`,
  ],
    setupNotes: `No setup required. Always live. Uses https://text.pollinations.ai/openai. Seeded at priority 0 — tried first by the failover engine.`,
    pricingTier: `Free. No API key, no rate limits, no billing.`,
    docsUrl: `https://pollinations.ai`,
    availableModels: [
    `openai`,
    `openai-large`,
    `mistral`,
    `qwen-coder`,
  ],
    availableAgents: [
    `general`,
    `research`,
  ],
    advantages: [
    `Always available — no key, no billing`,
    `Open-source models (gpt-oss-20b)`,
    `OpenAI-compatible API`,
    `Zero configuration`,
  ],
    businessAdvantages: [
    `Zero ongoing API cost`,
    `No procurement / billing friction`,
    `Guaranteed SLA: never returns an error to the user`,
    `Ideal for demos, POCs, and dev environments`,
  ],
    apiIntegrationDetails: `POST https://text.pollinations.ai/openai with standard OpenAI body shape. No Authorization header needed. Anonymous tier is rate-limited but generous.`,
  },
  {
    name: `huggingface`,
    displayName: `Hugging Face`,
    tagline: `Open-source model zoo — Llama, Mistral, Phi, CodeLlama, and thousands more.`,
    icon: `Bot`,
    color: `#ff9d00`,
    category: "open-source",
    kind: "platform",
    popularity: "very-high",
    bestFor: [
    `Trying many open-source models without self-hosting`,
    `Finding the right model for a niche task`,
    `Serverless inference on the free tier`,
    `Embeddings (BGE, E5) and small specialized models`,
  ],
    capabilities: [
    `Chat with Llama-3.1-8B-Instruct, Mistral-7B-Instruct, Phi-3-mini-4k-instruct`,
    `Switch models by changing the apiEndpoint to any Hub model`,
    `Use as a failover for open-source-friendly workloads`,
    `Compare open-source quality vs. frontier APIs`,
  ],
    whenToUse: [
    `You want to test 5+ open-source models quickly`,
    `Your task is niche (code, embeddings, classification)`,
    `You're cost-sensitive and can tolerate cold starts`,
    `You want to evaluate before self-hosting`,
  ],
    limitations: [
    `Cold-start latency on free tier (5-30s)`,
    `Rate limits on free tier`,
    `Quality varies wildly by model — pick carefully`,
  ],
    samplePrompts: [
    `Summarize this article in 3 bullet points.`,
    `What's the sentiment of this customer review? Reply POSITIVE, NEGATIVE, or NEUTRAL.`,
    `Generate a Python one-liner to flatten a nested list.`,
  ],
    setupNotes: `Create a free account at huggingface.co, generate an access token in Settings → Access Tokens, paste it into the Providers tab. Default endpoint is the Serverless Inference API.`,
    pricingTier: `Free tier available. Paid Inference Endpoints from $0.06/hour.`,
    docsUrl: `https://huggingface.co/docs/api-inference`,
    availableModels: [
    `meta-llama/Llama-3.1-8B-Instruct`,
    `mistralai/Mistral-7B-Instruct-v0.3`,
    `microsoft/Phi-3-mini-4k-instruct`,
    `meta-llama/Llama-3.1-70B-Instruct`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `fullstack_dev`,
  ],
    advantages: [
    `Massive model zoo (500K+ models)`,
    `Free tier for prototyping`,
    `Serverless — no infra`,
    `Strong for embeddings and small models`,
  ],
    businessAdvantages: [
    `Test many models before committing`,
    `Free tier for POCs`,
    `Easy upgrade path to dedicated Inference Endpoints`,
    `Open-source licensing flexibility`,
  ],
    apiIntegrationDetails: `POST https://api-inference.huggingface.co/models/{model} with Authorization: Bearer <token>. Custom request shape — Marq treats it as OpenAI-compatible via the apiEndpoint override.`,
  },
  {
    name: `ollama`,
    displayName: `Ollama (Local)`,
    tagline: `Run Llama, Mistral, Phi, and 100+ models locally on your own hardware.`,
    icon: `HardDrive`,
    color: `#22c55e`,
    category: "local",
    kind: "framework",
    popularity: "very-high",
    bestFor: [
    `Privacy-first / air-gapped workflows`,
    `Zero per-token cost (just your hardware)`,
    `Offline-capable local chat`,
    `Self-hosted embeddings`,
    `Trying models before deploying to cloud`,
  ],
    capabilities: [
    `Chat with llama3.1, mistral, phi3, qwen2.5, gemma2, and 100+ more`,
    `OpenAI-compatible API at localhost:11434`,
    `Use as a failover when cloud providers are down`,
    `Pin for any agent template that doesn't need frontier quality`,
  ],
    whenToUse: [
    `You can't send data to cloud providers (HIPAA, SOC 2, ITAR)`,
    `You have spare GPU/CPU and want zero per-token cost`,
    `You're building an offline-capable product`,
    `You want to test models locally before deploying`,
  ],
    limitations: [
    `Latency depends on your hardware (20-80 tok/s on a laptop)`,
    `Quality limited by what fits in your VRAM`,
    `No managed scaling — you handle uptime`,
  ],
    samplePrompts: [
    `Explain how RAG works in 5 bullet points.`,
    `Write a Python function to deduplicate a list while preserving order.`,
    `What are the trade-offs of B-tree vs. hash indexes?`,
  ],
    setupNotes: `Install Ollama from ollama.com, run \`ollama serve\`, then pull models with \`ollama pull llama3.1\`. Set the apiEndpoint to http://localhost:11434/v1/chat/completions in the Providers tab. No API key needed.`,
    pricingTier: `Free (open-source). You pay only for your hardware.`,
    docsUrl: `https://ollama.com`,
    availableModels: [
    `llama3.1`,
    `mistral`,
    `phi3`,
    `qwen2.5`,
    `gemma2`,
    `deepseek-r1`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `fullstack_dev`,
    `testing`,
  ],
    advantages: [
    `Zero per-token cost`,
    `Full data privacy`,
    `Offline-capable`,
    `OpenAI-compatible API`,
    `100+ models supported`,
  ],
    businessAdvantages: [
    `Eliminates API spend`,
    `Satisfies data residency requirements (HIPAA, ITAR, GDPR)`,
    `No vendor lock-in`,
    `Predictable cost = hardware amortization`,
  ],
    apiIntegrationDetails: `POST http://localhost:11434/v1/chat/completions (OpenAI-compatible). No auth header. Set OLLAMA_HOST env var to bind a different address.`,
  },
  {
    name: `replit`,
    displayName: `Replit`,
    tagline: `Cloud IDE coding model tuned for short, runnable snippets.`,
    icon: `Code`,
    color: `#f26207`,
    category: "specialized",
    kind: "service",
    popularity: "medium",
    bestFor: [
    `Short runnable code snippets with inline explanations`,
    `Cloud IDE workflows`,
    `Quick prototyping`,
    `Educational coding`,
  ],
    capabilities: [
    `Chat with replit-code-v1_5-3b and replit-code-v1_5-7b`,
    `Use as a code-focused failover`,
    `Pin for the Full-Stack Developer agent on small tasks`,
  ],
    whenToUse: [
    `You want short, runnable code over long explanations`,
    `You're in a Replit-style quick-prototype flow`,
  ],
    limitations: [
    `Smaller and less capable than frontier code models`,
    `Specialized — weak on general chat`,
    `API access requires Replit account`,
  ],
    samplePrompts: [
    `Write a Python one-liner to reverse a dictionary.`,
    `Generate a Node.js Express route that returns JSON.`,
    `Show me a quick bash script to find the largest file in a directory.`,
  ],
    setupNotes: `Sign up at replit.com, generate an API key in account settings, paste into the Providers tab. The endpoint (model-proxy.replit.com/v1/chat/completions) is OpenAI-compatible.`,
    pricingTier: `Included with Replit subscription. Free tier available.`,
    docsUrl: `https://docs.replit.com`,
    availableModels: [
    `replit-code-v1_5-3b`,
    `replit-code-v1_5-7b`,
  ],
    availableAgents: [
    `fullstack_dev`,
    `testing`,
  ],
    advantages: [
    `Tuned for short, runnable code`,
    `Open weights (replit-code)`,
    `Fast inference`,
    `Good for educational use`,
  ],
    businessAdvantages: [
    `Lower cost than frontier models for code tasks`,
    `Good fit for coding bootcamps / education`,
    `Quick prototyping flow`,
  ],
    apiIntegrationDetails: `POST https://model-proxy.replit.com/v1/chat/completions with Authorization: Bearer <key>. OpenAI-compatible.`,
  },
  {
    name: `modal`,
    displayName: `Modal (Serverless)`,
    tagline: `Serverless inference platform — package any model as a scalable Modal function.`,
    icon: `Server`,
    color: `#7c3aed`,
    category: "specialized",
    kind: "platform",
    popularity: "medium",
    bestFor: [
    `Custom-deployed models as scalable endpoints`,
    `Pay-per-invocation serverless inference`,
    `GPU autoscaling without managing instances`,
    `CI/CD for ML models`,
  ],
    capabilities: [
    `Wrap any model as a Modal function`,
    `OpenAI-compatible gateway for custom deployments`,
    `Use as a failover for self-hosted models`,
    `Pin for agents that need a custom model`,
  ],
    whenToUse: [
    `You have a fine-tuned model and need serverless hosting`,
    `You want GPU autoscaling without k8s`,
    `You're building an MLOps pipeline`,
  ],
    limitations: [
    `Cold start 3-30s depending on model size`,
    `You deploy and maintain the model code`,
    `Not a chat model out of the box — you wrap it`,
  ],
    samplePrompts: [
    `Run inference on my fine-tuned Llama-3.1-8B with this prompt: ...`,
    `Score this customer review for churn risk using my deployed classifier.`,
    `Generate an embedding for this document using my BGE deployment.`,
  ],
    setupNotes: `Sign up at modal.com, install the modal Python package, deploy your model with \`modal deploy\`. Get the resulting endpoint URL and set it as the apiEndpoint in the Providers tab. Use your Modal token ID/secret as the API key.`,
    pricingTier: `Pay per compute second. Free tier includes $30/month of credits.`,
    docsUrl: `https://modal.com/docs`,
    availableModels: [
    `custom (you deploy)`,
  ],
    availableAgents: [
    `general`,
    `fullstack_dev`,
  ],
    advantages: [
    `Serverless GPU autoscaling`,
    `No infra management`,
    `Pay-per-invocation`,
    `Open-source friendly`,
  ],
    businessAdvantages: [
    `Lower TCO than always-on GPU instances for spiky workloads`,
    `CI/CD native`,
    `Scales to zero when idle`,
  ],
    apiIntegrationDetails: `Deploy your model with \`modal deploy\`, then POST to the resulting URL. Modal supports OpenAI-compatible wrappers via \`modal serve\`.`,
  },
  {
    name: `gradio`,
    displayName: `Gradio Spaces`,
    tagline: `Hugging Face Gradio Spaces — interactive ML demos as chat providers.`,
    icon: `Layout`,
    color: `#f97316`,
    category: "specialized",
    kind: "platform",
    popularity: "medium",
    bestFor: [
    `Interactive ML demos`,
    `Trying niche models from the HF Spaces community`,
    `Prototyping before committing to a hosted provider`,
    `Educational / hackathon use cases`,
  ],
    capabilities: [
    `Talk to any HF Space's underlying model via its API URL`,
    `Use as a niche-model failover`,
    `Pin for agents that need a specific Space's model`,
  ],
    whenToUse: [
    `You want to try a model that only exists as a Space`,
    `You're prototyping and don't want to deploy yourself`,
    `Hackathon / educational scenarios`,
  ],
    limitations: [
    `Spaces can be unreliable (community-maintained)`,
    `Cold starts common`,
    `Not for production workloads`,
  ],
    samplePrompts: [
    `Describe this image in 3 sentences.`,
    `Transcribe this 30-second audio clip.`,
    `Generate a Stable Diffusion image of a futuristic city.`,
  ],
    setupNotes: `Find a Space on huggingface.co/spaces, copy its API URL, set as the apiEndpoint in the Providers tab. Some Spaces require a HF token.`,
    pricingTier: `Free for community Spaces. Paid Spaces from $5/month.`,
    docsUrl: `https://www.gradio.app/docs`,
    availableModels: [
    `whisper-gradio`,
    `stable-diffusion-gradio`,
    `(any Space's model)`,
  ],
    availableAgents: [
    `general`,
    `research`,
  ],
    advantages: [
    `Access to 500K+ community demos`,
    `Free tier`,
    `Quick to try`,
    `No deployment needed`,
  ],
    businessAdvantages: [
    `Rapid prototyping`,
    `Evaluate niche models before self-hosting`,
    `Low commitment`,
  ],
    apiIntegrationDetails: `POST to the Space's /api/predict or /call endpoint. Shape varies by Space — Marq uses the OpenAI-compatible layer when the Space supports it.`,
  },
  {
    name: `mlflow`,
    displayName: `MLflow AI Gateway`,
    tagline: `Route chat through your own registered, version-controlled models.`,
    icon: `Database`,
    color: `#0ea5e9`,
    category: "specialized",
    kind: "package",
    popularity: "medium",
    bestFor: [
    `MLOps workflows with model versioning`,
    `Route to registered models with audit trails`,
    `A/B test model versions`,
    `Centralized gateway for organizational models`,
  ],
    capabilities: [
    `Route chat through MLflow AI Gateway`,
    `Use any registered model version`,
    `OpenAI-compatible gateway`,
    `Pin for agents that need a specific model version`,
  ],
    whenToUse: [
    `You have an MLOps pipeline using MLflow`,
    `You need model versioning and audit trails`,
    `You're A/B testing model versions`,
  ],
    limitations: [
    `You must run the MLflow AI Gateway server`,
    `Not a chat model itself — wraps your registered models`,
    `Requires MLflow expertise`,
  ],
    samplePrompts: [
    `Generate a completion using my registered model v2.3.`,
    `Score this lead using my classifier v1.5.`,
    `Embed this document using my BGE v1 deployment.`,
  ],
    setupNotes: `Install MLflow (\`pip install mlflow\`), start the AI Gateway with \`mlflow gateway start --config config.yaml\`, set the apiEndpoint to http://localhost:5000/v1/chat/completions in the Providers tab.`,
    pricingTier: `Free (open-source). You pay for the underlying model inference.`,
    docsUrl: `https://mlflow.org/docs/latest/gateway/index.html`,
    availableModels: [
    `your registered models`,
  ],
    availableAgents: [
    `general`,
  ],
    advantages: [
    `Model versioning + audit trail`,
    `OpenAI-compatible gateway`,
    `A/B test support`,
    `Free and open-source`,
  ],
    businessAdvantages: [
    `Centralized model governance`,
    `Compliance-ready audit logs`,
    `Smooth promotion from dev → staging → prod`,
  ],
    apiIntegrationDetails: `POST to your MLflow AI Gateway URL (default http://localhost:5000/v1/chat/completions). OpenAI-compatible. Configure routes in config.yaml.`,
  },
  {
    name: `crewai`,
    displayName: `CrewAI Orchestrator`,
    tagline: `Multi-agent orchestration — decompose goals across role-based agents.`,
    icon: `Users`,
    color: `#ec4899`,
    category: "orchestration",
    kind: "framework",
    popularity: "high",
    bestFor: [
    `Multi-agent decomposition (Researcher → Analyst → Writer)`,
    `Complex tasks that need role specialization`,
    `Workflows with handoffs between agents`,
    `Educational use for agentic patterns`,
  ],
    capabilities: [
    `Define a Crew of role-based agents`,
    `Decompose goals across the Crew`,
    `Synthesize outputs into a final answer`,
    `Use as a backend for complex agent tasks`,
  ],
    whenToUse: [
    `A single agent can't handle the full task`,
    `You want explicit role specialization`,
    `You're teaching agentic patterns`,
  ],
    limitations: [
    `You must run the CrewAI server`,
    `Higher latency (multiple LLM calls per task)`,
    `More complex to debug`,
  ],
    samplePrompts: [
    `Research the top 3 competitors to our product, analyze their pricing, and write a 1-page brief.`,
    `Decompose this bug report: identify the likely root cause, propose 3 fixes, and recommend one.`,
    `Plan a product launch: build a timeline, identify risks, and assign owners.`,
  ],
    setupNotes: `Install CrewAI (\`pip install crewai\`), define your Crew in Python, expose it as an OpenAI-compatible endpoint (via a small FastAPI wrapper), set the apiEndpoint in the Providers tab.`,
    pricingTier: `Free (open-source). CrewAI+ hosted from $99/month.`,
    docsUrl: `https://docs.crewai.com`,
    availableModels: [
    `your crew's underlying LLM`,
  ],
    availableAgents: [
    `general`,
    `business_analyst`,
    `research`,
  ],
    advantages: [
    `Multi-agent decomposition`,
    `Role specialization`,
    `Open-source`,
    `Good for complex workflows`,
  ],
    businessAdvantages: [
    `Handles complex tasks a single agent can't`,
    `Auditable role-based reasoning`,
    `Open-source = no vendor lock-in`,
  ],
    apiIntegrationDetails: `Expose your Crew as an OpenAI-compatible endpoint (FastAPI wrapper), then POST to that URL. Marq treats it like any OpenAI-compatible provider.`,
  },
  {
    name: `langchain`,
    displayName: `LangChain / LangServe`,
    tagline: `Compose prompts, retrievers, and tools into reproducible chains.`,
    icon: `Link`,
    color: `#14b8a6`,
    category: "orchestration",
    kind: "package",
    popularity: "very-high",
    bestFor: [
    `RAG pipelines with retrievers`,
    `Tool-using chains (search + LLM)`,
    `Reproducible LLM workflows`,
    `Production LLM apps with monitoring`,
  ],
    capabilities: [
    `Compose chains of prompts + tools + retrievers`,
    `Expose any chain via LangServe as a chat endpoint`,
    `Use as a backend for RAG-style agent tasks`,
    `Pin for agents that need retrieval-augmented answers`,
  ],
    whenToUse: [
    `You need RAG (retrieval-augmented generation)`,
    `You're composing multi-step LLM workflows`,
    `You want LangSmith monitoring`,
  ],
    limitations: [
    `You must run the LangServe server`,
    `Higher latency (multi-step chains)`,
    `Learning curve for chain composition`,
  ],
    samplePrompts: [
    `Answer based on our internal docs: what's our refund policy?`,
    `Search the web for X, then summarize the top 3 results.`,
    `Use the calculator tool to compute compound interest on $10K at 7% for 10 years.`,
  ],
    setupNotes: `Install LangChain + LangServe (\`pip install langchain langserve\`), define your chain in Python, expose via FastAPI, set the apiEndpoint in the Providers tab.`,
    pricingTier: `Free (open-source). LangSmith monitoring from $39/month.`,
    docsUrl: `https://python.langchain.com`,
    availableModels: [
    `your chain's underlying LLM`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `fullstack_dev`,
  ],
    advantages: [
    `Composable chains`,
    `RAG support out of the box`,
    `LangSmith monitoring`,
    `Huge ecosystem`,
  ],
    businessAdvantages: [
    `Standardized LLM app patterns`,
    `Monitoring + observability via LangSmith`,
    `Large talent pool (most popular LLM framework)`,
  ],
    apiIntegrationDetails: `Expose your chain via LangServe (FastAPI), then POST to the /chat/completions endpoint. Marq treats it as OpenAI-compatible.`,
  },
  {
    name: `qvac`,
    displayName: `Qvac Quantum-Inspired`,
    tagline: `Explores multiple solution paths in parallel — recommends the most defensible.`,
    icon: `Atom`,
    color: `#8b5cf6`,
    category: "specialized",
    kind: "service",
    popularity: "low",
    bestFor: [
    `Decisions with multiple defensible answers`,
    `Tasks where you want a 'second opinion'`,
    `Risk-aware recommendations`,
    `Complex trade-off analysis`,
    `Educational use for multi-path reasoning`,
  ],
    capabilities: [
    `Chat with the Qvac reasoning model`,
    `Use as a 'devil's advocate' failover`,
    `Compare multi-path reasoning vs. single-model answers`,
    `Pin for high-stakes decisions`,
  ],
    whenToUse: [
    `The decision is high-stakes and you want multiple framings`,
    `A single model gives a confident answer but you suspect overfitting`,
    `You're documenting a decision and need alternatives considered`,
  ],
    limitations: [
    `Higher latency (parallel path exploration)`,
    `Verbose output (3 paths + synthesis)`,
    `Specialized — overkill for simple lookups`,
  ],
    samplePrompts: [
    `Should we migrate from Postgres to DynamoDB? Explore 3 paths and recommend one.`,
    `We have $50K to spend on growth. Explore 3 allocation strategies and recommend the most defensible.`,
    `A customer is asking for a feature our roadmap doesn't include. Explore 3 responses and recommend the best.`,
  ],
    setupNotes: `Get an API key from your Qvac account or self-hosted instance. Set the apiEndpoint to your Qvac gateway URL. OpenAI-compatible.`,
    pricingTier: `Varies by deployment. Self-hosted is free + hardware costs.`,
    docsUrl: `https://docs.qvac.ai`,
    availableModels: [
    `qvac-reason-v1`,
    `qvac-decide-v1`,
  ],
    availableAgents: [
    `general`,
    `business_analyst`,
    `research`,
  ],
    advantages: [
    `Multi-path reasoning`,
    `Explicit alternative consideration`,
    `Good for high-stakes decisions`,
    `Educational value`,
  ],
    businessAdvantages: [
    `Reduces decision risk`,
    `Documents alternatives considered (compliance-friendly)`,
    `Differentiated vs. single-model providers`,
  ],
    apiIntegrationDetails: `POST to your Qvac gateway URL with Authorization: Bearer <key>. OpenAI-compatible.`,
  },
  {
    name: `anaconda`,
    displayName: `Anaconda Platform`,
    tagline: `Enterprise Python data science platform — package management, environments, and ML distribution.`,
    icon: `Server`,
    color: `#42b029`,
    category: "open-source",
    kind: "platform",
    popularity: "very-high",
    bestFor: [
    `Enterprise Python package management`,
    `Reproducible data science environments`,
    `ML model distribution via Anaconda Repository`,
    `Team-wide environment standardization`,
  ],
    capabilities: [
    `Conda package + environment management`,
    `Anaconda Repository for private package hosting`,
    `Anaconda Enterprise for team collaboration`,
    `Distribution channel for open-source ML models`,
  ],
    whenToUse: [
    `Your team needs reproducible Python environments`,
    `You're distributing ML models internally via conda packages`,
    `You need enterprise-grade Python package governance`,
  ],
    limitations: [
    `Not a chat completion API itself`,
    `Conda environments can be slow to resolve`,
    `Commercial use of defaults channel requires a paid license for 200+ employees`,
  ],
    samplePrompts: [
    `(Informational) How do I create a conda environment for PyTorch 2.4 with CUDA 12.1?`,
    `(Informational) What's the difference between conda and pip?`,
    `(Informational) How do I publish a model to our private Anaconda Repository?`,
  ],
    setupNotes: `Install Anaconda or Miniconda from anaconda.com. For Anaconda Enterprise / Repository, contact Anaconda sales. No API key needed for conda CLI; Enterprise uses SSO.`,
    pricingTier: `Free for individuals (Individual Edition). Commercial tiers from $10K/year for Anaconda Enterprise.`,
    docsUrl: `https://docs.anaconda.com`,
    availableModels: [
    `(package distribution — bundles PyTorch, TensorFlow, scikit-learn, etc.)`,
  ],
    availableAgents: [
    `general`,
  ],
    advantages: [
    `Reproducible environments`,
    `Massive package repository`,
    `Enterprise governance`,
    `Cross-platform (Win/Mac/Linux)`,
  ],
    businessAdvantages: [
    `Standardized Python environment across teams`,
    `Audit-ready package provenance`,
    `Air-gapped / offline install support`,
    `Reduces 'works on my machine' incidents`,
  ],
    apiIntegrationDetails: `CLI tool (conda) — no HTTP API. For Anaconda Enterprise, REST API at https://repo.anaconda.com/api. Marq lists Anaconda as a platform reference; runtime chat requires wrapping a conda-managed model via Ollama/vLLM.`,
  },
  {
    name: `outerbounds`,
    displayName: `Outerbounds`,
    tagline: `Metaflow-based ML/AI platform — production-grade pipelines for serious ML teams.`,
    icon: `Server`,
    color: `#1e293b`,
    category: "orchestration",
    kind: "platform",
    popularity: "medium",
    bestFor: [
    `Production ML pipelines at scale`,
    `Reproducible experiments with versioning`,
    `Metaflow-based workflows (Netflix-origin)`,
    `Team collaboration on ML projects`,
  ],
    capabilities: [
    `Build ML pipelines with Metaflow`,
    `Version + resume runs`,
    `Deploy to Kubernetes / serverless`,
    `Integrate with any model registry`,
  ],
    whenToUse: [
    `You're building production ML pipelines`,
    `You need experiment tracking + versioning`,
    `Your team is too big for notebooks but too small for k8s from scratch`,
  ],
    limitations: [
    `Not a chat model — it's a pipeline platform`,
    `Requires Metaflow learning curve`,
    `Pricing is contact-sales`,
  ],
    samplePrompts: [
    `(Informational) How do I structure a Metaflow flow for fine-tuning Llama-3.1?`,
    `(Informational) What's the difference between Metaflow and Airflow for ML?`,
    `(Informational) How do I deploy a Metaflow artifact as an API?`,
  ],
    setupNotes: `Sign up at outerbounds.com, install the Metaflow SDK, configure your workspace token. Marq lists Outerbounds as a platform reference; chat integration requires deploying a Metaflow artifact as an OpenAI-compatible endpoint.`,
    pricingTier: `Free for individuals (Metaflow OSS). Outerbounds managed from $2K/month.`,
    docsUrl: `https://docs.outerbounds.com`,
    availableModels: [
    `(your pipeline artifacts)`,
  ],
    availableAgents: [
    `general`,
  ],
    advantages: [
    `Netflix-battle-tested Metaflow`,
    `Production-grade pipelines`,
    `Versioning + resumability`,
    `Cloud-native (k8s)`,
  ],
    businessAdvantages: [
    `Faster ML productionization`,
    `Reproducible experiments`,
    `Reduced ML ops headcount needs`,
  ],
    apiIntegrationDetails: `Use the Metaflow SDK to define flows, then deploy via Outerbounds. Expose inference as an OpenAI-compatible endpoint; Marq treats the resulting URL as a custom provider.`,
  },
  {
    name: `pytorch`,
    displayName: `PyTorch`,
    tagline: `Open-source tensor library — the foundation of modern deep learning.`,
    icon: `FlaskConical`,
    color: `#ee4c2c`,
    category: "open-source",
    kind: "package",
    popularity: "very-high",
    bestFor: [
    `Custom model training and fine-tuning`,
    `Research — flexible eager execution`,
    `Production inference via TorchServe`,
    `GPU-accelerated tensor computation`,
  ],
    capabilities: [
    `Define + train neural networks`,
    `Fine-tune Hugging Face models`,
    `Serve models via TorchServe (OpenAI-compatible wrapper possible)`,
    `Distributed training across GPUs/TPUs`,
  ],
    whenToUse: [
    `You're training or fine-tuning a model`,
    `You need GPU-accelerated tensor math`,
    `You're doing ML research`,
  ],
    limitations: [
    `Not a chat model — it's a tensor library`,
    `Requires Python + CUDA expertise`,
    `Inference requires wrapping with a server (TorchServe / vLLM)`,
  ],
    samplePrompts: [
    `(Informational) How do I fine-tune Llama-3.1-8B with LoRA in PyTorch?`,
    `(Informational) What's the difference between torch.compile and eager mode?`,
    `(Informational) How do I use DDP for multi-GPU training?`,
  ],
    setupNotes: `Install via pip (\`pip install torch\`) or conda. For GPU, install CUDA-matched build. Marq lists PyTorch as a package reference; chat integration requires serving a PyTorch model via TorchServe + an OpenAI-compatible wrapper.`,
    pricingTier: `Free (open-source).`,
    docsUrl: `https://pytorch.org/docs`,
    availableModels: [
    `(any model you train or fine-tune)`,
  ],
    availableAgents: [
    `general`,
  ],
    advantages: [
    `Industry standard for ML research`,
    `Eager execution = easy debugging`,
    `Massive ecosystem`,
    `GPU + TPU support`,
  ],
    businessAdvantages: [
    `Large talent pool`,
    `Most HF models are PyTorch-native`,
    `No vendor lock-in`,
    `Active community + Meta backing`,
  ],
    apiIntegrationDetails: `Python library — no HTTP API. Wrap with TorchServe or FastAPI to expose an OpenAI-compatible endpoint. Marq lists PyTorch as a catalog reference; runtime chat requires serving it.`,
  },
  {
    name: `tensorflow`,
    displayName: `TensorFlow`,
    tagline: `End-to-end ML platform — from research to production at Google scale.`,
    icon: `FlaskConical`,
    color: `#ff6f00`,
    category: "open-source",
    kind: "package",
    popularity: "very-high",
    bestFor: [
    `Production ML at scale (TF Serving)`,
    `Mobile / edge ML (TF Lite)`,
    `Web ML (TF.js)`,
    `Distributed training across TPUs`,
  ],
    capabilities: [
    `Train + serve models`,
    `TF Serving for production inference`,
    `TF Lite for mobile`,
    `TF.js for browser-based ML`,
  ],
    whenToUse: [
    `You need mobile/edge deployment`,
    `You're on Google Cloud (TPU optimization)`,
    `You want end-to-end ML platform (training → serving → monitoring)`,
  ],
    limitations: [
    `Smaller research community than PyTorch`,
    `Static graphs (less debugging-friendly)`,
    `Not a chat model — wrap with TF Serving`,
  ],
    samplePrompts: [
    `(Informational) How do I export a TF model for TF Serving?`,
    `(Informational) What's the difference between TF Lite and TF Micro?`,
    `(Informational) How do I train a model on TPUs?`,
  ],
    setupNotes: `Install via pip (\`pip install tensorflow\`). For GPU, install tensorflow-gpu or the CUDA-matched build. Marq lists TF as a catalog reference; runtime chat requires TF Serving + an OpenAI-compatible wrapper.`,
    pricingTier: `Free (open-source).`,
    docsUrl: `https://www.tensorflow.org`,
    availableModels: [
    `(any model you train)`,
  ],
    availableAgents: [
    `general`,
  ],
    advantages: [
    `Production-grade (TF Serving)`,
    `Mobile (TF Lite) + web (TF.js)`,
    `TPU optimization`,
    `End-to-end platform`,
  ],
    businessAdvantages: [
    `Strong for mobile/edge ML`,
    `Tight Google Cloud integration`,
    `Mature monitoring via TF Serving`,
  ],
    apiIntegrationDetails: `Python library — no HTTP API. Wrap with TF Serving (gRPC or REST) to expose an OpenAI-compatible endpoint. Marq lists TF as a catalog reference.`,
  },
  {
    name: `keras`,
    displayName: `Keras`,
    tagline: `High-level neural network API — friendly interface over TensorFlow/JAX/PyTorch.`,
    icon: `Layers`,
    color: `#d00000`,
    category: "open-source",
    kind: "package",
    popularity: "high",
    bestFor: [
    `Beginner-friendly deep learning`,
    `Rapid prototyping`,
    `Educational use`,
    `Multi-backend (TF, JAX, PyTorch)`,
  ],
    capabilities: [
    `Build models in 10 lines of code`,
    `Multi-backend: TF, JAX, PyTorch`,
    `Keras 3 unifies the three backends`,
    `Easy deployment via TF Serving / JAX export`,
  ],
    whenToUse: [
    `You're new to deep learning`,
    `You want to prototype quickly`,
    `You're teaching ML`,
  ],
    limitations: [
    `Less flexible than raw PyTorch/TF`,
    `Not a chat model — wrap with a server`,
    `Performance slightly lower than raw backend`,
  ],
    samplePrompts: [
    `(Informational) How do I build a simple CNN in Keras 3?`,
    `(Informational) What's the difference between Keras 2 (TF-only) and Keras 3 (multi-backend)?`,
    `(Informational) How do I switch backends in Keras 3?`,
  ],
    setupNotes: `Install via pip (\`pip install keras\`). Keras 3 auto-detects installed backend (TF, JAX, PyTorch). Marq lists Keras as a catalog reference; runtime chat requires serving a Keras model.`,
    pricingTier: `Free (open-source).`,
    docsUrl: `https://keras.io`,
    availableModels: [
    `(any model you build)`,
  ],
    availableAgents: [
    `general`,
  ],
    advantages: [
    `Beginner-friendly`,
    `Multi-backend (Keras 3)`,
    `Rapid prototyping`,
    `Large tutorial ecosystem`,
  ],
    businessAdvantages: [
    `Lower barrier to ML adoption`,
    `Faster prototyping → faster iteration`,
    `Educational resource for new hires`,
  ],
    apiIntegrationDetails: `Python library — no HTTP API. Export model and serve via the backend's serving stack (TF Serving, JAX export, TorchServe). Marq lists Keras as a catalog reference.`,
  },
  {
    name: `opencv`,
    displayName: `OpenCV`,
    tagline: `Computer vision library — 2500+ algorithms for image/video processing.`,
    icon: `Eye`,
    color: `#06a77d`,
    category: "specialized",
    kind: "package",
    popularity: "very-high",
    bestFor: [
    `Image processing (filtering, transforms)`,
    `Object detection (Haar, YOLO integration)`,
    `Video analysis (tracking, optical flow)`,
    `Camera calibration + 3D vision`,
  ],
    capabilities: [
    `2500+ CV algorithms`,
    `Real-time image/video processing`,
    `Integration with DNN module for inference`,
    `Cross-platform (C++, Python, Java, mobile)`,
  ],
    whenToUse: [
    `You're doing classical CV (not deep learning)`,
    `You need real-time image processing`,
    `You're on mobile or edge devices`,
  ],
    limitations: [
    `Not a chat model — pure CV library`,
    `Deep learning support is limited (use with PyTorch/TF for serious DL)`,
    `C++ API is the canonical one; Python is a binding`,
  ],
    samplePrompts: [
    `(Informational) How do I detect faces in an image with OpenCV?`,
    `(Informational) What's the difference between Canny and Sobel edge detection?`,
    `(Informational) How do I calibrate a camera with OpenCV?`,
  ],
    setupNotes: `Install via pip (\`pip install opencv-python\`) or conda. Marq lists OpenCV as a catalog reference; not a chat provider.`,
    pricingTier: `Free (open-source BSD license).`,
    docsUrl: `https://docs.opencv.org`,
    availableModels: [
    `(Haar cascades, DNN models — bundle your own)`,
  ],
    availableAgents: [
    `general`,
  ],
    advantages: [
    `Industry-standard CV library`,
    `Real-time performance`,
    `Cross-platform`,
    `BSD license = commercial-friendly`,
  ],
    businessAdvantages: [
    `No CV licensing cost`,
    `Large talent pool`,
    `Mature + stable API`,
    `Embedded/edge-ready`,
  ],
    apiIntegrationDetails: `C++/Python library — no HTTP API. For chat-style access, wrap OpenCV functions in a FastAPI server. Marq lists OpenCV as a catalog reference only.`,
  },
  {
    name: `scikit_learn`,
    displayName: `Scikit-learn`,
    tagline: `Classical ML library — random forests, SVMs, clustering, and more.`,
    icon: `FlaskConical`,
    color: `#f7931e`,
    category: "open-source",
    kind: "package",
    popularity: "very-high",
    bestFor: [
    `Tabular ML (classification, regression)`,
    `Clustering + dimensionality reduction`,
    `Model evaluation + selection`,
    `Preprocessing pipelines`,
  ],
    capabilities: [
    `30+ classical ML algorithms`,
    `Pipeline + GridSearch for hyperparameter tuning`,
    `Cross-validation + metrics`,
    `Integration with NumPy, pandas, SciPy`,
  ],
    whenToUse: [
    `Your data is tabular (not text/images)`,
    `You need interpretable models`,
    `You're doing baseline ML before deep learning`,
  ],
    limitations: [
    `Not deep learning (use PyTorch/TF for that)`,
    `Not a chat model — wrap with a server`,
    `Single-machine (no distributed training)`,
  ],
    samplePrompts: [
    `(Informational) How do I tune a RandomForestClassifier with GridSearchCV?`,
    `(Informational) What's the difference between PCA and t-SNE?`,
    `(Informational) How do I handle imbalanced classes in sklearn?`,
  ],
    setupNotes: `Install via pip (\`pip install scikit-learn\`). Marq lists sklearn as a catalog reference; runtime chat requires wrapping a trained model in a FastAPI server.`,
    pricingTier: `Free (open-source BSD license).`,
    docsUrl: `https://scikit-learn.org`,
    availableModels: [
    `RandomForest, GradientBoosting, SVM, KMeans, PCA, etc.`,
  ],
    availableAgents: [
    `general`,
    `business_analyst`,
  ],
    advantages: [
    `Best-in-class classical ML`,
    `Interpretable models`,
    `Easy to use`,
    `BSD license`,
  ],
    businessAdvantages: [
    `No ML licensing cost`,
    `Interpretable models (compliance-friendly)`,
    `Single-machine = simple ops`,
    `Large talent pool`,
  ],
    apiIntegrationDetails: `Python library — no HTTP API. Wrap a trained sklearn model in FastAPI to expose an OpenAI-compatible endpoint. Marq lists sklearn as a catalog reference.`,
  },
  {
    name: `transformers`,
    displayName: `Transformers (HF)`,
    tagline: `Hugging Face Transformers library — run 500K+ pretrained models locally.`,
    icon: `Boxes`,
    color: `#ffd21e`,
    category: "open-source",
    kind: "package",
    popularity: "very-high",
    bestFor: [
    `Running pretrained LLMs locally`,
    `Fine-tuning with Trainer API`,
    `Pipelines for text/classification/vision`,
    `Access to 500K+ HF Hub models`,
  ],
    capabilities: [
    `Load any HF Hub model in 2 lines`,
    `Text generation, classification, translation, summarization`,
    `Vision (ViT, DETR) + audio (Whisper)`,
    `Trainer API for fine-tuning`,
  ],
    whenToUse: [
    `You want to run a model locally (privacy / cost)`,
    `You're fine-tuning a pretrained model`,
    `You need pipelines for quick inference`,
  ],
    limitations: [
    `Requires GPU for serious models`,
    `Not a hosted API — run it yourself`,
    `Memory management is on you`,
  ],
    samplePrompts: [
    `(Informational) How do I load and run Llama-3.1-8B with Transformers?`,
    `(Informational) What's the difference between AutoModelForCausalLM and pipeline?`,
    `(Informational) How do I fine-tune a model with the Trainer API?`,
  ],
    setupNotes: `Install via pip (\`pip install transformers\`). For GPU, install with torch+cuda. Marq lists Transformers as a catalog reference; runtime chat requires serving a model via Text Generation Inference (TGI) or vLLM.`,
    pricingTier: `Free (open-source Apache 2.0).`,
    docsUrl: `https://huggingface.co/docs/transformers`,
    availableModels: [
    `(any of 500K+ HF Hub models — Llama, Mistral, Phi, Qwen, etc.)`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `fullstack_dev`,
  ],
    advantages: [
    `Massive model ecosystem`,
    `Trainer API for fine-tuning`,
    `Pipelines for quick inference`,
    `Apache 2.0 license`,
  ],
    businessAdvantages: [
    `Self-host any HF model`,
    `No per-token cost (just hardware)`,
    `Full data privacy`,
    `Fine-tuning for domain adaptation`,
  ],
    apiIntegrationDetails: `Python library — no HTTP API. Wrap with Text Generation Inference (TGI) or vLLM to expose an OpenAI-compatible endpoint. Marq lists Transformers as a catalog reference.`,
  },
  {
    name: `instructor`,
    displayName: `Instructor`,
    tagline: `Structured extraction from LLMs — Pydantic-powered typed outputs.`,
    icon: `Code`,
    color: `#3b82f6`,
    category: "specialized",
    kind: "package",
    popularity: "medium",
    bestFor: [
    `Structured data extraction from LLM output`,
    `Typed LLM responses (Pydantic models)`,
    `Validation + retry on bad outputs`,
    `Function-calling wrapper for any LLM`,
  ],
    capabilities: [
    `Extract Pydantic models from LLM responses`,
    `Works with OpenAI, Anthropic, Gemini, Ollama, etc.`,
    `Validation + automatic retry on parse failure`,
    `Streaming structured outputs`,
  ],
    whenToUse: [
    `You need structured data (not free text)`,
    `You're building an API on top of an LLM`,
    `You want type safety on LLM outputs`,
  ],
    limitations: [
    `Not a chat model — it's a wrapper library`,
    `Adds latency (validation + retry)`,
    `Python-only (no JS port)`,
  ],
    samplePrompts: [
    `(Informational) How do I extract a Customer object from an LLM response with Instructor?`,
    `(Informational) What's the difference between Instructor and LangChain's output parsers?`,
    `(Informational) How do I retry on validation failure?`,
  ],
    setupNotes: `Install via pip (\`pip install instructor\`). Works with any LLM client (OpenAI, Anthropic, etc.). Marq lists Instructor as a catalog reference; not a chat provider itself.`,
    pricingTier: `Free (open-source MIT license).`,
    docsUrl: `https://python.useinstructor.com`,
    availableModels: [
    `(any LLM via its client library)`,
  ],
    availableAgents: [
    `general`,
    `fullstack_dev`,
    `business_analyst`,
  ],
    advantages: [
    `Type-safe LLM outputs`,
    `Pydantic validation`,
    `Works with any LLM`,
    `Auto-retry on failure`,
  ],
    businessAdvantages: [
    `Reliable structured outputs for production`,
    `Reduces post-processing code`,
    `Type safety = fewer runtime bugs`,
    `Composable with any LLM provider`,
  ],
    apiIntegrationDetails: `Python library — wraps your existing LLM client. No HTTP API of its own. Marq lists Instructor as a catalog reference.`,
  },
  {
    name: `vllm`,
    displayName: `vLLM`,
    tagline: `High-throughput LLM serving — PagedAttention for production inference.`,
    icon: `Server`,
    color: `#22c55e`,
    category: "open-source",
    kind: "framework",
    popularity: "high",
    bestFor: [
    `High-throughput LLM serving`,
    `Production inference for open-source models`,
    `PagedAttention = 2-4x throughput`,
    `Continuous batching`,
  ],
    capabilities: [
    `Serve Llama, Mistral, Qwen, DeepSeek, and more`,
    `OpenAI-compatible API server`,
    `PagedAttention for memory efficiency`,
    `Tensor parallelism for multi-GPU`,
  ],
    whenToUse: [
    `You're self-hosting an open-source LLM`,
    `You need high throughput (1000s of req/s)`,
    `You want OpenAI compatibility without OpenAI pricing`,
  ],
    limitations: [
    `Requires GPU (A10 minimum, A100/H100 for big models)`,
    `You manage infra + scaling`,
    `Not all models supported (check the list)`,
  ],
    samplePrompts: [
    `What's the capital of France?`,
    `Write a Python function to reverse a string.`,
    `Explain attention mechanisms in 3 bullet points.`,
  ],
    setupNotes: `Install via pip (\`pip install vllm\`), start with \`vllm serve <model> --port 8000\`. Set the apiEndpoint to http://your-host:8000/v1/chat/completions in the Providers tab. OpenAI-compatible — no key needed (or set a shared token).`,
    pricingTier: `Free (open-source Apache 2.0). You pay for GPU hardware.`,
    docsUrl: `https://docs.vllm.ai`,
    availableModels: [
    `llama3.1-8b`,
    `llama3.1-70b`,
    `mistral-7b`,
    `qwen2.5-7b`,
    `deepseek-r1`,
    `codeqwen-7b`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `fullstack_dev`,
    `testing`,
  ],
    advantages: [
    `Highest throughput for OSS LLM serving`,
    `PagedAttention memory efficiency`,
    `OpenAI-compatible`,
    `Multi-GPU tensor parallelism`,
  ],
    businessAdvantages: [
    `10x lower cost per token vs. frontier APIs`,
    `Full data privacy`,
    `No vendor lock-in`,
    `Scales with your GPU fleet`,
  ],
    apiIntegrationDetails: `POST http://your-host:8000/v1/chat/completions (OpenAI-compatible). Start with \`vllm serve <model>\`. Optional API key via --api-key flag.`,
  },
  {
    name: `autogen`,
    displayName: `Microsoft AutoGen`,
    tagline: `Multi-agent conversation framework from Microsoft Research.`,
    icon: `Users`,
    color: `#0078d4`,
    category: "orchestration",
    kind: "framework",
    popularity: "high",
    bestFor: [
    `Multi-agent conversation workflows`,
    `Code generation + execution agents`,
    `Group chat with role-based agents`,
    `Research-grade agentic patterns`,
  ],
    capabilities: [
    `Define conversational agents with roles`,
    `Group chat with multiple agents`,
    `Code execution via Docker`,
    `Agent termination conditions + human-in-loop`,
  ],
    whenToUse: [
    `You want agents that talk to each other`,
    `You need code generation + execution`,
    `You're researching agentic patterns`,
  ],
    limitations: [
    `You must run the AutoGen runtime`,
    `Complex to debug (multi-agent traces)`,
    `Higher token usage (agents converse)`,
  ],
    samplePrompts: [
    `Have a Planner agent decompose this task, then a Coder agent implement it, then a Reviewer agent critique it.`,
    `Generate a Python script, execute it in Docker, and fix any errors.`,
    `Two agents debate: should we use Postgres or Mongo for this use case?`,
  ],
    setupNotes: `Install via pip (\`pip install pyautogen\`), define your agents in Python, expose as an OpenAI-compatible endpoint (via a FastAPI wrapper), set the apiEndpoint in the Providers tab.`,
    pricingTier: `Free (open-source MIT). AutoGen Studio (UI) free for local use.`,
    docsUrl: `https://microsoft.github.io/autogen`,
    availableModels: [
    `(uses any LLM you configure as the agent's backbone)`,
  ],
    availableAgents: [
    `general`,
    `fullstack_dev`,
    `research`,
  ],
    advantages: [
    `Microsoft Research-backed`,
    `Multi-agent conversation patterns`,
    `Code execution via Docker`,
    `Human-in-loop support`,
  ],
    businessAdvantages: [
    `Handles complex multi-step tasks`,
    `Auditable agent conversations`,
    `Open-source = no vendor lock-in`,
    `Strong for code generation + verification`,
  ],
    apiIntegrationDetails: `Python framework — no HTTP API. Wrap your agent group in FastAPI to expose an OpenAI-compatible endpoint. Marq treats the resulting URL as a custom provider.`,
  },
  {
    name: `openclaw`,
    displayName: `OpenClaw`,
    tagline: `Open-source agentic framework — community-driven alternative to proprietary agent platforms.`,
    icon: `Wrench`,
    color: `#8b5cf6`,
    category: "orchestration",
    kind: "framework",
    popularity: "low",
    bestFor: [
    `Self-hosted agent orchestration`,
    `Community-driven agent patterns`,
    `Customizable agent loops`,
    `Open-source alternative to commercial agent platforms`,
  ],
    capabilities: [
    `Define custom agent loops`,
    `Tool calling + memory`,
    `Self-hosted (no vendor dependency)`,
    `Plugin architecture for custom tools`,
  ],
    whenToUse: [
    `You want full control over the agent runtime`,
    `You're building custom agentic workflows`,
    `You prefer community-driven OSS over commercial platforms`,
  ],
    limitations: [
    `Smaller community than AutoGen/CrewAI`,
    `Less documentation`,
    `You run the infrastructure`,
  ],
    samplePrompts: [
    `Run a research loop: search the web, summarize findings, return a 1-page brief.`,
    `Decompose this task: write a function, test it, refactor it.`,
    `Use the calculator tool to compute compound interest.`,
  ],
    setupNotes: `Clone the OpenClaw repo, configure your agents + tools, start the server, set the apiEndpoint in the Providers tab. OpenAI-compatible.`,
    pricingTier: `Free (open-source).`,
    docsUrl: `https://github.com/openclaw/openclaw`,
    availableModels: [
    `(uses any LLM you configure)`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `fullstack_dev`,
  ],
    advantages: [
    `Fully open-source`,
    `Customizable agent loops`,
    `Self-hosted = full control`,
    `Plugin architecture`,
  ],
    businessAdvantages: [
    `No vendor lock-in`,
    `Full data privacy`,
    `Customizable for niche use cases`,
    `Community-driven`,
  ],
    apiIntegrationDetails: `Self-host the OpenClaw server, then POST to its OpenAI-compatible endpoint. Configure agents + tools via YAML/Python.`,
  },
  {
    name: `qwen`,
    displayName: `Qwen (Alibaba Cloud)`,
    tagline: `Alibaba's flagship LLM family — strong bilingual, code, and math.`,
    icon: `Sparkles`,
    color: `#615ced`,
    category: "frontier",
    kind: "model",
    popularity: "high",
    bestFor: [
    `Bilingual English/Chinese tasks`,
    `Code generation (Qwen-Coder)`,
    `Math reasoning (Qwen-Math)`,
    `Long context (Qwen-Long, 128K)`,
  ],
    capabilities: [
    `Chat with Qwen2.5-72B, Qwen2.5-Coder, Qwen2.5-Math`,
    `Use via Alibaba DashScope API or self-host`,
    `Strong bilingual fluency`,
    `Open weights available (Qwen2.5 on HF)`,
  ],
    whenToUse: [
    `Your workload is bilingual EN/CN`,
    `You need strong code generation (Qwen-Coder rivals GPT-4o on benchmarks)`,
    `You want open-weight optionality`,
  ],
    limitations: [
    `DashScope API requires Alibaba Cloud account`,
    `Self-hosted Qwen needs significant GPU`,
    `Less ecosystem support than OpenAI/Claude`,
  ],
    samplePrompts: [
    `Translate this English contract clause into natural Chinese.`,
    `Write a Python function to compute the Fibonacci sequence iteratively.`,
    `Solve: if 3x + 2 = 14, what is x? Show your steps.`,
  ],
    setupNotes: `Via Alibaba Cloud DashScope: sign up at aliyun.com, get a DashScope API key, set apiEndpoint to https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions (OpenAI-compatible). Or self-host the open weights via vLLM/Ollama.`,
    pricingTier: `DashScope: pay-as-you-go. Open weights: free (hardware cost only).`,
    docsUrl: `https://help.aliyun.com/zh/dashscope/developer-api`,
    availableModels: [
    `qwen2.5-72b-instruct`,
    `qwen2.5-coder-32b`,
    `qwen2.5-math-72b`,
    `qwen2.5-7b-instruct`,
    `qwen-long`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `fullstack_dev`,
  ],
    advantages: [
    `Best-in-class bilingual (EN/CN)`,
    `Open weights available`,
    `Strong code + math variants`,
    `Long context (128K)`,
  ],
    businessAdvantages: [
    `Lower cost than OpenAI/Claude`,
    `Strong for APAC markets`,
    `Open-weight optionality reduces vendor lock-in`,
    `Code variant rivals frontier models`,
  ],
    apiIntegrationDetails: `POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions with Authorization: Bearer <key>. OpenAI-compatible. Or self-host via vLLM: \`vllm serve Qwen/Qwen2.5-7B-Instruct\`.`,
  },
  {
    name: `mistral`,
    displayName: `Mistral AI`,
    tagline: `European frontier LLM — efficient, open-weight, GDPR-friendly.`,
    icon: `Wind`,
    color: `#ff7000`,
    category: "frontier",
    kind: "model",
    popularity: "very-high",
    bestFor: [
    `GDPR-compliant EU hosting`,
    `Efficient inference (Mistral 7B fits on a laptop)`,
    `Open-weight models (Mistral 7B, Mixtral)`,
    `Function calling + JSON mode`,
  ],
    capabilities: [
    `Chat with Mistral Large, Mistral Medium, Mistral Small, Mistral Nemo`,
    `Open weights for Mistral 7B / Mixtral 8x7B / 8x22B`,
    `Function calling + structured output`,
    `EU-hosted (La Plateforme)`,
  ],
    whenToUse: [
    `You need EU data residency (GDPR)`,
    `You want open-weight optionality`,
    `You need efficient inference (Mistral 7B is tiny + fast)`,
  ],
    limitations: [
    `Smaller context than Gemini (32K-128K)`,
    `Less ecosystem support than OpenAI`,
    `Open weights require self-hosting for max benefit`,
  ],
    samplePrompts: [
    `Refactor this Python function for readability.`,
    `Summarize this GDPR policy in 5 bullet points.`,
    `Generate a JSON object with keys: name, email, role.`,
  ],
    setupNotes: `Sign up at console.mistral.ai, get an API key, paste it into the Providers tab. Default endpoint (api.mistral.ai/v1/chat/completions) is OpenAI-compatible.`,
    pricingTier: `Free tier (La Plateforme). Paid from $0.25 / 1M (Tiny) to $4 / 1M (Large).`,
    docsUrl: `https://docs.mistral.ai`,
    availableModels: [
    `mistral-large-latest`,
    `mistral-medium-latest`,
    `mistral-small-latest`,
    `open-mistral-nemo`,
    `open-mixtral-8x22b`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `fullstack_dev`,
  ],
    advantages: [
    `EU-hosted (GDPR-friendly)`,
    `Open-weight variants available`,
    `Efficient inference (7B is tiny)`,
    `Function calling + JSON mode`,
  ],
    businessAdvantages: [
    `GDPR compliance out of the box`,
    `Lower cost than OpenAI/Claude`,
    `Open-weight optionality = no lock-in`,
    `Strong EU talent pool`,
  ],
    apiIntegrationDetails: `POST https://api.mistral.ai/v1/chat/completions with Authorization: Bearer <key>. OpenAI-compatible — drop-in replacement.`,
  },
  {
    name: `deepseek`,
    displayName: `DeepSeek`,
    tagline: `Cost-efficient frontier LLM — strong reasoning at 1/10th the price.`,
    icon: `Brain`,
    color: `#4d6bfe`,
    category: "frontier",
    kind: "model",
    popularity: "very-high",
    bestFor: [
    `Reasoning tasks (DeepSeek-R1 rivals o1)`,
    `Cost-efficient production inference`,
    `Code generation (DeepSeek-Coder)`,
    `Math + science`,
  ],
    capabilities: [
    `Chat with DeepSeek-V3, DeepSeek-R1 (reasoning), DeepSeek-Coder`,
    `Open weights for V3 + R1`,
    `Industry-leading cost-per-token`,
    `Long context (128K)`,
  ],
    whenToUse: [
    `You want o1-class reasoning at 1/10th the price`,
    `Your workload is cost-sensitive`,
    `You need strong code generation`,
    `You want open-weight optionality`,
  ],
    limitations: [
    `Newer provider — smaller ecosystem than OpenAI/Anthropic`,
    `Self-hosted R1 needs significant GPU (671B params)`,
    `Less polished tooling`,
  ],
    samplePrompts: [
    `Prove that the sum of two odd numbers is even. Show your reasoning.`,
    `Refactor this TypeScript function to be more idiomatic.`,
    `Solve: a train travels 60 mph for 2 hours, then 80 mph for 1 hour. What's the average speed?`,
  ],
    setupNotes: `Sign up at platform.deepseek.com, get an API key, paste it into the Providers tab. Default endpoint (api.deepseek.com/v1/chat/completions) is OpenAI-compatible.`,
    pricingTier: `Pay-as-you-go: V3 from $0.27 / 1M input, $1.10 / 1M output. R1 from $0.55 / 1M input. ~10x cheaper than OpenAI.`,
    docsUrl: `https://api-docs.deepseek.com`,
    availableModels: [
    `deepseek-chat`,
    `deepseek-reasoner`,
    `deepseek-coder`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `fullstack_dev`,
    `business_analyst`,
  ],
    advantages: [
    `Frontier-class reasoning at 1/10th OpenAI's price`,
    `Open weights (V3 + R1)`,
    `Long context (128K)`,
    `Strong code + math`,
  ],
    businessAdvantages: [
    `Massive cost savings on production inference`,
    `Open-weight optionality = no lock-in`,
    `Rivals o1 on reasoning benchmarks`,
    `Strong for high-volume workloads`,
  ],
    apiIntegrationDetails: `POST https://api.deepseek.com/v1/chat/completions with Authorization: Bearer <key>. OpenAI-compatible — drop-in replacement.`,
  },
  {
    name: `llama`,
    displayName: `Llama (Meta AI)`,
    tagline: `Meta's open-weight LLM family — the foundation of the open-source LLM ecosystem.`,
    icon: `Sparkles`,
    color: `#0668e1`,
    category: "open-source",
    kind: "model",
    popularity: "very-high",
    bestFor: [
    `Self-hosted frontier-class LLM`,
    `Custom fine-tuning`,
    `Open-weight auditability`,
    `Multi-modal (Llama 3.2 Vision)`,
  ],
    capabilities: [
    `Open weights for Llama 3.1 / 3.2 / 3.3`,
    `Sizes from 1B to 405B params`,
    `Multimodal (Llama 3.2 11B/90B Vision)`,
    `Run via Ollama, vLLM, TGI, or HF Transformers`,
  ],
    whenToUse: [
    `You want to self-host a frontier-class LLM`,
    `You need open weights for auditing/compliance`,
    `You're fine-tuning for a specific domain`,
  ],
    limitations: [
    `Largest models (405B) need serious GPU (8x H100)`,
    `License restrictions for >700M MAU products`,
    `Not a hosted API — Meta doesn't serve Llama directly`,
  ],
    samplePrompts: [
    `Explain the difference between supervised and unsupervised learning.`,
    `Write a SQL query to find the second-highest salary in each department.`,
    `What are the trade-offs of microservices vs. monolith?`,
  ],
    setupNotes: `Download weights from llama.com (accept the license), then serve via Ollama (\`ollama pull llama3.1\`), vLLM (\`vllm serve meta-llama/Llama-3.1-8B-Instruct\`), or TGI. Set the apiEndpoint in the Providers tab. Or use hosted Llama via Together AI / Groq / Fireworks.`,
    pricingTier: `Free (open weights, Llama 3.x Community License). Hosted via Together AI from $0.18 / 1M.`,
    docsUrl: `https://llama.meta.com`,
    availableModels: [
    `llama-3.1-8b`,
    `llama-3.1-70b`,
    `llama-3.1-405b`,
    `llama-3.2-1b`,
    `llama-3.2-3b`,
    `llama-3.2-11b-vision`,
    `llama-3.3-70b`,
  ],
    availableAgents: [
    `general`,
    `research`,
    `fullstack_dev`,
    `testing`,
    `business_analyst`,
  ],
    advantages: [
    `Frontier-class open weights`,
    `Spectrum of sizes (1B-405B)`,
    `Multimodal (Llama 3.2 Vision)`,
    `Massive ecosystem (Ollama, vLLM, TGI)`,
  ],
    businessAdvantages: [
    `Self-host = zero per-token cost`,
    `Open weights = auditability (regulatory compliance)`,
    `Fine-tuning for domain adaptation`,
    `No vendor lock-in`,
  ],
    apiIntegrationDetails: `Not a hosted API. Serve via Ollama (localhost:11434), vLLM (localhost:8000), or TGI (localhost:8080) — all OpenAI-compatible. Or use hosted Llama via Together AI / Groq / Fireworks (set apiEndpoint accordingly).`,
  },
];

/** Quick lookup by provider name. */
export const PROVIDER_BENEFITS_MAP: Record<string, ProviderBenefit> = Object.fromEntries(
  PROVIDER_BENEFITS.map((p) => [p.name, p]),
);

/** Get benefits for a provider, falling back to null. */
export function getProviderBenefits(name: string): ProviderBenefit | null {
  return PROVIDER_BENEFITS_MAP[name] ?? null;
}

/** Category metadata for the Provider Guide UI filter. */
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

/** Kind metadata for the AI Directory UI filter. */
export const KIND_META: Record<ProviderBenefit["kind"], { label: string; description: string }> = {
  platform: {
    label: "Platforms",
    description: "Full development platforms — package management, model hosting, MLOps pipelines.",
  },
  package: {
    label: "Packages",
    description: "Installable Python libraries — PyTorch, TensorFlow, scikit-learn, Transformers, etc.",
  },
  framework: {
    label: "Frameworks",
    description: "Agent orchestration + serving runtimes — CrewAI, AutoGen, vLLM, Ollama.",
  },
  model: {
    label: "Models",
    description: "Open-weight model families — Llama, Mistral, DeepSeek, Qwen.",
  },
  service: {
    label: "Services",
    description: "Hosted inference APIs — OpenAI, Gemini, Claude, Grok, Zai, and more.",
  },
};

/** Popularity metadata for the AI Directory sort. */
export const POPULARITY_META: Record<ProviderBenefit["popularity"], { label: string; rank: number }> = {
  "very-high": { label: "Very High", rank: 4 },
  "high": { label: "High", rank: 3 },
  "medium": { label: "Medium", rank: 2 },
  "low": { label: "Low", rank: 1 },
};
