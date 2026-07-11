#!/usr/bin/env python3
"""
Generate the providers array block for scripts/seed.ts.

Outputs a TypeScript snippet that can be pasted into seed.ts replacing the
existing `const providers = [...]` block. Includes all 32 providers with
the open-source-first priority ordering:

  Tier 1 (open source, priority 0-21): marq_free, huggingface, ollama, vllm,
    llama, transformers, pytorch, tensorflow, keras, opencv, scikit_learn,
    instructor, autogen, crewai, langchain, mlflow, openclaw, outerbounds,
    anaconda, gradio, replit, modal
  Tier 2 (chargeable, priority 22-31): marq_glm, zai, mistral, deepseek, qwen,
    openai, gemini, claude, grok, qvac
"""
import json

PROVIDERS = [
    # ── Tier 1: Open-source / free (tried first in auto mode) ──
    {"name": "marq_free", "displayName": "Marq Free (Always-On)", "priority": 0,
     "description": "Marq Free — the platform's GUARANTEED-AVAILABILITY provider backed by Pollinations.ai. No API key required, no rate limits to worry about. Uses open-source models (gpt-oss-20b and others) to deliver real AI responses when every paid provider is down or rate-limited. Seeded at the HIGHEST priority so the failover engine tries it FIRST in auto mode — ensuring the platform responds fast and never throws a fallback error to the user.",
     "apiEndpoint": "https://text.pollinations.ai/openai", "apiKey": None,
     "models": ["openai", "openai-large", "mistral", "qwen-coder"],
     "color": "#10b981", "icon": "shield"},
    {"name": "huggingface", "displayName": "Hugging Face", "priority": 1,
     "description": "Open-source model zoo — Llama 3.1, Mistral, Phi-3, CodeLlama, BGE embeddings. Serverless Inference API for thousands of Hub models. Free anonymous tier available.",
     "apiEndpoint": "https://api-inference.huggingface.co/models", "apiKey": None,
     "models": ["meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3", "microsoft/Phi-3-mini-4k-instruct"],
     "color": "#ff9d00", "icon": "bot"},
    {"name": "ollama", "displayName": "Ollama (Local)", "priority": 2,
     "description": "Run Llama 3.1, Mistral, Phi-3, and 100+ models locally on your own hardware. Privacy-first, offline-capable, OpenAI-compatible API at localhost:11434.",
     "apiEndpoint": "http://localhost:11434/v1/chat/completions", "apiKey": None,
     "models": ["llama3.1", "mistral", "phi3", "qwen2.5", "gemma2", "deepseek-r1"],
     "color": "#22c55e", "icon": "hard-drive"},
    {"name": "vllm", "displayName": "vLLM", "priority": 3,
     "description": "High-throughput LLM serving with PagedAttention — production inference for Llama, Mistral, Qwen, DeepSeek, and more. OpenAI-compatible API server. 2-4x throughput vs. naive serving.",
     "apiEndpoint": "http://localhost:8000/v1/chat/completions", "apiKey": None,
     "models": ["llama3.1-8b", "llama3.1-70b", "mistral-7b", "qwen2.5-7b", "deepseek-r1", "codeqwen-7b"],
     "color": "#22c55e", "icon": "server"},
    {"name": "llama", "displayName": "Llama (Meta AI)", "priority": 4,
     "description": "Meta's open-weight LLM family — the foundation of the open-source LLM ecosystem. Sizes from 1B to 405B params. Multimodal (Llama 3.2 Vision). Run via Ollama, vLLM, TGI, or HF Transformers. Open weights = auditability + zero per-token cost when self-hosted.",
     "apiEndpoint": "http://localhost:11434/v1/chat/completions", "apiKey": None,
     "models": ["llama-3.1-8b", "llama-3.1-70b", "llama-3.1-405b", "llama-3.2-1b", "llama-3.2-3b", "llama-3.2-11b-vision", "llama-3.3-70b"],
     "color": "#0668e1", "icon": "sparkles"},
    {"name": "transformers", "displayName": "Transformers (HF)", "priority": 5,
     "description": "Hugging Face Transformers library — run 500K+ pretrained models locally. Pipelines for text generation, classification, translation, summarization, vision, and audio. Trainer API for fine-tuning. Apache 2.0 license.",
     "apiEndpoint": "http://localhost:8080/v1/chat/completions", "apiKey": None,
     "models": ["meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3", "Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/deepseek-r1"],
     "color": "#ffd21e", "icon": "boxes"},
    {"name": "pytorch", "displayName": "PyTorch", "priority": 6,
     "description": "Open-source tensor library — the foundation of modern deep learning. Flexible eager execution, GPU + TPU support, distributed training. Industry standard for ML research. Wrap with TorchServe to expose as a chat provider.",
     "apiEndpoint": "http://localhost:8080/v1/chat/completions", "apiKey": None,
     "models": ["custom (your trained model)"],
     "color": "#ee4c2c", "icon": "flask-conical"},
    {"name": "tensorflow", "displayName": "TensorFlow", "priority": 7,
     "description": "End-to-end ML platform from Google — from research to production at scale. TF Serving for production, TF Lite for mobile, TF.js for browser. TPU-optimized. Wrap with TF Serving to expose as a chat provider.",
     "apiEndpoint": "http://localhost:8501/v1/chat/completions", "apiKey": None,
     "models": ["custom (your trained model)"],
     "color": "#ff6f00", "icon": "flask-conical"},
    {"name": "keras", "displayName": "Keras", "priority": 8,
     "description": "High-level neural network API — friendly interface over TensorFlow, JAX, and PyTorch (Keras 3). Beginner-friendly, rapid prototyping. Educational resource for new ML hires.",
     "apiEndpoint": "http://localhost:8080/v1/chat/completions", "apiKey": None,
     "models": ["custom (your Keras model)"],
     "color": "#d00000", "icon": "layers"},
    {"name": "opencv", "displayName": "OpenCV", "priority": 9,
     "description": "Computer vision library — 2500+ algorithms for image and video processing. Real-time performance, cross-platform (C++, Python, Java, mobile). BSD license = commercial-friendly. Wrap with FastAPI to expose as a provider.",
     "apiEndpoint": "http://localhost:8080/v1/chat/completions", "apiKey": None,
     "models": ["custom (Haar cascades, DNN models)"],
     "color": "#06a77d", "icon": "eye"},
    {"name": "scikit_learn", "displayName": "Scikit-learn", "priority": 10,
     "description": "Classical ML library — random forests, SVMs, gradient boosting, clustering, dimensionality reduction. 30+ algorithms, pipeline + GridSearch for tuning. Interpretable models = compliance-friendly. BSD license.",
     "apiEndpoint": "http://localhost:8080/v1/chat/completions", "apiKey": None,
     "models": ["custom (your trained sklearn model)"],
     "color": "#f7931e", "icon": "flask-conical"},
    {"name": "instructor", "displayName": "Instructor", "priority": 11,
     "description": "Structured extraction from LLMs — Pydantic-powered typed outputs. Works with OpenAI, Anthropic, Gemini, Ollama. Validation + automatic retry on parse failure. Type-safe LLM outputs for production. MIT license.",
     "apiEndpoint": "http://localhost:8080/v1/chat/completions", "apiKey": None,
     "models": ["custom (wraps your LLM client)"],
     "color": "#3b82f6", "icon": "code"},
    {"name": "autogen", "displayName": "Microsoft AutoGen", "priority": 12,
     "description": "Multi-agent conversation framework from Microsoft Research. Conversational agents with roles, group chat, code execution via Docker, human-in-loop support. Research-grade agentic patterns. MIT license.",
     "apiEndpoint": "http://localhost:8000/v1/chat/completions", "apiKey": None,
     "models": ["custom (uses any LLM as backbone)"],
     "color": "#0078d4", "icon": "users"},
    {"name": "crewai", "displayName": "CrewAI Orchestrator", "priority": 13,
     "description": "Multi-agent orchestration framework — decompose goals across role-based agents (Researcher, Analyst, Writer) and synthesize their outputs. CrewAI+ hosted from $99/month.",
     "apiEndpoint": "http://localhost:8000/v1/chat/completions", "apiKey": None,
     "models": ["marq-crewai-orchestrator", "researcher-writer-crew", "dev-qa-ops-crew"],
     "color": "#ec4899", "icon": "users"},
    {"name": "langchain", "displayName": "LangChain / LangServe", "priority": 14,
     "description": "Compose prompts, retrievers, and tools into reproducible chains. Expose any deployed LangServe endpoint as a chat provider. RAG pipelines, tool-using chains, LangSmith monitoring.",
     "apiEndpoint": "http://localhost:8000/v1/chat/completions", "apiKey": None,
     "models": ["marq-langchain-default", "rag-chain", "tool-use-chain"],
     "color": "#14b8a6", "icon": "link"},
    {"name": "mlflow", "displayName": "MLflow AI Gateway", "priority": 15,
     "description": "MLflow AI Gateway / AI Serve — route chat through your own registered and version-controlled models. OpenAI-compatible gateway for MLOps workflows. A/B test model versions, audit trails.",
     "apiEndpoint": "http://localhost:5000/v1/chat/completions", "apiKey": None,
     "models": ["marq-mlflow-default", "llama-3.1-registered", "mistral-registered"],
     "color": "#0ea5e9", "icon": "database"},
    {"name": "openclaw", "displayName": "OpenClaw", "priority": 16,
     "description": "Open-source agentic framework — community-driven alternative to proprietary agent platforms. Customizable agent loops, tool calling + memory, plugin architecture. Fully self-hosted.",
     "apiEndpoint": "http://localhost:8000/v1/chat/completions", "apiKey": None,
     "models": ["custom (uses any LLM you configure)"],
     "color": "#8b5cf6", "icon": "wrench"},
    {"name": "outerbounds", "displayName": "Outerbounds", "priority": 17,
     "description": "Metaflow-based ML/AI platform — production-grade pipelines for serious ML teams. Netflix-battle-tested Metaflow. Versioning + resumability, cloud-native (k8s). Expose inference as OpenAI-compatible endpoint.",
     "apiEndpoint": "http://localhost:8080/v1/chat/completions", "apiKey": None,
     "models": ["custom (your pipeline artifacts)"],
     "color": "#1e293b", "icon": "server"},
    {"name": "anaconda", "displayName": "Anaconda Platform", "priority": 18,
     "description": "Enterprise Python data science platform — conda package + environment management, Anaconda Repository for private package hosting, Anaconda Enterprise for team collaboration. Reproducible environments, audit-ready package provenance.",
     "apiEndpoint": "https://repo.anaconda.com/api", "apiKey": None,
     "models": ["(package distribution — bundles PyTorch, TF, sklearn, etc.)"],
     "color": "#42b029", "icon": "server"},
    {"name": "gradio", "displayName": "Gradio Spaces", "priority": 19,
     "description": "Hugging Face Gradio Spaces — interactive ML demo UIs. Point the apiEndpoint at any Space's API URL to chat with its underlying model. Great for evaluating niche models before self-hosting.",
     "apiEndpoint": "https://api-inference.huggingface.co/spaces", "apiKey": None,
     "models": ["marq-gradio-default", "whisper-gradio", "stable-diffusion-gradio"],
     "color": "#f97316", "icon": "layout"},
    {"name": "replit", "displayName": "Replit", "priority": 20,
     "description": "Replit Code v1.5 — collaborative cloud IDE coding model tuned for short, runnable snippets with inline explanations. replit-code is open weights. OpenAI-compatible API at model-proxy.replit.com.",
     "apiEndpoint": "https://model-proxy.replit.com/v1/chat/completions", "apiKey": None,
     "models": ["replit-code-v1_5-3b", "replit-code-v1_5-7b"],
     "color": "#f26207", "icon": "code"},
    {"name": "modal", "displayName": "Modal (Serverless)", "priority": 21,
     "description": "Open-source serverless inference platform — package any model as a scalable Modal function. OpenAI-compatible gateway for custom-deployed models. Pay-per-invocation, scales to zero.",
     "apiEndpoint": "https://modal.com/v1/chat/completions", "apiKey": None,
     "models": ["marq-modal-default", "llama-3.1-70b-modal", "mixtral-8x7b-modal"],
     "color": "#7c3aed", "icon": "server"},
    # ── Tier 2: Chargeable commercial AI APIs (fallback when open source is exhausted) ──
    {"name": "marq_glm", "displayName": "Marq GLM (Built-in)", "priority": 22,
     "description": "Built-in real-LLM provider powered by GLM-4-Plus via the z-ai SDK. Works on Vercel automatically when ZAI_TOKEN env var is set — no API key management needed.",
     "apiEndpoint": None, "apiKey": None,
     "models": ["glm-4-plus", "glm-4-air", "glm-4-long"],
     "color": "#3b82f6", "icon": "sparkles"},
    {"name": "zai", "displayName": "Zai", "priority": 23,
     "description": "Zai (z.ai) — direct access to GLM-4-Plus, GLM-4-Air, and GLM-4-Long models via the official z.ai API. Same backend as Marq GLM. Activate by setting ZAI_TOKEN as env var.",
     "apiEndpoint": None, "apiKey": None,
     "models": ["glm-4-plus", "glm-4-air", "glm-4-long", "glm-4-flash"],
     "color": "#0ea5e9", "icon": "sparkles"},
    {"name": "mistral", "displayName": "Mistral AI", "priority": 24,
     "description": "European frontier LLM — efficient, open-weight, GDPR-friendly. Mistral Large/Medium/Small/Nemo. Open weights for Mistral 7B / Mixtral 8x7B / 8x22B. Function calling + JSON mode. EU-hosted (La Plateforme).",
     "apiEndpoint": "https://api.mistral.ai/v1/chat/completions", "apiKey": None,
     "models": ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "open-mistral-nemo", "open-mixtral-8x22b"],
     "color": "#ff7000", "icon": "wind"},
    {"name": "deepseek", "displayName": "DeepSeek", "priority": 25,
     "description": "Cost-efficient frontier LLM — strong reasoning at 1/10th the price. DeepSeek-V3, DeepSeek-R1 (reasoning rivals o1), DeepSeek-Coder. Open weights for V3 + R1. Industry-leading cost-per-token. Long context (128K).",
     "apiEndpoint": "https://api.deepseek.com/v1/chat/completions", "apiKey": None,
     "models": ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"],
     "color": "#4d6bfe", "icon": "brain"},
    {"name": "qwen", "displayName": "Qwen (Alibaba Cloud)", "priority": 26,
     "description": "Alibaba's flagship LLM family — strong bilingual (EN/CN), code (Qwen-Coder rivals GPT-4o), math (Qwen-Math), long context (Qwen-Long 128K). DashScope API or self-host the open weights via vLLM/Ollama.",
     "apiEndpoint": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", "apiKey": None,
     "models": ["qwen2.5-72b-instruct", "qwen2.5-coder-32b", "qwen2.5-math-72b", "qwen2.5-7b-instruct", "qwen-long"],
     "color": "#615ced", "icon": "sparkles"},
    {"name": "openai", "displayName": "OpenAI", "priority": 27,
     "description": "GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo and o-series reasoning models. Strong general-purpose reasoning, code generation, and tool use.",
     "apiEndpoint": "https://api.openai.com/v1/chat/completions", "apiKey": None,
     "models": ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "o1-mini"],
     "color": "#10a37f", "icon": "openai"},
    {"name": "gemini", "displayName": "Google Gemini", "priority": 28,
     "description": "Gemini 2.5 Flash, Gemini 2.5 Pro. Long-context multimodal reasoning, strong at grounded factual answers and code.",
     "apiEndpoint": "https://generativelanguage.googleapis.com/v1beta/models", "apiKey": None,
     "models": ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-lite"],
     "color": "#4285f4", "icon": "gemini"},
    {"name": "claude", "displayName": "Anthropic Claude", "priority": 29,
     "description": "Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku. Excellent for long-form writing, careful reasoning, and safety-aligned tasks.",
     "apiEndpoint": "https://api.anthropic.com/v1/messages", "apiKey": None,
     "models": ["claude-3-5-sonnet", "claude-3-opus", "claude-3-haiku"],
     "color": "#d97757", "icon": "claude"},
    {"name": "grok", "displayName": "xAI Grok", "priority": 30,
     "description": "Grok-2, Grok-2-mini. Real-time-aware assistant with a witty, irreverent voice. OpenAI-compatible API at api.x.ai.",
     "apiEndpoint": "https://api.x.ai/v1/chat/completions", "apiKey": None,
     "models": ["grok-2", "grok-2-mini", "grok-beta"],
     "color": "#1d9bf0", "icon": "sparkles"},
    {"name": "qvac", "displayName": "Qvac Quantum-Inspired", "priority": 31,
     "description": "Quantum-inspired parallel reasoning — explores multiple solution paths simultaneously and recommends the most defensible one.",
     "apiEndpoint": "https://api.qvac.ai/v1/chat/completions", "apiKey": None,
     "models": ["marq-qvac-default", "qvac-reason-v1", "qvac-decide-v1"],
     "color": "#8b5cf6", "icon": "atom"},
]

# Build the TypeScript block
lines = [
    "  const providers = [",
    "    // ── TIER 1 — Open-source / free providers (tried first in auto mode) ──",
    "    // These providers don't require per-token billing. marq_free is always",
    "    // available (Pollinations anonymous tier); the rest are open-source",
    "    // frameworks / packages / models that work without paid API keys.",
]
for p in PROVIDERS:
    models_json = json.dumps(p["models"])
    api_endpoint = "null" if p["apiEndpoint"] is None else json.dumps(p["apiEndpoint"])
    api_key = "null" if p["apiKey"] is None else json.dumps(p["apiKey"])
    desc = p["description"].replace("\n", " ")
    lines.append("    {")
    lines.append(f'      name: "{p["name"]}",')
    lines.append(f'      displayName: "{p["displayName"]}",')
    lines.append(f'      description: "{desc}",')
    lines.append(f'      apiEndpoint: {api_endpoint},')
    lines.append(f'      apiKey: {api_key},')
    lines.append(f'      models: JSON.stringify({models_json}),')
    lines.append(f'      active: true,')
    lines.append(f'      priority: {p["priority"]},')
    lines.append(f'      color: "{p["color"]}",')
    lines.append(f'      icon: "{p["icon"]}",')
    lines.append("    },")
lines.append("  ];")

block = "\n".join(lines)
print(block)
print(f"\n// ── {len(PROVIDERS)} providers total ──", flush=True)
