#!/usr/bin/env python3
"""
Append missing inference-API providers from infrabase.ai to
src/lib/provider-benefits.ts.

Idempotent: skips any entry whose `name` key already exists in the file.
"""
from pathlib import Path
import re
import sys

FILE = Path("/home/z/my-project/src/lib/provider-benefits.ts")

# Each entry is a dict matching the ProviderBenefit schema.
# Array fields use Python lists; the helper converts to TS array literals.
ENTRIES = [
    {
        "name": "openrouter",
        "displayName": "OpenRouter",
        "tagline": "Unified API to 300+ LLMs from OpenAI, Anthropic, Meta, Mistral, Google, and open-source — with smart routing, price optimization, and fallbacks.",
        "icon": "Network",
        "color": "#6366f1",
        "category": "frontier",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Single API for every frontier + open-source LLM",
            "Price-vs-latency routing with provider fallbacks",
            "Comparing 10+ models side-by-side without writing 10 integrations",
            "Disaster recovery — if OpenAI is down, auto-failover to Anthropic",
        ],
        "capabilities": [
            "OpenAI-compatible /chat/completions endpoint accepting any model",
            "Per-request routing preferences: price, latency, quality",
            "Automatic provider failover and retries",
            "Token-level usage + cost analytics across all providers",
            "Streaming, tool calls, vision, structured outputs — all pass-through",
        ],
        "whenToUse": [
            "You want one integration to access every LLM on the market",
            "You need automatic failover across vendors",
            "You want to A/B test models without code changes",
        ],
        "limitations": [
            "Adds a small latency overhead vs direct provider calls",
            "5% markup on top of upstream provider pricing",
            "Some niche providers occasionally rate-limit OpenRouter IPs",
        ],
        "samplePrompts": [
            "Compare GPT-4o vs Claude 3.5 vs Gemini 1.5 on this SQL question — return only the best answer.",
            "Route to the cheapest model that can summarize this 500-token email.",
            "Auto-failover from OpenAI to Anthropic if rate-limited, then to Mistral.",
        ],
        "setupNotes": "Sign up at openrouter.ai, create a key under Keys, add credit. Set apiEndpoint to https://openrouter.ai/api/v1/chat/completions and auth header 'Authorization: Bearer <or-key>'. Models are referenced like 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-70b-instruct'.",
        "pricingTier": "Per-token, with 5% markup on upstream. Free tier: 50 requests/day to free models.",
        "docsUrl": "https://openrouter.ai/docs",
        "availableModels": [
            "openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-flash-1.5",
            "meta-llama/llama-3.1-405b-instruct", "mistralai/mistral-large",
        ],
        "availableAgents": ["chat-companion", "compare-agent", "rag-researcher"],
        "advantages": [
            "300+ models behind one API — biggest aggregator in market",
            "Transparent price + latency routing",
            "Auto-failover reduces provider-outage risk to ~0",
            "Usage analytics across all providers in one dashboard",
        ],
        "businessAdvantages": [
            "Single vendor relationship for procurement",
            "Hedge against any single LLM provider's pricing/outrage",
            "Faster model evaluation cycles — switch without re-integration",
        ],
        "apiIntegrationDetails": "POST https://openrouter.ai/api/v1/chat/completions { model, messages } with 'Authorization: Bearer <key>'. OpenAI-compatible — drop-in replacement.",
        "modalities": ["chat", "code", "vision", "tools", "reasoning"],
    },
    {
        "name": "together-ai",
        "displayName": "Together AI",
        "tagline": "Fast, cheap hosted inference for 200+ open-source LLMs plus dedicated fine-tuning endpoints.",
        "icon": "Server",
        "color": "#0ea5e9",
        "category": "open-source",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Running Llama, Qwen, DeepSeek at 5-10x cheaper than frontier APIs",
            "Fine-tuning Llama / Mistral on your data without GPU management",
            "Low-latency dedicated endpoints for production traffic",
            "Image generation via Stable Diffusion XL + Flux",
        ],
        "capabilities": [
            "200+ open-source models at serverless per-token pricing",
            "Dedicated endpoints with throughput guarantees",
            "LoRA + full fine-tuning via Together's pipeline",
            "Embeddings, reranking, image generation (SDXL, Flux, SD3)",
            "OpenAI-compatible /chat/completions API",
        ],
        "whenToUse": [
            "Open-source Llama/Qwen is good enough — save 80%+ vs OpenAI",
            "You need to fine-tune but can't manage GPU infra",
        ],
        "limitations": [
            "Cold-start latency on rarely-used models",
            "Frontier models (GPT-4, Claude) not available — only open-source",
        ],
        "samplePrompts": [
            "Summarize this 10k-word contract into 5 bullet points using Llama-3.1-70b.",
            "Fine-tune Llama-3-8B on our 5k customer-support transcripts.",
            "Generate a photorealistic product shot of a ceramic mug with SDXL.",
        ],
        "setupNotes": "Sign up at api.together.xyz, create a key. Set apiEndpoint to https://api.together.xyz/v1/chat/completions. Models like 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'.",
        "pricingTier": "From $0.10 / 1M input tokens (small models) up to ~$5 / 1M (Llama-405B).",
        "docsUrl": "https://docs.together.ai",
        "availableModels": [
            "meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo",
            "deepseek-ai/DeepSeek-V3", "stabilityai/stable-diffusion-xl",
        ],
        "availableAgents": ["chat-companion", "fine-tuner", "image-gen"],
        "advantages": [
            "Cheapest production-grade open-model hosting",
            "Fine-tuning pipeline without GPU ops",
            "Dedicated endpoints for predictable latency",
            "OpenAI-compatible API — drop-in",
        ],
        "businessAdvantages": [
            "Cut LLM costs 80%+ by moving to open-source models",
            "Own your fine-tuned model weights — no vendor lock-in",
        ],
        "apiIntegrationDetails": "POST https://api.together.xyz/v1/chat/completions { model, messages } with 'Authorization: Bearer <key>'. OpenAI-compatible.",
        "modalities": ["chat", "code", "image", "embeddings"],
    },
    {
        "name": "fireworks-ai",
        "displayName": "Fireworks AI",
        "tagline": "High-throughput open-model inference with sub-100ms TTFT — fastest way to serve Llama, Mixtral, and DeepSeek.",
        "icon": "Flame",
        "color": "#ef4444",
        "category": "open-source",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Latency-critical chat apps needing <100ms time-to-first-token",
            "Batch processing millions of prompts on Llama/Mixtral",
            "Fine-tuned model hosting with serverless scale",
            "Function-calling workflows on open models",
        ],
        "capabilities": [
            "Serverless open-model inference (Llama, Mixtral, DeepSeek, Qwen)",
            "On-demand fine-tuning + deployment",
            "Speculative decoding for 2-3x throughput",
            "OpenAI-compatible API + tool calling",
            "Image generation via Stable Diffusion, Flux",
        ],
        "whenToUse": [
            "Together is too slow / expensive for your traffic shape",
            "You need speculative decoding for max throughput",
        ],
        "limitations": [
            "Smaller model catalog than Together / OpenRouter",
            "Pricing can exceed Together on rare models",
        ],
        "samplePrompts": [
            "Serve our fine-tuned Llama-3-70B at 99th-percentile <500ms TTFT.",
            "Batch-classify 100k support tickets with Mixtral-8x22B in 10 minutes.",
            "Add function-calling to an open-source model on Fireworks.",
        ],
        "setupNotes": "Sign up at fireworks.ai, create a key. Endpoint: https://api.fireworks.ai/inference/v1/chat/completions. Models like 'accounts/fireworks/models/llama-v3p3-70b-instruct'.",
        "pricingTier": "From $0.10 / 1M tokens (small) up to ~$3 / 1M (Llama-405B).",
        "docsUrl": "https://docs.fireworks.ai",
        "availableModels": [
            "accounts/fireworks/models/llama-v3p3-70b-instruct",
            "accounts/fireworks/models/mixtral-8x22b-instruct",
            "accounts/fireworks/models/deepseek-v3",
        ],
        "availableAgents": ["chat-companion", "classifier", "code-reviewer"],
        "advantages": [
            "Industry-leading TTFT for open models",
            "Speculative decoding = highest throughput",
            "Fine-tuned model deployment in minutes",
            "OpenAI-compatible API",
        ],
        "businessAdvantages": [
            "Latency edge critical for chat / voice apps",
            "Throughput edge reduces per-call cost at scale",
        ],
        "apiIntegrationDetails": "POST https://api.fireworks.ai/inference/v1/chat/completions with 'Authorization: Bearer <key>'. OpenAI-compatible.",
        "modalities": ["chat", "code", "image", "tools", "embeddings"],
    },
    {
        "name": "groq",
        "displayName": "Groq",
        "tagline": "LPU-powered inference — 500+ tokens/sec on Llama, world's fastest LLM serving.",
        "icon": "Zap",
        "color": "#f59e0b",
        "category": "open-source",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Real-time chat with sub-second full responses",
            "Voice agents needing instant LLM responses",
            "High-volume batch transcription/classification",
            "Live streaming UX where perceived speed = product quality",
        ],
        "capabilities": [
            "LPU inference: 500-800 tokens/sec on Llama-3-70B",
            "OpenAI-compatible API",
            "Whisper-large-v3 for STT at 150x realtime",
            "Tool calling, JSON mode, streaming",
        ],
        "whenToUse": [
            "Speed is the product — voice agents, live chat, copilots",
            "Whisper STT at scale (call transcription)",
        ],
        "limitations": [
            "Limited model selection (Llama, Mixtral, Whisper, Gemma)",
            "Throughput quota caps on free tier",
            "No fine-tuning yet — only base models",
        ],
        "samplePrompts": [
            "Stream a Llama-3-70B response to a live chat in <500ms TTFT.",
            "Transcribe 1000 hours of calls with Whisper-large-v3 in minutes.",
            "Run a voice agent loop with 200ms LLM turnaround.",
        ],
        "setupNotes": "Sign up at console.groq.com, create a key. Endpoint: https://api.groq.com/openai/v1/chat/completions. Models like 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'whisper-large-v3'.",
        "pricingTier": "Free dev tier; paid tiers from $0.05 / 1M tokens (small) to ~$0.60 / 1M (Llama-70B).",
        "docsUrl": "https://console.groq.com/docs",
        "availableModels": [
            "llama-3.3-70b-versatile", "llama-3.1-8b-instant",
            "mixtral-8x7b-32768", "whisper-large-v3",
        ],
        "availableAgents": ["voice-agent", "chat-companion", "transcriber"],
        "advantages": [
            "Far and away the fastest LLM inference available",
            "Whisper STT at 150x realtime — class-leading",
            "Free dev tier with generous quotas",
            "OpenAI-compatible API",
        ],
        "businessAdvantages": [
            "Perceived latency = product competitiveness for chat/voice",
            "Whisper STT enables call-center analytics at fraction of cost",
        ],
        "apiIntegrationDetails": "POST https://api.groq.com/openai/v1/chat/completions with 'Authorization: Bearer <key>'. OpenAI-compatible.",
        "modalities": ["chat", "voice", "code", "tools"],
    },
    {
        "name": "cohere",
        "displayName": "Cohere",
        "tagline": "Enterprise NLP platform — Command R+ models, embeddings, rerankers, and grounded retrieval built for production RAG.",
        "icon": "Network",
        "color": "#39594d",
        "category": "frontier",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Production RAG pipelines needing best-in-class reranking",
            "Enterprise multilingual NLP (100+ languages)",
            "Compliance-first deployments with data residency options",
            "Document-grounded chat with citation snippets",
        ],
        "capabilities": [
            "Command R+ chat with built-in citation generation",
            "Embed v3 multilingual embeddings",
            "Rerank 3 English / Multilingual for RAG",
            "Tool calling + structured outputs",
            "Connectors for Google Drive, Notion, Slack (Cohere Compass)",
        ],
        "whenToUse": [
            "You need a reranker — Cohere Rerank is the gold standard",
            "Enterprise procurement requires SOC2/HIPAA + data residency",
        ],
        "limitations": [
            "Command R+ lags GPT-4o / Claude 3.5 on pure reasoning",
            "Pricing premium for embeddings vs open-source alternatives",
        ],
        "samplePrompts": [
            "Build a RAG pipeline over 10k SEC filings — Cohere Rerank should filter top-100 to top-5.",
            "Multilingual customer support agent across 20 markets using Command R+.",
            "Citation-grounded legal Q&A over a corpus of contracts.",
        ],
        "setupNotes": "Sign up at cohere.com, create a key under Dashboard. Endpoint: https://api.cohere.com/v2/chat (chat) or /v1/embed / /v1/rerank. Models: 'command-r-plus-08-2024', 'embed-english-v3.0', 'rerank-english-v3.0'.",
        "pricingTier": "Command R+: $2.50 / 1M input, $10 / 1M output. Embeddings: $0.10 / 1M tokens. Rerank: $2 / 1k searches.",
        "docsUrl": "https://docs.cohere.com",
        "availableModels": [
            "command-r-plus-08-2024", "command-r-08-2024",
            "embed-english-v3.0", "embed-multilingual-v3.0",
            "rerank-english-v3.0", "rerank-multilingual-v3.0",
        ],
        "availableAgents": ["rag-researcher", "enterprise-search", "multilingual-cs"],
        "advantages": [
            "Best reranker in market — Cohere Rerank is industry standard",
            "Citations grounded in retrieved docs (no hallucinated quotes)",
            "Strong multilingual coverage (100+ languages)",
            "Compliance-ready: SOC2, HIPAA, GDPR, data residency",
        ],
        "businessAdvantages": [
            "Rerank improves RAG precision by 20-40% over embeddings alone",
            "Enterprise procurement-friendly compliance posture",
        ],
        "apiIntegrationDetails": "POST https://api.cohere.com/v2/chat { model, messages } with 'Authorization: Bearer <key>'. Slightly different schema than OpenAI — see docs.",
        "modalities": ["chat", "embeddings", "tools", "reasoning"],
    },
    {
        "name": "replicate",
        "displayName": "Replicate",
        "tagline": "Run any open-source ML model with one API — image, video, audio, text, segmentation, upscaling.",
        "icon": "Boxes",
        "color": "#f97316",
        "category": "specialized",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Image / video / audio generation via a single API",
            "Trying niche research models (Flux, Mochi, XTTS, Whisper)",
            "Serverless model hosting without GPU ops",
            "Quick prototypes with state-of-the-art generative models",
        ],
        "capabilities": [
            "10,000+ models across image, video, audio, text, multimodal",
            "One unified API: 'predictions' endpoint with model+input",
            "Host your own model on Replicate via Cog packaging",
            "Real-time / streaming predictions for compatible models",
            "Webhooks for async predictions",
        ],
        "whenToUse": [
            "You need image/video/audio generation alongside text",
            "You want to try the latest research model in 5 minutes",
        ],
        "limitations": [
            "Per-second GPU pricing — expensive for high-volume chat",
            "Cold starts on rarely-used models (5-30s)",
        ],
        "samplePrompts": [
            "Generate a 5-second video of a drone flyover of the Grand Canyon with Mochi-1.",
            "Clone a voice from a 10-second sample using XTTS-v2.",
            "Upscale a 480p product photo to 4K with Real-ESRGAN.",
        ],
        "setupNotes": "Sign up at replicate.com, create a key under API tokens. Endpoint: https://api.replicate.com/v1/predictions. Reference models as 'owner/model:version' — e.g. 'black-forest-labs/flux-schnell', 'mistralai/mixtral-8x7b-instruct-v0.1'.",
        "pricingTier": "Per-second GPU time: ~$0.000225/sec on default CPU, ~$0.0014/sec on A100. Free trial credits.",
        "docsUrl": "https://replicate.com/docs",
        "availableModels": [
            "black-forest-labs/flux-schnell", "black-forest-labs/flux-dev",
            "genmo/mochi-1", "lucataco/xtts-v2",
            "cjwbw/real-esrgan", "meta/llama-3.3-70b-instruct",
        ],
        "availableAgents": ["image-gen", "video-gen", "voice-cloner", "upscale"],
        "advantages": [
            "Largest catalog of runnable open-source models anywhere",
            "Unified API across modalities — no per-provider SDKs",
            "Host your own model with Cog — no infra",
            "Real-time streaming for supported models",
        ],
        "businessAdvantages": [
            "Single vendor for all generative AI needs",
            "Faster prototyping — try 5 models in 30 minutes",
        ],
        "apiIntegrationDetails": "POST https://api.replicate.com/v1/predictions { version, input } with 'Authorization: Token <key>'. Poll prediction.get or use webhook.",
        "modalities": ["image", "video", "voice", "music", "vision", "chat", "code"],
    },
    {
        "name": "cerebras",
        "displayName": "Cerebras",
        "tagline": "Wafer-scale inference engine — 1500+ tokens/sec on Llama-3.1-70B, fastest commercially available.",
        "icon": "Cpu",
        "color": "#8b5cf6",
        "category": "open-source",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Agentic loops needing 1000+ tokens/sec",
            "Long-context inference (Cerebras handles 128k+ efficiently)",
            "Real-time code generation / completion",
            "Batch processing massive document corpora",
        ],
        "capabilities": [
            "Wafer-scale Engine (WSE) — entire model on one chip",
            "1500+ tokens/sec on Llama-3.1-70B (vs 800 on Groq)",
            "OpenAI-compatible API",
            "Supports Llama, Qwen, Mistral, DeepSeek families",
        ],
        "whenToUse": [
            "Groq isn't fast enough — you need 1000+ tok/sec",
            "Long-context (128k+) inference at speed",
        ],
        "limitations": [
            "Only supports a curated set of open models",
            "No fine-tuning yet — only base models",
            "Newer service — smaller community than Groq",
        ],
        "samplePrompts": [
            "Stream a 70B Llama response at 1500 tokens/sec for a live coding copilot.",
            "Process 100k-token contracts end-to-end in under 90 seconds.",
            "Run a 10-step agent loop in <5 seconds total.",
        ],
        "setupNotes": "Sign up at cerebras.ai, create a key. Endpoint: https://api.cerebras.ai/v1/chat/completions. Models: 'llama3.1-70b', 'llama-3.3-70b', 'qwen-2.5-coder-32b'.",
        "pricingTier": "$0.85 / 1M tokens (Llama-70B) — premium over Groq but with 2x speed.",
        "docsUrl": "https://inference-docs.cerebras.ai",
        "availableModels": [
            "llama3.1-8b", "llama3.1-70b", "llama-3.3-70b",
            "qwen-2.5-coder-32b", "deepseek-r1-distill-llama-70b",
        ],
        "availableAgents": ["code-copilot", "agent-runner", "long-context-analyzer"],
        "advantages": [
            "Fastest commercial LLM inference (2x Groq on Llama-70B)",
            "Entire model on one wafer — no inter-chip bottleneck",
            "Handles long-context (128k+) efficiently",
            "OpenAI-compatible API",
        ],
        "businessAdvantages": [
            "Speed unlocks agentic workflows that don't work on slower inference",
            "Long-context throughput enables whole-corpus analysis",
        ],
        "apiIntegrationDetails": "POST https://api.cerebras.ai/v1/chat/completions with 'Authorization: Bearer <key>'. OpenAI-compatible.",
        "modalities": ["chat", "code", "reasoning"],
    },
    {
        "name": "sambanova",
        "displayName": "SambaNova",
        "tagline": "RDU-accelerated inference — fastest DeepSeek-R1 and Llama-3.1-405B serving on market.",
        "icon": "Cpu",
        "color": "#dc2626",
        "category": "open-source",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Serving DeepSeek-R1 reasoning at 200+ tokens/sec",
            "Running Llama-405B without GPU farm CapEx",
            "Government / regulated workloads needing on-prem option",
            "High-throughput batch reasoning",
        ],
        "capabilities": [
            "RDU (Reconfigurable Dataflow Unit) acceleration",
            "DeepSeek-R1 at 200+ tokens/sec (10x A100)",
            "Llama-3.1-405B in production",
            "OpenAI-compatible API",
            "On-prem appliance option for air-gapped deployments",
        ],
        "whenToUse": [
            "DeepSeek-R1 reasoning at production scale",
            "Llama-405B without managing 8x H100 servers",
        ],
        "limitations": [
            "Premium pricing vs Together / Fireworks",
            "Smaller model catalog than competitors",
        ],
        "samplePrompts": [
            "Serve DeepSeek-R1 at 200 tokens/sec for live reasoning over financial filings.",
            "Run Llama-3.1-405B for legal document analysis without 8x H100 CapEx.",
            "Air-gapped on-prem deployment for classified workloads.",
        ],
        "setupNotes": "Sign up at sambanova.ai, create a key under API. Endpoint: https://api.sambanova.ai/v1/chat/completions. Models: 'Meta-Llama-3.1-405B-Instruct', 'DeepSeek-R1', 'Llama-3.3-70B-Instruct'.",
        "pricingTier": "$0.70 / 1M input, $1.40 / 1M output for Llama-70B. Reasoning models higher.",
        "docsUrl": "https://docs.sambanova.ai",
        "availableModels": [
            "Meta-Llama-3.1-405B-Instruct", "Meta-Llama-3.3-70B-Instruct",
            "DeepSeek-R1", "DeepSeek-V3",
        ],
        "availableAgents": ["reasoning-agent", "long-doc-analyzer", "classifier"],
        "advantages": [
            "Fastest DeepSeek-R1 inference in market",
            "Llama-405B without GPU farm",
            "On-prem appliance for regulated workloads",
            "OpenAI-compatible API",
        ],
        "businessAdvantages": [
            "Reasoning model speed = better UX for chain-of-thought apps",
            "On-prem option unlocks government / classified contracts",
        ],
        "apiIntegrationDetails": "POST https://api.sambanova.ai/v1/chat/completions with 'Authorization: Bearer <key>'. OpenAI-compatible.",
        "modalities": ["chat", "code", "reasoning"],
    },
    {
        "name": "deepinfra",
        "displayName": "DeepInfra",
        "tagline": "Cheapest serverless inference for Llama, Mixtral, DeepSeek — pay by token, no minimums.",
        "icon": "Server",
        "color": "#0f766e",
        "category": "open-source",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Lowest-cost Llama / DeepSeek inference",
            "Bulk classification / summarization jobs",
            "Side projects and prototypes with tight budgets",
            "Backup provider in a failover chain",
        ],
        "capabilities": [
            "Serverless per-token pricing on open models",
            "Llama, Mixtral, DeepSeek, Qwen, Gemma",
            "OpenAI-compatible API",
            "Streaming + JSON mode + tool calls",
        ],
        "whenToUse": [
            "Together / Fireworks still too expensive for your volume",
            "Need a third fallback provider in your chain",
        ],
        "limitations": [
            "Throughput quotas tighter than Together / Fireworks",
            "Less enterprise polish — fewer compliance certs",
        ],
        "samplePrompts": [
            "Classify 1M support tickets by sentiment with Llama-3-8B at $0.05 / 1M tokens.",
            "Run DeepSeek-V3 as a backup in the failover chain.",
            "Summarize 10k HackerNews threads for trend analysis.",
        ],
        "setupNotes": "Sign up at deepinfra.com, create a key under Dashboard. Endpoint: https://api.deepinfra.com/v1/openai/chat/completions. Models like 'meta-llama/Llama-3.3-70B-Instruct', 'deepseek-ai/DeepSeek-V3'.",
        "pricingTier": "Llama-3-8B: $0.05 / 1M tokens. Llama-3-70B: $0.59 / 1M. DeepSeek-V3: $0.27 / 1M.",
        "docsUrl": "https://deepinfra.com/docs",
        "availableModels": [
            "meta-llama/Llama-3.3-70B-Instruct", "meta-llama/Meta-Llama-3.1-8B-Instruct",
            "deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1",
            "Qwen/Qwen2.5-72B-Instruct",
        ],
        "availableAgents": ["classifier", "summarizer", "chat-companion"],
        "advantages": [
            "Cheapest serverless inference for open models",
            "OpenAI-compatible API",
            "Generous free trial credits",
            "JSON mode + tool calls supported",
        ],
        "businessAdvantages": [
            "Lowest unit cost = highest margin on per-token SaaS",
            "Cheap fallback provider for failover chains",
        ],
        "apiIntegrationDetails": "POST https://api.deepinfra.com/v1/openai/chat/completions with 'Authorization: Bearer <key>'. OpenAI-compatible.",
        "modalities": ["chat", "code", "reasoning", "embeddings"],
    },
    {
        "name": "runpod",
        "displayName": "RunPod",
        "tagline": "GPU rental + serverless endpoints — H100s at $2.50/hour, deploy any model with one click.",
        "icon": "Server",
        "color": "#10b981",
        "category": "open-source",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Renting H100s / A100s by the hour for fine-tuning",
            "Serverless deployment of custom models (vLLM, TGI)",
            "Running Stable Diffusion / Flux at scale on demand",
            "Cost-optimized batch inference jobs",
        ],
        "capabilities": [
            "On-demand GPU rental (H100, A100, A6000, RTX 4090)",
            "Serverless GPU endpoints with autoscale",
            "Pre-built templates for vLLM, TGI, A1111, ComfyUI",
            "Persistent storage + cloud buckets",
        ],
        "whenToUse": [
            "You need GPUs for fine-tuning but not 24/7",
            "You want to deploy a custom model serverless",
        ],
        "limitations": [
            "Cold-start on serverless endpoints (10-30s)",
            "GPU availability tight during launch windows",
        ],
        "samplePrompts": [
            "Rent 8x H100s for 4 hours to fine-tune Llama-3-70B with LoRA — total cost ~$80.",
            "Deploy vLLM as a serverless endpoint serving Llama-3-8B with autoscale.",
            "Run a 1000-image batch generation with SDXL on RTX 4090 spot instances.",
        ],
        "setupNotes": "Sign up at runpod.io, add credit. Rent Pods under 'Pods' (GPU rental) or deploy Serverless under 'Serverless'. API key under Settings.",
        "pricingTier": "H100: $2.50-4.50/hour on-demand. A100 80GB: $1.50-2.50/hour. RTX 4090: $0.40-0.80/hour.",
        "docsUrl": "https://docs.runpod.io",
        "availableModels": [
            "(any model you deploy — RunPod is infrastructure, not a model catalog)",
        ],
        "availableAgents": ["custom-model-server", "fine-tuner", "image-gen"],
        "advantages": [
            "Cheapest GPU rental in market — H100 at $2.50/hr",
            "Serverless GPU with autoscale",
            "Pre-built templates for vLLM / TGI / SDXL",
            "Spot pricing for batch jobs",
        ],
        "businessAdvantages": [
            "CapEx → OpEx: no GPU hardware to buy",
            "Fine-tune on H100s for 1/10th the cost of managed services",
        ],
        "apiIntegrationDetails": "GraphQL API at https://api.runpod.io/graphql. For serverless: POST https://api.runpod.ai/v2/<endpoint-id>/run with 'Authorization: Bearer <key>'.",
        "modalities": ["chat", "code", "image", "vision", "embeddings"],
    },
    {
        "name": "novita-ai",
        "displayName": "Novita AI",
        "tagline": "Cost-effective API for 100+ open LLMs plus image generation — popular in APAC.",
        "icon": "Server",
        "color": "#0284c7",
        "category": "open-source",
        "kind": "service",
        "popularity": "medium",
        "bestFor": [
            "APAC-region low-latency inference for open models",
            "Image generation via SDXL / SD3.5 / Flux at low cost",
            "Bulk LoRA fine-tuning for image models",
        ],
        "capabilities": [
            "100+ open LLMs at serverless pricing",
            "Image gen: SDXL, SD3.5, Flux, with 10k+ community LoRAs",
            "LoRA training via web UI",
            "OpenAI-compatible LLM API",
        ],
        "whenToUse": [
            "You need APAC latency for open-model serving",
            "Bulk image generation with community LoRAs",
        ],
        "limitations": [
            "Less enterprise polish than Together / Fireworks",
            "Smaller catalog than OpenRouter",
        ],
        "samplePrompts": [
            "Generate 1000 anime-style product mascots with SDXL + LoRA.",
            "Serve Llama-3-70B to APAC users with <200ms TTFT.",
            "Fine-tune an SDXL LoRA on 50 brand-product photos.",
        ],
        "setupNotes": "Sign up at novita.ai, create a key. Endpoint: https://api.novita.ai/v3/openai/chat/completions (LLM) or /v3/async/txt2img (image).",
        "pricingTier": "Llama-3-8B: $0.05 / 1M tokens. SDXL image: $0.001-0.005 per image.",
        "docsUrl": "https://docs.novita.ai",
        "availableModels": [
            "meta-llama/llama-3.1-8b-instruct", "meta-llama/llama-3.3-70b-instruct",
            "stabilityai/sdxl", "black-forest-labs/flux-schnell",
        ],
        "availableAgents": ["image-gen", "chat-companion", "lora-trainer"],
        "advantages": [
            "Lowest image-gen pricing with huge LoRA catalog",
            "APAC region latency",
            "OpenAI-compatible API",
        ],
        "businessAdvantages": [
            "Image gen at 1/10th DALL-E cost",
            "APAC region serves Asian markets well",
        ],
        "apiIntegrationDetails": "POST https://api.novita.ai/v3/openai/chat/completions with 'Authorization: Bearer <key>'. OpenAI-compatible.",
        "modalities": ["chat", "code", "image"],
    },
    {
        "name": "siliconflow",
        "displayName": "SiliconFlow",
        "tagline": "China's largest open-model aggregator — Qwen, DeepSeek, GLM, Llama with per-token pricing.",
        "icon": "Network",
        "color": "#1e40af",
        "category": "open-source",
        "kind": "service",
        "popularity": "medium",
        "bestFor": [
            "Serving Chinese open models (Qwen, DeepSeek, GLM) at low cost",
            "Mainland-China latency for APAC users",
            "Image gen with Flux, SDXL, Kolors, Hunyuan",
        ],
        "capabilities": [
            "Hosted Qwen, DeepSeek, GLM, Llama families",
            "Image gen: Flux, SDXL, Kolors, Hunyuan-DiT",
            "OpenAI-compatible API",
            "Free tier with generous limits on small models",
        ],
        "whenToUse": [
            "Primary audience is China / APAC",
            "You want the latest Qwen / DeepSeek models at lowest cost",
        ],
        "limitations": [
            "Some models only available in China-region endpoints",
            "Pricing/RMB conversion adds friction outside China",
        ],
        "samplePrompts": [
            "Serve Qwen-2.5-72B to Chinese users with <100ms TTFT.",
            "Generate 500 product images with Kolors at $0.001 each.",
            "Use DeepSeek-V3 as a backup to OpenAI in the failover chain.",
        ],
        "setupNotes": "Sign up at siliconflow.cn, create a key. Endpoint: https://api.siliconflow.cn/v1/chat/completions. Models like 'Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V3'.",
        "pricingTier": "Free tier on Qwen-7B / GLM-4-9B. Paid: Qwen-72B ~$0.50 / 1M tokens. Image gen: $0.001-0.01 per image.",
        "docsUrl": "https://docs.siliconflow.cn",
        "availableModels": [
            "Qwen/Qwen2.5-72B-Instruct", "Qwen/Qwen2.5-Coder-32B-Instruct",
            "deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1",
            "black-forest-labs/FLUX.1-schnell",
        ],
        "availableAgents": ["chat-companion", "image-gen", "code-copilot"],
        "advantages": [
            "Lowest pricing on Qwen / DeepSeek",
            "Free tier with no credit card",
            "Strong APAC latency",
        ],
        "businessAdvantages": [
            "China market entry without self-hosting",
            "Cost-optimized image generation",
        ],
        "apiIntegrationDetails": "POST https://api.siliconflow.cn/v1/chat/completions with 'Authorization: Bearer <key>'. OpenAI-compatible.",
        "modalities": ["chat", "code", "image", "reasoning", "embeddings"],
    },
    {
        "name": "lambda-labs",
        "displayName": "Lambda Labs",
        "tagline": "GPU cloud + hosted Llama inference — H100s at $2.49/hour plus OpenAI-compatible Llama API.",
        "icon": "Server",
        "color": "#7c3aed",
        "category": "open-source",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Long-running GPU rental at the cheapest rates",
            "Hosted Llama / Qwen / DeepSeek inference",
            "AI researchers needing multi-GPU instances",
            "Self-hosted vLLM / TGI on managed infra",
        ],
        "capabilities": [
            "On-demand + reserved H100 / A100 / H200 instances",
            "Lambda Inference API: hosted Llama / Qwen / DeepSeek",
            "OpenAI-compatible chat completions endpoint",
            "Persistent storage + file systems",
        ],
        "whenToUse": [
            "You need GPUs for days/weeks — Lambda is cheapest",
            "Hosted Llama inference without GPU ops",
        ],
        "limitations": [
            "GPU availability tight during peak demand",
            "Fewer regions than AWS/GCP",
        ],
        "samplePrompts": [
            "Rent 8x H100 for 1 week to pretrain a 1B model — ~$3,300.",
            "Serve Llama-3.1-405B via Lambda Inference API.",
            "Run vLLM on a 4x A100 instance for a customer-facing chatbot.",
        ],
        "setupNotes": "Sign up at lambdalabs.com, add payment. For inference: create a key under api.lambdalabs.com/v1. Endpoint: https://api.lambdalabs.com/v1/chat/completions.",
        "pricingTier": "H100 80GB: $2.49/hour on-demand. A100 80GB: $1.29/hour. Llama inference: $0.50 / 1M tokens (8B) to $2.50 / 1M (405B).",
        "docsUrl": "https://docs.lambdalabs.com",
        "availableModels": [
            "meta-llama/Llama-3.3-70B-Instruct", "meta-llama/Meta-Llama-3.1-405B-Instruct",
            "deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct",
        ],
        "availableAgents": ["custom-model-server", "chat-companion", "fine-tuner"],
        "advantages": [
            "Cheapest long-running GPU rental in market",
            "Hosted Llama inference — OpenAI-compatible",
            "Simple pricing — per-hour per-GPU",
            "Reserved instances for predictable workloads",
        ],
        "businessAdvantages": [
            "CapEx → OpEx without AWS/GCP premium",
            "Long fine-tuning runs at 1/3 cloud hyperscaler cost",
        ],
        "apiIntegrationDetails": "POST https://api.lambdalabs.com/v1/chat/completions with 'Authorization: Bearer <key>'. OpenAI-compatible.",
        "modalities": ["chat", "code", "reasoning"],
    },
    {
        "name": "baseten",
        "displayName": "Baseten",
        "tagline": "Serverless model deployment — package any model, get an autoscaling OpenAI-compatible endpoint.",
        "icon": "Server",
        "color": "#059669",
        "category": "open-source",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Deploying custom / fine-tuned models without GPU ops",
            "Autoscaling OpenAI-compatible endpoints",
            "Cold-start-optimized serverless inference",
            "Truss-based model packaging (portable across clouds)",
        ],
        "capabilities": [
            "Deploy any HuggingFace model in 1 click",
            "Custom models via Truss (Python model server)",
            "Autoscaling with cold-start optimization (sub-1s)",
            "OpenAI-compatible API for chat endpoints",
        ],
        "whenToUse": [
            "You have a fine-tuned model and need to serve it",
            "Together / Fireworks don't host your specific model",
        ],
        "limitations": [
            "Per-minute pricing adds up if traffic is spiky",
            "Cold starts on rarely-used endpoints",
        ],
        "samplePrompts": [
            "Deploy our fine-tuned Llama-3-8B as an OpenAI-compatible endpoint with autoscale.",
            "Serve Whisper-large-v3 for real-time STT with 5-50x autoscale.",
            "Deploy a Flux image-gen endpoint with sub-2s cold start.",
        ],
        "setupNotes": "Sign up at baseten.co, create a key under Settings. Deploy via UI or Truss CLI. Endpoints take ~5 min to deploy.",
        "pricingTier": "Per-minute GPU: A100 $1.10/min, H100 $2.40/min. Serverless: billed per request with autoscale.",
        "docsUrl": "https://docs.baseten.co",
        "availableModels": [
            "(any HF model — deploy via UI)",
            "(custom models via Truss packaging)",
        ],
        "availableAgents": ["custom-model-server", "voice-agent", "image-gen"],
        "advantages": [
            "Sub-1s cold starts — class-leading serverless",
            "Truss = portable model packaging",
            "1-click deploy of any HF model",
            "OpenAI-compatible API on chat endpoints",
        ],
        "businessAdvantages": [
            "No GPU ops team needed for custom model serving",
            "Autoscale handles traffic spikes without over-provisioning",
        ],
        "apiIntegrationDetails": "POST https://model-<id>.api.baseten.co/production/predict with 'Authorization: Api-Key <key>'. Schema depends on the model.",
        "modalities": ["chat", "code", "image", "voice", "vision"],
    },
    {
        "name": "nebius",
        "displayName": "Nebius AI",
        "tagline": "Yandex-spun AI cloud — H100 clusters, hosted Llama / Qwen inference, EU data residency.",
        "icon": "Cloud",
        "color": "#0f766e",
        "category": "open-source",
        "kind": "service",
        "popularity": "medium",
        "bestFor": [
            "EU data residency for LLM inference",
            "Large-scale H100 cluster rental",
            "Hosted Llama / Qwen / DeepSeek with OpenAI-compatible API",
        ],
        "capabilities": [
            "Managed inference: Llama, Qwen, Mistral, DeepSeek",
            "OpenAI-compatible API",
            "Large-scale H100 cluster rental",
            "EU (Finland) data residency",
        ],
        "whenToUse": [
            "GDPR compliance requires EU data residency",
            "You need H100 clusters for multi-week training runs",
        ],
        "limitations": [
            "Newer brand — less enterprise trust",
            "Smaller community than AWS/GCP",
        ],
        "samplePrompts": [
            "Serve Llama-3.3-70B to EU customers with full GDPR data residency.",
            "Rent 64x H100 cluster for 2-week Llama pretraining.",
            "Run DeepSeek-V3 as a backup provider with EU data residency.",
        ],
        "setupNotes": "Sign up at nebius.ai, create a key under IAM. Endpoint: https://eu.llm.api.nebius.ai/v1/chat/completions.",
        "pricingTier": "Llama-3.3-70B: $0.60 / 1M input, $1.80 / 1M output. H100: $1.20-2.00/hour.",
        "docsUrl": "https://docs.nebius.com",
        "availableModels": [
            "meta-llama/Llama-3.3-70B-Instruct", "Qwen/Qwen2.5-72B-Instruct",
            "deepseek-ai/DeepSeek-V3", "mistralai/Mistral-Nemo",
        ],
        "availableAgents": ["chat-companion", "fine-tuner", "eu-resident-agent"],
        "advantages": [
            "EU data residency out of the box",
            "Large-scale H100 cluster availability",
            "OpenAI-compatible API",
        ],
        "businessAdvantages": [
            "GDPR-friendly hosting for EU customers",
            "Cost-competitive H100 clusters for training",
        ],
        "apiIntegrationDetails": "POST https://eu.llm.api.nebius.ai/v1/chat/completions with 'Authorization: Bearer <key>'. OpenAI-compatible.",
        "modalities": ["chat", "code", "reasoning", "embeddings"],
    },
    {
        "name": "lepton-ai",
        "displayName": "Lepton AI",
        "tagline": "Serverless LLM serving with autoscale — built by ex-Jujiu / Meta engineers for production inference.",
        "icon": "Server",
        "color": "#0ea5e9",
        "category": "open-source",
        "kind": "service",
        "popularity": "medium",
        "bestFor": [
            "Production serverless inference with sub-1s cold starts",
            "Running open models (Llama, Mistral, SDXL) at scale",
            "Image gen via SDXL / Flux with autoscale",
        ],
        "capabilities": [
            "Serverless LLM endpoints with autoscale",
            "OpenAI-compatible API",
            "Image gen: SDXL, Flux, SD3.5",
            "Custom model deployment via Lepton SDK",
        ],
        "whenToUse": [
            "Need autoscaling open-model serving without GPU ops",
            "Image generation at production scale",
        ],
        "limitations": [
            "Smaller community than RunPod / Together",
            "Premium pricing for managed service",
        ],
        "samplePrompts": [
            "Deploy Llama-3-70B as a serverless endpoint with sub-1s cold start.",
            "Serve Flux image-gen at 100 req/sec with autoscale.",
            "Run Whisper-large-v3 for STT with auto-scaling to 50 GPUs.",
        ],
        "setupNotes": "Sign up at lepton.ai, create a key. Endpoint: https://api.lepton.ai/v1/chat/completions for LLMs.",
        "pricingTier": "Llama-3-8B: $0.05 / 1M tokens. Llama-3-70B: $0.50 / 1M tokens. H100: $2.00/hour.",
        "docsUrl": "https://www.lepton.ai/docs",
        "availableModels": [
            "meta-llama/Llama-3.3-70B-Instruct", "mistralai/Mistral-7B-Instruct",
            "black-forest-labs/flux-schnell",
        ],
        "availableAgents": ["chat-companion", "image-gen", "voice-agent"],
        "advantages": [
            "Sub-1s cold starts on serverless",
            "Production-grade autoscaling",
            "OpenAI-compatible API",
        ],
        "businessAdvantages": [
            "No GPU ops for autoscaling inference",
            "Production-ready SLAs",
        ],
        "apiIntegrationDetails": "POST https://api.lepton.ai/v1/chat/completions with 'Authorization: Bearer <key>'. OpenAI-compatible.",
        "modalities": ["chat", "code", "image"],
    },
    {
        "name": "anyscale",
        "displayName": "Anyscale",
        "tagline": "Ray-based scaling platform — serve any open LLM with autoscale plus fine-tuning endpoints.",
        "icon": "Network",
        "color": "#0f766e",
        "category": "open-source",
        "kind": "service",
        "popularity": "medium",
        "bestFor": [
            "Production Ray workloads with autoscaling",
            "Fine-tuning Llama / Mistral on managed Ray clusters",
            "Serving Llama with vLLM on Anyscale endpoints",
        ],
        "capabilities": [
            "Anyscale Endpoints: hosted Llama / Mistral / Code Llama",
            "Fine-tuning via LoRA + QLoRA on managed Ray",
            "OpenAI-compatible API",
            "Ray Serve for custom model serving",
        ],
        "whenToUse": [
            "You're already using Ray and want managed Ray",
            "Need fine-tuning + serving on one platform",
        ],
        "limitations": [
            "Smaller model catalog than Together / Fireworks",
            "Premium pricing for managed Ray",
        ],
        "samplePrompts": [
            "Fine-tune Llama-3-8B on 100k examples via Anyscale's managed Ray.",
            "Serve Llama-3-70B with vLLM on Anyscale Endpoints.",
            "Run a Ray Serve pipeline with autoscaling workers.",
        ],
        "setupNotes": "Sign up at anyscale.com, create a key. Endpoint: https://api.endpoints.anyscale.com/v1/chat/completions.",
        "pricingTier": "Llama-3-8B: $0.15 / 1M tokens. Llama-3-70B: $1.00 / 1M tokens. Fine-tuning: $1.50-3.00/hour per A100.",
        "docsUrl": "https://docs.anyscale.com",
        "availableModels": [
            "meta-llama/Llama-3.3-70B-Instruct", "meta-llama/Meta-Llama-3.1-8B-Instruct",
            "mistralai/Mistral-7B-Instruct-v0.3",
        ],
        "availableAgents": ["chat-companion", "fine-tuner", "ray-pipeline"],
        "advantages": [
            "Managed Ray + fine-tuning + serving in one platform",
            "OpenAI-compatible API",
            "Production-grade autoscaling",
        ],
        "businessAdvantages": [
            "Single platform for fine-tune → serve → scale",
            "No Ray ops team needed",
        ],
        "apiIntegrationDetails": "POST https://api.endpoints.anyscale.com/v1/chat/completions with 'Authorization: Bearer <key>'. OpenAI-compatible.",
        "modalities": ["chat", "code", "embeddings"],
    },
    {
        "name": "voyage-ai",
        "displayName": "Voyage AI",
        "tagline": "Best-in-class embedding models for RAG — optimized for retrieval precision across languages and code.",
        "icon": "Boxes",
        "color": "#1e40af",
        "category": "specialized",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "RAG pipelines needing top retrieval precision",
            "Multilingual embeddings (50+ languages)",
            "Code embeddings for code-search / dev tools",
            "Specialized embeddings (law, finance, healthcare)",
        ],
        "capabilities": [
            "Voyage-3 large / lite / economy embeddings",
            "Voyage-code-2 for code search",
            "Voyage-finance-2 for financial documents",
            "Voyage-law-2 for legal documents",
            "Multilingual: 50+ languages with strong cross-lingual retrieval",
        ],
        "whenToUse": [
            "OpenAI / Cohere embeddings underperform on your domain",
            "Code / legal / financial RAG with domain-specific embeddings",
        ],
        "limitations": [
            "Embeddings only — no chat / completion models",
            "Premium pricing per token vs open-source alternatives",
        ],
        "samplePrompts": [
            "Embed 1M legal contracts with voyage-law-2 for case-law retrieval.",
            "Build a code search engine over a 10M-line monorepo with voyage-code-2.",
            "Multilingual product search across 30 markets with voyage-3-large.",
        ],
        "setupNotes": "Sign up at voyageai.com, create a key under Dashboard. Endpoint: https://api.voyageai.com/v1/embeddings. Models: 'voyage-3', 'voyage-3-large', 'voyage-code-2', 'voyage-law-2', 'voyage-finance-2'.",
        "pricingTier": "Voyage-3: $0.02 / 1M tokens. Voyage-3-large: $0.12 / 1M. Voyage-code-2: $0.12 / 1M. Free tier: 200M tokens.",
        "docsUrl": "https://docs.voyageai.com",
        "availableModels": [
            "voyage-3", "voyage-3-large", "voyage-3-lite",
            "voyage-code-2", "voyage-law-2", "voyage-finance-2",
        ],
        "availableAgents": ["rag-researcher", "code-search", "legal-search"],
        "advantages": [
            "Best retrieval precision in MTEB benchmarks (most categories)",
            "Domain-specific variants for law, finance, code",
            "Strong multilingual coverage",
            "Generous free tier",
        ],
        "businessAdvantages": [
            "Better RAG precision = fewer hallucinations = better UX",
            "Domain variants unlock vertical SaaS (legal, finance)",
        ],
        "apiIntegrationDetails": "POST https://api.voyageai.com/v1/embeddings { input, model } with 'Authorization: Bearer <key>'. Returns { embeddings: [[...]] }.",
        "modalities": ["embeddings"],
    },
    {
        "name": "jina-ai",
        "displayName": "Jina AI",
        "tagline": "Multimodal embeddings, rerankers, reader, and clip — open-source-first NLP infrastructure.",
        "icon": "Boxes",
        "color": "#0ea5e9",
        "category": "specialized",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Multimodal embeddings (text + image in one vector space)",
            "Reader API: convert any URL to LLM-ready markdown",
            "Rerankers for RAG precision boost",
            "Open-source-friendly — weights available on HuggingFace",
        ],
        "capabilities": [
            "jina-embeddings-v3: text + multilingual embeddings",
            "jina-clip-v2: text + image embeddings in shared space",
            "jina-reranker-v2: reranking for RAG",
            "Reader API: URL → clean markdown",
            "Classifier API: zero-shot text classification",
        ],
        "whenToUse": [
            "Need text + image in same embedding space",
            "Web-to-markdown ingestion for RAG",
        ],
        "limitations": [
            "Embeddings only — no chat models",
            "Reader API has rate limits on free tier",
        ],
        "samplePrompts": [
            "Embed 100k product photos + descriptions in one vector space with jina-clip-v2.",
            "Convert 10k blog URLs to markdown for RAG ingestion via Reader API.",
            "Rerank top-100 search results to top-10 with jina-reranker-v2.",
        ],
        "setupNotes": "Sign up at jina.ai, create a key. Endpoints: https://api.jina.ai/v1/embeddings, /v1/rerank, https://r.jina.ai/<url> for reader.",
        "pricingTier": "Free tier: 1M tokens / 1000 reader requests. Paid: $0.018 / 1M tokens for embeddings, $0.02 / 1M for rerank.",
        "docsUrl": "https://jina.ai/docs",
        "availableModels": [
            "jina-embeddings-v3", "jina-embeddings-v2-base-en",
            "jina-clip-v2", "jina-reranker-v2-base-multilingual",
        ],
        "availableAgents": ["rag-researcher", "image-search", "web-reader"],
        "advantages": [
            "Multimodal embeddings (text + image) in one space",
            "Reader API solves the URL-to-markdown problem",
            "Open weights — self-host if needed",
            "Generous free tier",
        ],
        "businessAdvantages": [
            "Multimodal search unlocks e-commerce / catalog use cases",
            "Reader API replaces brittle scraping infra",
        ],
        "apiIntegrationDetails": "POST https://api.jina.ai/v1/embeddings { input, model } with 'Authorization: Bearer <key>'. Reader: GET https://r.jina.ai/https://example.com.",
        "modalities": ["embeddings", "vision"],
    },
    {
        "name": "amazon-bedrock",
        "displayName": "Amazon Bedrock",
        "tagline": "AWS-managed access to Claude, Llama, Titan, Mistral, and Stable Diffusion — enterprise-grade.",
        "icon": "Cloud",
        "color": "#ff9900",
        "category": "frontier",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Enterprise already on AWS — single-vendor procurement",
            "Claude / Llama / Mistral via one AWS-billed API",
            "Knowledge Bases for managed RAG over S3 data",
            "Guardrails for content filtering and PII redaction",
        ],
        "capabilities": [
            "Multi-model: Claude, Llama, Mistral, Titan, AI21, Cohere",
            "Knowledge Bases: managed RAG with OpenSearch / Pinecone",
            "Agents: multi-step tool-use workflows",
            "Guardrails: content filters, PII redaction, denied topics",
            "IAM-based auth — no separate API keys",
        ],
        "whenToUse": [
            "You're already on AWS — use existing IAM / billing",
            "Need enterprise-grade guardrails / compliance",
        ],
        "limitations": [
            "Cross-region inference adds latency",
            "Pricing slightly above direct provider (Anthropic, Meta)",
            "Vendor lock-in to AWS ecosystem",
        ],
        "samplePrompts": [
            "Build a Claude-powered support agent with Bedrock Knowledge Bases over S3 docs.",
            "Apply PII redaction guardrails to all LLM calls for HIPAA compliance.",
            "Multi-model fallback: Claude → Llama → Titan via Bedrock routing.",
        ],
        "setupNotes": "Enable Bedrock in AWS Console under us-east-1 / us-west-2. Request model access. Use AWS SDK (boto3) or HTTPS API with SigV4 auth.",
        "pricingTier": "Per-token, comparable to direct providers. Claude 3.5 Sonnet: $3 / 1M input, $15 / 1M output.",
        "docsUrl": "https://docs.aws.amazon.com/bedrock",
        "availableModels": [
            "anthropic.claude-3-5-sonnet-20241022-v2:0", "anthropic.claude-3-5-haiku-20241022-v1:0",
            "meta.llama3-3-70b-instruct-v1:0", "mistral.mistral-large-2407-v1:0",
            "amazon.titan-text-premier-v1:0",
        ],
        "availableAgents": ["enterprise-rag", "guardrailed-chat", "support-agent"],
        "advantages": [
            "Single AWS bill for all LLM spend",
            "Managed RAG (Knowledge Bases) — no vector DB setup",
            "Enterprise guardrails out of the box",
            "IAM auth integrates with existing AWS identity",
        ],
        "businessAdvantages": [
            "AWS procurement team can handle vendor approval",
            "Single vendor for cloud + AI compliance",
            "RAG without building infra = faster time-to-market",
        ],
        "apiIntegrationDetails": "AWS SDK: bedrock-runtime:InvokeModel with SigV4 auth. HTTPS: POST https://bedrock-runtime.<region>.amazonaws.com/model/<model-id>/invoke.",
        "modalities": ["chat", "code", "image", "vision", "embeddings", "tools"],
    },
    {
        "name": "cloudflare-workers-ai",
        "displayName": "Cloudflare Workers AI",
        "tagline": "Run LLMs on Cloudflare's edge network — 300+ cities, free tier, no cold starts.",
        "icon": "Cloud",
        "color": "#f38020",
        "category": "open-source",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Edge inference for global low-latency chat",
            "Small models (Llama-3-8B, Mistral-7B) at scale",
            "Workers-integrated AI pipelines",
            "Free tier for prototypes / side projects",
        ],
        "capabilities": [
            "LLM inference at 300+ Cloudflare edge locations",
            "OpenAI-compatible API via AI Gateway",
            "Whisper STT, Mistral, Llama, Gemma, Qwen",
            "Workers AI bindings for in-Worker inference",
            "Vectorize: managed vector DB on edge",
        ],
        "whenToUse": [
            "Need global low-latency LLM serving (sub-100ms TTFT worldwide)",
            "Already on Cloudflare for Workers / CDN",
        ],
        "limitations": [
            "Only small models (≤8B) at edge — 70B+ not supported",
            "Per-request pricing can add up",
        ],
        "samplePrompts": [
            "Serve Llama-3-8B to global users with <100ms TTFT via Workers AI.",
            "Add Whisper STT to a Cloudflare Worker for call transcription.",
            "Build a RAG pipeline with Workers AI + Vectorize on the edge.",
        ],
        "setupNotes": "Sign up at cloudflare.com, enable Workers AI. Endpoint: https://api.cloudflare.com/client/v4/accounts/<id>/ai/run/<model>. Auth with CF API token.",
        "pricingTier": "Free tier: 10k Neurons/day. Paid: ~$0.0001 / 1M tokens for Llama-8B.",
        "docsUrl": "https://developers.cloudflare.com/workers-ai",
        "availableModels": [
            "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct",
            "@cf/mistral/mistral-7b-instruct-v0.2", "@cf/openai/whisper-tiny-en",
        ],
        "availableAgents": ["edge-chat", "edge-rag", "transcriber"],
        "advantages": [
            "Global edge inference — sub-100ms TTFT worldwide",
            "Generous free tier (10k Neurons/day)",
            "Workers bindings for in-Worker AI calls",
            "Vectorize integration for edge RAG",
        ],
        "businessAdvantages": [
            "Latency edge for global SaaS",
            "Free tier for prototypes = lower risk",
        ],
        "apiIntegrationDetails": "POST https://api.cloudflare.com/client/v4/accounts/<id>/ai/run/<model> { input } with 'Authorization: Bearer <cf-token>'.",
        "modalities": ["chat", "code", "voice", "image", "embeddings"],
    },
]


def to_ts_entry(d: dict) -> str:
    """Convert a dict to a TS entry literal matching the ProviderBenefit schema."""
    def arr(items):
        return "[" + ", ".join(f'"{i}"' for i in items) + "]"

    lines = ["  {"]
    lines.append(f"    name: `{d['name']}`,")
    lines.append(f"    displayName: `{d['displayName']}`,")
    lines.append(f"    tagline: `{d['tagline']}`,")
    lines.append(f"    icon: `{d['icon']}`,")
    lines.append(f"    color: `{d['color']}`,")
    lines.append(f"    category: `{d['category']}`,")
    lines.append(f"    kind: `{d['kind']}`,")
    lines.append(f"    popularity: `{d['popularity']}`,")
    lines.append(f"    bestFor: [")
    for b in d["bestFor"]:
        lines.append(f"    `{b}`,")
    lines.append(f"    ],")
    lines.append(f"    capabilities: [")
    for c in d["capabilities"]:
        lines.append(f"    `{c}`,")
    lines.append(f"    ],")
    lines.append(f"    whenToUse: [")
    for w in d["whenToUse"]:
        lines.append(f"    `{w}`,")
    lines.append(f"    ],")
    lines.append(f"    limitations: [")
    for l in d["limitations"]:
        lines.append(f"    `{l}`,")
    lines.append(f"    ],")
    lines.append(f"    samplePrompts: [")
    for s in d["samplePrompts"]:
        lines.append(f"    `{s}`,")
    lines.append(f"    ],")
    lines.append(f"    setupNotes: `{d['setupNotes']}`,")
    lines.append(f"    pricingTier: `{d['pricingTier']}`,")
    lines.append(f"    docsUrl: `{d['docsUrl']}`,")
    lines.append(f"    availableModels: [")
    for m in d["availableModels"]:
        lines.append(f"    `{m}`,")
    lines.append(f"    ],")
    lines.append(f"    availableAgents: [")
    for a in d["availableAgents"]:
        lines.append(f"    `{a}`,")
    lines.append(f"    ],")
    lines.append(f"    advantages: [")
    for ad in d["advantages"]:
        lines.append(f"    `{ad}`,")
    lines.append(f"    ],")
    lines.append(f"    businessAdvantages: [")
    for ba in d["businessAdvantages"]:
        lines.append(f"    `{ba}`,")
    lines.append(f"    ],")
    lines.append(f"    apiIntegrationDetails: `{d['apiIntegrationDetails']}`,")
    lines.append(f"    modalities: {arr(d['modalities'])},")
    lines.append("  },")
    return "\n".join(lines)


def main() -> int:
    if not FILE.exists():
        print(f"ERROR: {FILE} not found", file=sys.stderr)
        return 1

    src = FILE.read_text()

    # Find the closing `];` of PROVIDER_BENEFITS.
    start_match = re.search(
        r"export const PROVIDER_BENEFITS:\s*ProviderBenefit\[\]\s*=\s*\[",
        src,
    )
    if not start_match:
        print("ERROR: could not locate PROVIDER_BENEFITS array start", file=sys.stderr)
        return 2

    end_match = re.search(r"\n\];\n", src[start_match.end():])
    if not end_match:
        print("ERROR: could not locate PROVIDER_BENEFITS array end", file=sys.stderr)
        return 3

    insert_at = start_match.end() + end_match.start()

    # Idempotency: skip entries whose `name:` key already exists.
    added = []
    skipped = []
    blocks = []
    for entry in ENTRIES:
        # Check both 'name: `<key>`,' and 'displayName: `<DisplayName>`,' to be safe.
        name_pat = re.compile(
            r"^\s*name:\s*`" + re.escape(entry["name"]) + r"`\s*,\s*$",
            re.MULTILINE,
        )
        if name_pat.search(src):
            skipped.append(entry["name"])
            continue
        blocks.append(to_ts_entry(entry))
        added.append(entry["name"])

    if not blocks:
        print(f"All {len(ENTRIES)} entries already present. "
              f"(Skipped: {', '.join(skipped)})")
        return 0

    new_chunk = "\n" + "\n".join(blocks) + "\n"
    new_src = src[:insert_at] + new_chunk + src[insert_at:]
    FILE.write_text(new_src)

    print(f"Inserted {len(added)} new entries: {', '.join(added)}")
    if skipped:
        print(f"Skipped (already present): {', '.join(skipped)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
