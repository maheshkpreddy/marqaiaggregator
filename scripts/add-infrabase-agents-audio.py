#!/usr/bin/env python3
"""
Append missing agent frameworks + audio AI tools from infrabase.ai to
src/lib/provider-benefits.ts.

Idempotent: skips any entry whose `name` key already exists in the file.
"""
from pathlib import Path
import re
import sys

FILE = Path("/home/z/my-project/src/lib/provider-benefits.ts")

ENTRIES = [
    # ─── AGENTS ───────────────────────────────────────────────────────────
    {
        "name": "openai-agents-sdk",
        "displayName": "OpenAI Agents SDK",
        "tagline": "OpenAI's official agent framework — Responses API, built-in tools, handoffs, guardrails.",
        "icon": "Bot",
        "color": "#10a37f",
        "category": "orchestration",
        "kind": "framework",
        "popularity": "very-high",
        "bestFor": [
            "Production agents on OpenAI's Responses API",
            "Handoffs between specialized agents",
            "Built-in tools: web search, file search, computer use",
            "Guardrails for input/output validation",
        ],
        "capabilities": [
            "Agent definitions with instructions + tools",
            "Handoffs: agents delegate to other agents",
            "Built-in tools: web_search, file_search, code_interpreter, computer_use",
            "Guardrails: input + output validators",
            "Tracing via OpenAI Trace UI",
        ],
        "whenToUse": [
            "Standardizing on OpenAI's agent pattern",
            "Want built-in computer use / web search without custom code",
        ],
        "limitations": [
            "OpenAI-only — no multi-provider support out of the box",
            "Newer framework — community still small",
        ],
        "samplePrompts": [
            "Build a triage agent that hands off to billing / support / sales agents.",
            "Use computer use to fill out a CRM form from a customer email.",
            "Add input guardrails to block PII before sending to the LLM.",
        ],
        "setupNotes": "pip install openai-agents or npm install @openai/agents. Set OPENAI_API_KEY. Define Agent(instructions, tools, handoffs) and run via Runner.",
        "pricingTier": "Free SDK. Usage billed at standard OpenAI API rates.",
        "docsUrl": "https://platform.openai.com/docs/guides/agents",
        "availableModels": ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
        "availableAgents": ["triage-agent", "support-agent", "research-agent"],
        "advantages": [
            "Official OpenAI framework — first-party support",
            "Built-in tools (web, file, code, computer) — no integrations",
            "Handoffs for multi-agent orchestration",
            "Tracing UI for debugging",
        ],
        "businessAdvantages": [
            "OpenAI-aligned roadmap = future-proof",
            "Built-in tools reduce infra complexity",
        ],
        "apiIntegrationDetails": "Python: from agents import Agent, Runner; Runner.run(agent, input). Uses OpenAI Responses API under the hood.",
        "modalities": ["chat", "agents", "tools", "code", "vision"],
    },
    {
        "name": "claude-agent-sdk",
        "displayName": "Claude Agent SDK",
        "tagline": "Anthropic's official agent SDK — Claude with built-in computer use, bash, file editor.",
        "icon": "Bot",
        "color": "#d97757",
        "category": "orchestration",
        "kind": "framework",
        "popularity": "high",
        "bestFor": [
            "Computer-use agents controlling desktop / browser",
            "Long-horizon coding tasks via bash + file editing",
            "Agents needing 200k+ context window",
            "Safety-first deployments with constitutional AI",
        ],
        "capabilities": [
            "Computer use tool: screenshots + mouse/keyboard",
            "Bash tool: shell command execution",
            "Text editor tool: file read/write/edit",
            "200k token context window",
            "Tool use + structured outputs",
        ],
        "whenToUse": [
            "Need Claude's computer-use capability",
            "Long-context agentic coding tasks",
        ],
        "limitations": [
            "Anthropic-only — no multi-provider",
            "Computer use is beta / can be slow",
        ],
        "samplePrompts": [
            "Use Claude to fill out a Salesforce opportunity from a customer email.",
            "Build a coding agent that edits a TypeScript repo via bash + file editor.",
            "Process 100k-token contracts to extract every revenue clause.",
        ],
        "setupNotes": "pip install anthropic. Set ANTHROPIC_API_KEY. Define tools (computer, bash, text_editor) and pass to messages.create with model='claude-3-5-sonnet-20241022'.",
        "pricingTier": "Free SDK. Claude 3.5 Sonnet: $3 / 1M input, $15 / 1M output. Computer use billed per tool call.",
        "docsUrl": "https://docs.anthropic.com/en/docs/agents-and-tools/agent-sdk",
        "availableModels": ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
        "availableAgents": ["coding-agent", "desktop-agent", "long-doc-analyzer"],
        "advantages": [
            "Official Anthropic SDK — first-party",
            "Computer use = desktop automation without RPA",
            "200k context = whole-codebase or whole-contract reasoning",
            "Constitutional AI for safer outputs",
        ],
        "businessAdvantages": [
            "Desktop automation replaces brittle RPA",
            "Long context reduces chunking infra",
        ],
        "apiIntegrationDetails": "Python: import anthropic; client.messages.create(model, messages, tools). Tool results returned in stop_reason='tool_use'.",
        "modalities": ["chat", "code", "agents", "tools", "vision"],
    },
    {
        "name": "letta",
        "displayName": "Letta (MemGPT)",
        "tagline": "Stateful agent framework with persistent memory — agents that remember across sessions.",
        "icon": "Brain",
        "color": "#7c3aed",
        "category": "orchestration",
        "kind": "framework",
        "popularity": "high",
        "bestFor": [
            "Long-running personal AI assistants",
            "Agents that need persistent memory across sessions",
            "Memory-heavy workflows (customer relationships, project history)",
            "Multi-agent systems with shared memory",
        ],
        "capabilities": [
            "Persistent memory blocks (core / archival / recall)",
            "Memory management: agents decide what to remember",
            "Multi-agent shared memory via shared blocks",
            "OpenAI-compatible API",
            "Stateless and stateful agent modes",
        ],
        "whenToUse": [
            "Agent needs to remember user context across days/weeks",
            "Building a personalized AI assistant",
        ],
        "limitations": [
            "Memory operations add latency per turn",
            "Premium pricing for hosted Letta Cloud",
        ],
        "samplePrompts": [
            "Build a personal assistant that remembers my preferences across sessions.",
            "Customer success agent that remembers 6 months of interactions per account.",
            "Multi-agent research team with shared project memory.",
        ],
        "setupNotes": "pip install letta or docker run letta/letta. Set OPENAI_API_KEY. Create agents via /v1/agents endpoint with memory blocks.",
        "pricingTier": "Open-source (Apache 2.0). Letta Cloud: from $0.20 / agent-hour.",
        "docsUrl": "https://docs.letta.com",
        "availableModels": ["(any OpenAI-compatible model)"],
        "availableAgents": ["personal-assistant", "cs-agent", "research-agent"],
        "advantages": [
            "First-class persistent memory — agents that actually remember",
            "Memory blocks = explainable memory (not hidden context)",
            "Multi-agent shared memory",
            "OpenAI-compatible API",
        ],
        "businessAdvantages": [
            "Persistent memory = differentiated UX",
            "Personalization without rebuilding infra",
        ],
        "apiIntegrationDetails": "REST API at http://localhost:8283/v1. POST /agents to create with memory blocks, POST /agents/<id>/messages to chat. OpenAI-compatible.",
        "modalities": ["chat", "agents", "tools"],
    },
    {
        "name": "smolagents",
        "displayName": "smolagents (HuggingFace)",
        "tagline": "Minimal Python-native agent framework — code-acting agents, <1000 LOC core.",
        "icon": "Code2",
        "color": "#ff9d00",
        "category": "orchestration",
        "kind": "framework",
        "popularity": "medium",
        "bestFor": [
            "Code-first agents (LLM writes Python to call tools)",
            "Lightweight alternative to LangGraph / CrewAI",
            "HuggingFace ecosystem integration (Inference Providers, Hub)",
            "Research / experimentation",
        ],
        "capabilities": [
            "CodeAgent: LLM writes Python code to use tools",
            "ToolCallAgent: traditional JSON tool calling",
            "HuggingFace Hub integration for models",
            "Multi-step reasoning with manageable state",
            "Python execution sandboxed",
        ],
        "whenToUse": [
            "Want minimal abstractions — code-as-actions",
            "Already using HuggingFace models / Hub",
        ],
        "limitations": [
            "Smaller community than LangChain",
            "Less production tooling / observability",
        ],
        "samplePrompts": [
            "Build a code-acting agent that solves math problems by writing Python.",
            "Web research agent using smolagents + DuckDuckGo tool.",
            "Multi-step RAG agent with smolagents + HuggingFace embeddings.",
        ],
        "setupNotes": "pip install smolagents. Set HF_TOKEN. Define Agent with model + tools, run via agent.run(prompt).",
        "pricingTier": "Free / open-source (Apache 2.0). Uses HuggingFace Inference Providers for model calls.",
        "docsUrl": "https://huggingface.co/docs/smolagents",
        "availableModels": ["(any HF Inference Provider model)", "Qwen/Qwen2.5-Coder-32B-Instruct"],
        "availableAgents": ["code-agent", "research-agent", "math-solver"],
        "advantages": [
            "Minimal — <1000 LOC core, easy to understand",
            "Code-as-actions: LLM writes Python, not JSON tool calls",
            "Tight HF Hub integration",
            "Python-sandboxed execution",
        ],
        "businessAdvantages": [
            "Code-acting agents handle complex multi-step tasks better",
            "Minimal framework = less to maintain",
        ],
        "apiIntegrationDetails": "Python: from smolagents import CodeAgent, HfApiModel; agent = CodeAgent(tools=[], model=HfApiModel()); agent.run(prompt).",
        "modalities": ["chat", "code", "agents", "tools"],
    },
    {
        "name": "agentops",
        "displayName": "AgentOps",
        "tagline": "Observability + evaluation for AI agents — trace, replay, and score agent runs.",
        "icon": "Activity",
        "color": "#0ea5e9",
        "category": "orchestration",
        "kind": "framework",
        "popularity": "high",
        "bestFor": [
            "Debugging multi-step agent runs in production",
            "Replaying failed agent sessions",
            "Evaluating agent performance over time",
            "Cost tracking per agent run",
        ],
        "capabilities": [
            "Auto-trace agent steps (LLM calls, tool calls, decisions)",
            "Session replay for debugging",
            "Eval suites for regression testing",
            "Cost + latency analytics per agent",
            "Integrations: OpenAI, LangChain, CrewAI, AutoGen",
        ],
        "whenToUse": [
            "Need observability for complex agent workflows",
            "Want eval suites to catch regressions",
        ],
        "limitations": [
            "Adds overhead per agent call (~5-10ms)",
            "Premium features in paid tier",
        ],
        "samplePrompts": [
            "Trace a 20-step CrewAI run and identify the slowest tool call.",
            "Set up an eval suite for a customer-support agent.",
            "Track cost-per-resolution across 1000 agent runs.",
        ],
        "setupNotes": "pip install agentops. Call agentops.init(<api-key>) before agent runs. Auto-instruments OpenAI, LangChain, CrewAI, AutoGen, etc.",
        "pricingTier": "Free dev tier. Paid from $99/mo for team features + 50k events.",
        "docsUrl": "https://docs.agentops.ai",
        "availableModels": ["(any — AgentOps is observability, not a model)"],
        "availableAgents": ["observability-layer", "eval-runner"],
        "advantages": [
            "Auto-instruments major agent frameworks — zero code changes",
            "Session replay is gold for debugging",
            "Cost tracking per agent run",
            "Eval suites for regression testing",
        ],
        "businessAdvantages": [
            "Production observability reduces agent bugs",
            "Cost analytics enable per-agent profitability tracking",
        ],
        "apiIntegrationDetails": "pip install agentops; agentops.init('<key>'); agentops.start_session(); ... agentops.end_session(). Or use decorator pattern.",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "composio",
        "displayName": "Composio",
        "tagline": "10,000+ pre-built tools for AI agents — Slack, Gmail, GitHub, Notion, Jira, and more.",
        "icon": "Wrench",
        "color": "#7c3aed",
        "category": "orchestration",
        "kind": "framework",
        "popularity": "high",
        "bestFor": [
            "Agents that need to interact with SaaS apps (Slack, Gmail, GitHub)",
            "Rapid agent prototyping with pre-built tools",
            "OAuth managed for you — no API key juggling",
            "Replace custom integrations with one library",
        ],
        "capabilities": [
            "10,000+ tools across 250+ apps",
            "Managed OAuth — Composio handles auth flows",
            "Triggered actions (webhooks) and scheduled actions",
            "Works with LangChain, CrewAI, AutoGen, OpenAI Agents SDK",
            "RAG over user data from connected apps",
        ],
        "whenToUse": [
            "Need agent tools for SaaS apps without writing integrations",
            "Don't want to manage OAuth for 20+ services",
        ],
        "limitations": [
            "Adds an external dependency (Composio servers)",
            "Premium pricing for high-volume usage",
        ],
        "samplePrompts": [
            "Build an agent that reads Gmail, drafts replies, and sends via Slack.",
            "GitHub agent that auto-creates issues from customer emails.",
            "Notion agent that summarizes the team's daily standup notes.",
        ],
        "setupNotes": "pip install composio-core. composio login. composio add slack,gmail,github. Then use ComposioToolkit in LangChain / CrewAI / etc.",
        "pricingTier": "Free dev tier. Pro from $49/mo for production usage + 10k tool calls.",
        "docsUrl": "https://docs.composio.dev",
        "availableModels": ["(any — Compsio provides tools, not models)"],
        "availableAgents": ["saas-agent", "ops-agent", "crm-agent"],
        "advantages": [
            "10,000+ pre-built tools save weeks of integration work",
            "Managed OAuth = no token management",
            "Framework-agnostic (LangChain / CrewAI / AutoGen / OpenAI SDK)",
            "Triggered actions enable event-driven agents",
        ],
        "businessAdvantages": [
            "Faster agent shipping — skip integration work",
            "Managed OAuth reduces security review scope",
        ],
        "apiIntegrationDetails": "Python: from composio_langchain import ComposioToolkit; toolkit = ComposioToolkit(); tools = toolkit.get_tools(apps=[App.SLACK]).",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "browserbase",
        "displayName": "Browserbase",
        "tagline": "Headless browser cloud for AI agents — stealth mode, CAPTCHA solving, session debugging.",
        "icon": "Globe",
        "color": "#0f766e",
        "category": "orchestration",
        "kind": "framework",
        "popularity": "high",
        "bestFor": [
            "Agents that need reliable web automation",
            "Bypassing CAPTCHAs / anti-bot at scale",
            "Session debugging — see exactly what the agent saw",
            "Stealth mode for scraping protected sites",
        ],
        "capabilities": [
            "Cloud-hosted headless browsers with stealth mode",
            "CAPTCHA solving integrated",
            "Residential proxy rotation",
            "Session recording + replay for debugging",
            "Works with Playwright, Puppeteer, Selenium, Stagehand",
        ],
        "whenToUse": [
            "Browser automation keeps getting blocked",
            "Need to see what the agent did for debugging",
        ],
        "limitations": [
            "Per-session pricing — expensive for high-volume scraping",
            "Cold start on new sessions (~1-2s)",
        ],
        "samplePrompts": [
            "Agent that scrapes competitor pricing pages weekly without getting blocked.",
            "Form-filling agent that submits 100 applications across job boards.",
            "Login + screenshot agent for QA testing across 50 sites.",
        ],
        "setupNotes": "Sign up at browserbase.com, create a key. Connect via Playwright: const browser = await chromium.connectOverCDP('https://connect.browserbase.com?token=<key>').",
        "pricingTier": "Free tier: 100 sessions/mo. Pro from $49/mo for 1k sessions + advanced features.",
        "docsUrl": "https://docs.browserbase.com",
        "availableModels": ["(any — Browserbase provides browser infra, not models)"],
        "availableAgents": ["browser-agent", "scraper", "qa-agent"],
        "advantages": [
            "Stealth mode bypasses most anti-bot",
            "CAPTCHA solving handled",
            "Session recording = great debugging UX",
            "Works with existing Playwright / Puppeteer code",
        ],
        "businessAdvantages": [
            "Web automation unblocks many agent use cases",
            "Debuggable sessions reduce maintenance cost",
        ],
        "apiIntegrationDetails": "Playwright: chromium.connectOverCDP('https://connect.browserbase.com?token=<key>'). Stagehand integration available.",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "e2b",
        "displayName": "E2B",
        "tagline": "Secure sandboxes for AI agents — run LLM-generated code safely with file system + internet.",
        "icon": "Shield",
        "color": "#0ea5e9",
        "category": "orchestration",
        "kind": "framework",
        "popularity": "high",
        "bestFor": [
            "Agents that write + execute code (code-interpreter pattern)",
            "Data analysis agents needing Python + pandas + matplotlib",
            "Multi-file code projects in isolated sandboxes",
            "Replacing OpenAI Code Interpreter with own infra",
        ],
        "capabilities": [
            "Secure cloud sandboxes with Python / Node / Bash",
            "File system + internet access (configurable)",
            "Pre-installed: pandas, numpy, matplotlib, scikit-learn",
            "Custom templates — install your own deps",
            "Long-running (hours) + streaming output",
        ],
        "whenToUse": [
            "Need code execution more flexible than OpenAI Code Interpreter",
            "Agents that analyze data with pandas / matplotlib",
        ],
        "limitations": [
            "Per-second pricing — expensive for always-on sandboxes",
            "Cold start on new sandboxes (~1-2s)",
        ],
        "samplePrompts": [
            "Data analyst agent: upload CSV → E2B sandbox → pandas analysis → chart.",
            "Code-writing agent: build + test Python files in E2B sandbox.",
            "ML agent: train sklearn model in E2B, return predictions.",
        ],
        "setupNotes": "pip install e2b-code-interpreter. Set E2B_API_KEY. Create sandbox: from e2b_code_interpreter import Sandbox; sbx = Sandbox(); sbx.run_code('print(1+1)').",
        "pricingTier": "Free dev tier: 100 sandboxes / mo. Pro from $29/mo for 1k sandboxes.",
        "docsUrl": "https://e2b.dev/docs",
        "availableModels": ["(any — E2B provides sandbox, not models)"],
        "availableAgents": ["data-analyst", "code-interpreter", "ml-trainer"],
        "advantages": [
            "Secure sandboxing = safe code execution",
            "Pre-installed scientific Python stack",
            "Streaming output for long-running cells",
            "OpenAI Code Interpreter replacement with more flexibility",
        ],
        "businessAdvantages": [
            "Code-interpreter feature without OpenAI lock-in",
            "Data analysis agents unlock enterprise workflows",
        ],
        "apiIntegrationDetails": "Python: from e2b_code_interpreter import Sandbox; sbx = Sandbox(); result = sbx.run_code('print(1+1)'); print(result.text).",
        "modalities": ["agents", "tools", "code"],
    },
    {
        "name": "n8n",
        "displayName": "n8n",
        "tagline": "Open-source workflow automation with 400+ integrations + AI agent nodes — Zapier alternative.",
        "icon": "Workflow",
        "color": "#ea4b71",
        "category": "orchestration",
        "kind": "framework",
        "popularity": "very-high",
        "bestFor": [
            "Visual workflow automation with AI agent nodes",
            "Connecting 400+ apps without code",
            "Self-hosted automation = data stays in your network",
            "Replacing Zapier / Make for cost savings",
        ],
        "capabilities": [
            "400+ pre-built integrations",
            "AI Agent nodes (LangChain-compatible)",
            "Trigger workflows via webhooks / schedules / app events",
            "Visual editor — no code required",
            "Self-hosted or managed cloud",
        ],
        "whenToUse": [
            "Need automation but your team isn't developer-heavy",
            "Want to integrate AI agents into existing workflows",
        ],
        "limitations": [
            "Visual workflows hit complexity limits vs code",
            "Self-hosted requires maintenance",
        ],
        "samplePrompts": [
            "Customer email → AI classifies → routes to Slack channel + creates Linear ticket.",
            "Daily AI digest of competitor news → email summary.",
            "GitHub PR opened → AI review → comment + label.",
        ],
        "setupNotes": "Self-host: docker run -p 5678:5678 n8nio/n8n. Cloud: sign up at n8n.io. Build workflows in visual editor. AI Agent nodes available in 1.0+.",
        "pricingTier": "Self-hosted: free / open source. Cloud: from $20/mo (Starter) to $50+/mo (Pro).",
        "docsUrl": "https://docs.n8n.io",
        "availableModels": ["(any — n8n calls LLMs via API)"],
        "availableAgents": ["workflow-agent", "automation-agent"],
        "advantages": [
            "Open-source — self-host for full data control",
            "Visual editor — no code for ops teams",
            "400+ integrations including all major AI providers",
            "AI Agent nodes for agentic workflows",
        ],
        "businessAdvantages": [
            "Replace Zapier / Make for 90% cost savings",
            "Self-hosted for regulated industries",
        ],
        "apiIntegrationDetails": "Visual editor primary. REST API at http://your-n8n:5678/api/v1 with 'X-N8N-API-KEY: <key>' for programmatic workflow management.",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "rasa",
        "displayName": "Rasa",
        "tagline": "Open-source conversational AI framework — intent classification, entity extraction, dialogue management.",
        "icon": "MessageSquare",
        "color": "#5d2eba",
        "category": "orchestration",
        "kind": "framework",
        "popularity": "medium",
        "bestFor": [
            "Enterprise chatbots with strict dialogue flows",
            "On-prem conversational AI (banking, healthcare, gov)",
            "Custom intent + entity models",
            "Hybrid rules + ML dialogue management",
        ],
        "capabilities": [
            "NLU: intent classification + entity extraction",
            "Dialogue management via policies (rules + ML)",
            "Custom actions via Python / Node",
            "Rasa X / Rasa Pro for conversation review",
            "Connects to any channel (Slack, web, WhatsApp)",
        ],
        "whenToUse": [
            "Need strict dialogue flows (not free-form LLM chat)",
            "On-prem / air-gapped chatbot deployment",
        ],
        "limitations": [
            "Training data required — not zero-shot",
            "Steeper learning curve than LLM-only chatbots",
        ],
        "samplePrompts": [
            "Build a banking IVR chatbot that handles 50 intents with strict flows.",
            "Healthcare triage bot with HIPAA-compliant on-prem Rasa.",
            "Customer support bot that escalates to humans when confidence < 0.7.",
        ],
        "setupNotes": "pip install rasa. rasa init — creates a starter project. Train with rasa train. Run with rasa shell or rasa run --enable-api.",
        "pricingTier": "Open-source (Apache 2.0). Rasa Pro from $1,500/mo for enterprise features.",
        "docsUrl": "https://rasa.com/docs/rasa",
        "availableModels": ["(Rasa uses its own NLU; can call LLMs via custom actions)"],
        "availableAgents": ["enterprise-chatbot", "ivr-bot", "triage-bot"],
        "advantages": [
            "Open-source + on-prem — full control",
            "Strict dialogue flows for compliance-heavy use cases",
            "Custom NLU models — not LLM-dependent",
            "Channel-agnostic",
        ],
        "businessAdvantages": [
            "On-prem chatbot for regulated industries",
            "Strict flows reduce hallucination risk",
        ],
        "apiIntegrationDetails": "REST API at http://localhost:5005/webhooks/rest/webhook with { sender, message }. Custom actions via /webhooks/custom.",
        "modalities": ["chat", "agents", "tools"],
    },
    # ─── AUDIO ────────────────────────────────────────────────────────────
    {
        "name": "elevenlabs",
        "displayName": "ElevenLabs",
        "tagline": "Industry-leading TTS + voice cloning — 300+ voices in 30+ languages, instant voice cloning.",
        "icon": "Mic",
        "color": "#000000",
        "category": "specialized",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "TTS for voice agents, audiobooks, IVR",
            "Instant voice cloning from 1-minute sample",
            "Multilingual TTS (30+ languages with native quality)",
            "Real-time conversational latency (<400ms)",
        ],
        "capabilities": [
            "300+ pre-built voices, multilingual (30+ languages)",
            "Voice cloning: instant (1 min sample) or professional (10 min)",
            "Real-time streaming TTS via websockets",
            "Sound effects generation (text-to-SFX)",
            "Dubbing: translate + re-voice videos in 30+ languages",
        ],
        "whenToUse": [
            "Need best-in-class TTS quality",
            "Voice cloning for branded AI voices",
            "Multilingual content localization",
        ],
        "limitations": [
            "Premium pricing — most expensive TTS provider",
            "Voice cloning has ethical / consent implications",
        ],
        "samplePrompts": [
            "Generate a 5-minute customer-service IVR script in 5 languages with the same voice.",
            "Clone our CEO's voice for internal communications.",
            "Real-time voice agent with <400ms end-to-end TTS latency.",
        ],
        "setupNotes": "Sign up at elevenlabs.io, create a key under Profile. Endpoint: POST https://api.elevenlabs.io/v1/text-to-speech/<voice-id> with 'xi-api-key: <key>'.",
        "pricingTier": "Free: 10k chars/mo. Starter: $5/mo for 30k chars. Pro from $99/mo for 500k chars.",
        "docsUrl": "https://elevenlabs.io/docs",
        "availableModels": [
            "eleven_turbo_v2_5", "eleven_multilingual_v2",
            "eleven_monolingual_v1", "eleven_v3",
        ],
        "availableAgents": ["voice-agent", "audiobook-narrator", "ivr-bot"],
        "advantages": [
            "Best-in-class TTS quality — most natural-sounding",
            "Instant voice cloning (1-min sample)",
            "Real-time streaming for voice agents",
            "Multilingual with native-quality voices",
        ],
        "businessAdvantages": [
            "Voice agent UX depends on TTS quality — ElevenLabs is the gold standard",
            "Voice cloning enables branded AI voices",
        ],
        "apiIntegrationDetails": "POST https://api.elevenlabs.io/v1/text-to-speech/<voice-id> { text, model_id } with 'xi-api-key: <key>'. Returns audio/mpeg stream.",
        "modalities": ["voice"],
    },
    {
        "name": "assemblyai",
        "displayName": "AssemblyAI",
        "tagline": "Best-in-class speech-to-text — speaker diarization, sentiment, chapters, PII redaction.",
        "icon": "AudioWaveform",
        "color": "#16a34a",
        "category": "specialized",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Call center transcription with speaker diarization",
            "Podcast / video transcription with chapters + sentiment",
            "PII redaction for compliance (HIPAA, GDPR)",
            "Real-time streaming STT for voice agents",
        ],
        "capabilities": [
            "Best-in-class WER on noisy audio",
            "Speaker diarization (identify who spoke when)",
            "Auto chapters, sentiment, summaries",
            "PII redaction (names, SSNs, credit cards)",
            "Real-time streaming via websockets",
        ],
        "whenToUse": [
            "Need highest-accuracy STT on noisy real-world audio",
            "Speaker diarization for calls / meetings",
        ],
        "limitations": [
            "Premium pricing — more expensive than Deepgram",
            "Real-time stream pricing adds up",
        ],
        "samplePrompts": [
            "Transcribe 1000 call-center recordings with speaker labels + sentiment.",
            "Real-time voice-agent STT with <300ms latency.",
            "Auto-generate podcast chapters + summaries for 100 episodes.",
        ],
        "setupNotes": "Sign up at assemblyai.com, create a key under Dashboard. Upload audio + POST https://api.assemblyai.com/v2/transcript with 'authorization: <key>'.",
        "pricingTier": "Free: 5 hours free. Pay-as-you-go: $0.12/hr for standard, $0.37/hr for streaming. Enterprise from $0.07/hr.",
        "docsUrl": "https://www.assemblyai.com/docs",
        "availableModels": ["best", "nano", "slam-1"],
        "availableAgents": ["transcriber", "call-analyzer", "podcast-summarizer"],
        "advantages": [
            "Best-in-class accuracy on noisy real-world audio",
            "Speaker diarization is best-in-market",
            "PII redaction built-in (compliance)",
            "Real-time streaming for voice agents",
        ],
        "businessAdvantages": [
            "Call center analytics = actionable insight from voice data",
            "Compliance-ready PII redaction",
        ],
        "apiIntegrationDetails": "POST https://api.assemblyai.com/v2/transcript { audio_url, speaker_labels: true } with 'authorization: <key>'. Poll for completion.",
        "modalities": ["voice"],
    },
    {
        "name": "deepgram",
        "displayName": "Deepgram",
        "tagline": "Fastest STT API — 300ms latency streaming, 1/3 the price of competitors for high-volume.",
        "icon": "AudioWaveform",
        "color": "#13a86b",
        "category": "specialized",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Real-time STT for voice agents (<300ms latency)",
            "High-volume call transcription at lowest cost",
            "Streaming live captions for events / broadcasts",
            "Medical / legal transcription with domain models",
        ],
        "capabilities": [
            "Streaming STT: <300ms latency",
            "Batch transcription: 1000s of hours in minutes",
            "Domain models: Nova-2 Phone, Nova-2 Medical, Nova-2 Voicemail",
            "Speaker diarization + word-level timestamps",
            "Sentiment + intent recognition",
        ],
        "whenToUse": [
            "Latency is critical — voice agents, live captions",
            "High-volume call center — lowest cost per hour",
        ],
        "limitations": [
            "Lower accuracy than AssemblyAI on noisy audio",
            "Fewer post-processing features (no chapters)",
        ],
        "samplePrompts": [
            "Real-time voice agent with <300ms STT latency.",
            "Transcribe 10k hours of calls monthly at $0.0043/min.",
            "Live caption a 4-hour conference broadcast.",
        ],
        "setupNotes": "Sign up at deepgram.com, create a key under API Keys. WebSocket: wss://api.deepgram.com/v1/listen?model=nova-2 with 'Authorization: Token <key>'.",
        "pricingTier": "Pay-as-you-go: $0.0043/min (batch), $0.0115/min (streaming). Enterprise from $0.0029/min.",
        "docsUrl": "https://developers.deepgram.com/docs",
        "availableModels": ["nova-2", "nova-2-phone", "nova-2-medical", "nova-2-meeting", "nova-2-conversationalai"],
        "availableAgents": ["voice-agent", "transcriber", "captioner"],
        "advantages": [
            "Lowest latency STT (300ms streaming)",
            "Lowest cost per hour at scale",
            "Domain models (medical, phone, meeting) improve accuracy",
            "Streaming first-class",
        ],
        "businessAdvantages": [
            "Voice agent UX depends on STT latency — Deepgram is fastest",
            "Lowest cost = highest margin on transcription SaaS",
        ],
        "apiIntegrationDetails": "WebSocket: wss://api.deepgram.com/v1/listen?model=nova-2 with 'Authorization: Token <key>'. Send raw audio bytes; receive JSON transcriptions.",
        "modalities": ["voice"],
    },
    {
        "name": "cartesia",
        "displayName": "Cartesia",
        "tagline": "Sub-100ms TTS for voice agents — Sonic model is the lowest-latency TTS on market.",
        "icon": "Volume2",
        "color": "#7c3aed",
        "category": "specialized",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Real-time voice agents needing <100ms TTS",
            "Conversational AI where latency = product quality",
            "Multilingual TTS with instant voice cloning",
            "Streaming TTS via websockets",
        ],
        "capabilities": [
            "Sonic model: <100ms TTFC (time-to-first-chunk)",
            "Streaming via websockets",
            "Instant voice cloning (3-second sample)",
            "Multilingual: 30+ languages",
            "Emotion control (happy, sad, angry, etc.)",
        ],
        "whenToUse": [
            "Voice agent latency is the bottleneck",
            "Need emotional / expressive TTS",
        ],
        "limitations": [
            "Newer provider — fewer voices than ElevenLabs",
            "Less polish for non-conversational use cases (audiobooks)",
        ],
        "samplePrompts": [
            "Voice agent loop with 100ms STT + 80ms LLM + 100ms TTS = 280ms total.",
            "Expressive storytelling TTS with emotion control.",
            "Multilingual voice agent switching between English and Spanish mid-conversation.",
        ],
        "setupNotes": "Sign up at cartesia.ai, create a key. WebSocket: wss://api.cartesia.ai/tts/websocket with 'Authorization: Bearer <key>'.",
        "pricingTier": "Free: 10k chars/mo. Pro from $19/mo for 200k chars. Enterprise from $0.05 / 1k chars.",
        "docsUrl": "https://docs.cartesia.ai",
        "availableModels": ["sonic", "sonic-2", "nova-tts"],
        "availableAgents": ["voice-agent", "conversational-ai"],
        "advantages": [
            "Lowest TTS latency on market (<100ms)",
            "Instant voice cloning",
            "Emotion control = more natural voice agents",
            "Streaming websockets",
        ],
        "businessAdvantages": [
            "Latency edge = differentiated voice agent UX",
            "Emotion control enables novel use cases (gaming, entertainment)",
        ],
        "apiIntegrationDetails": "WebSocket: wss://api.cartesia.ai/tts/websocket. Send { transcript, voice_id, model_id }, receive audio chunks.",
        "modalities": ["voice"],
    },
    {
        "name": "playht",
        "displayName": "PlayHT",
        "tagline": "TTS + voice cloning — 800+ voices, 142 languages, real-time streaming.",
        "icon": "Mic",
        "color": "#0f172a",
        "category": "specialized",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Large voice library (800+ voices)",
            "Multilingual TTS in 142 languages",
            "Voice cloning with emotional control",
            "Real-time streaming via websockets",
        ],
        "capabilities": [
            "800+ voices in 142 languages",
            "Voice cloning: instant + professional",
            "Real-time streaming TTS",
            "Emotional voice control",
            "Pronunciation library for custom words",
        ],
        "whenToUse": [
            "Need widest voice / language selection",
            "Voice cloning with emotion control",
        ],
        "limitations": [
            "Quality slightly below ElevenLabs",
            "Streaming latency slightly above Cartesia",
        ],
        "samplePrompts": [
            "Audiobook narration in 142 languages with consistent voice cloning.",
            "Real-time voice agent with PlayHT streaming TTS.",
            "Multi-character podcast with 5 distinct cloned voices.",
        ],
        "setupNotes": "Sign up at play.ht, create a key under API Access. Endpoint: POST https://api.play.ht/api/v2/tts with 'Authorization: Bearer <key>' + 'X-User-Id: <uid>'.",
        "pricingTier": "Free: 12.5k chars. Creator: $31/mo for 1M chars. Pro from $99/mo for 5M chars.",
        "docsUrl": "https://docs.play.ht",
        "availableModels": ["play-3.0-mini", "play-3.0", "play-2.0", "playht2.0"],
        "availableAgents": ["voice-agent", "audiobook-narrator", "podcast-host"],
        "advantages": [
            "Widest voice library (800+)",
            "142 languages — broadest coverage",
            "Real-time streaming + voice cloning",
            "Pronunciation library for brand names",
        ],
        "businessAdvantages": [
            "Localization at scale (142 languages)",
            "Brand consistency with cloned voices",
        ],
        "apiIntegrationDetails": "POST https://api.play.ht/api/v2/tts { text, voice, output_format } with 'Authorization: Bearer <key>' + 'X-User-Id'.",
        "modalities": ["voice"],
    },
    {
        "name": "suno",
        "displayName": "Suno",
        "tagline": "AI music generation — full songs with vocals, lyrics, and instrumentation from text prompts.",
        "icon": "Music",
        "color": "#f97316",
        "category": "specialized",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Generating full songs (vocals + instrumentation) from prompts",
            "Background music for videos / podcasts",
            "Jingles + ad music at low cost",
            "Music for non-musicians (no DAW skills needed)",
        ],
        "capabilities": [
            "Full song generation (vocals + instruments)",
            "Custom lyrics or auto-generated",
            "Genre + style control (pop, rock, jazz, classical, EDM)",
            "30s / 2-min / 4-min durations",
            "API for production music pipelines",
        ],
        "whenToUse": [
            "Need royalty-free music for content",
            "Custom songs for marketing / brand",
        ],
        "limitations": [
            "Generated music can be uncanny on close listening",
            "Copyright concerns for music resembling existing artists",
        ],
        "samplePrompts": [
            "Generate a 30-second upbeat pop jingle for a coffee brand launch.",
            "Create a 4-minute epic orchestral track for a game trailer.",
            "Generate background music for a 10-min YouTube video.",
        ],
        "setupNotes": "Sign up at suno.com (or use API via sunoapi.com / third-party). API endpoint: POST https://studio-api.suno.ai/api/generate/v2/ with lyrics, style, title.",
        "pricingTier": "Pro: $10/mo for 500 songs. Premier: $30/mo for 2000 songs. API: contact sales.",
        "docsUrl": "https://suno.com/help",
        "availableModels": ["suno-v3.5", "suno-v4", "chirp-v3"],
        "availableAgents": ["music-gen", "jingle-maker", "soundtrack-gen"],
        "advantages": [
            "Best-in-class full-song generation (vocals + instruments)",
            "Genre + style control",
            "Custom lyrics supported",
            "30-second songs in seconds",
        ],
        "businessAdvantages": [
            "Royalty-free music for marketing content",
            "Custom songs at 1/100th studio cost",
        ],
        "apiIntegrationDetails": "POST https://studio-api.suno.ai/api/generate/v2/ { lyrics, style, title, duration }. Poll for completion; returns MP3 URLs.",
        "modalities": ["music"],
    },
    {
        "name": "hume-ai",
        "displayName": "Hume AI",
        "tagline": "Empathic voice AI — EVI model detects + responds to emotion in real-time.",
        "icon": "Mic",
        "color": "#7c3aed",
        "category": "specialized",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Empathic voice agents that respond to user emotion",
            "Mental health / wellness chatbots",
            "Customer support with emotional intelligence",
            "Research on emotional AI",
        ],
        "capabilities": [
            "Empathic Voice Interface (EVI): emotion-aware voice chat",
            "Real-time emotion detection from voice",
            "Prosody-aware responses (matches user's emotional tone)",
            "Voice cloning + custom voices",
            "Integrates with any LLM (OpenAI, Anthropic, etc.)",
        ],
        "whenToUse": [
            "Emotion-aware voice agent is the product",
            "Mental health / coaching / wellness use cases",
        ],
        "limitations": [
            "Niche — most voice agents don't need emotion detection",
            "Premium pricing",
        ],
        "samplePrompts": [
            "Mental health companion that detects sadness and responds with empathy.",
            "Customer support agent that escalates frustrated callers to humans.",
            "Language-learning tutor that adapts to user's emotional state.",
        ],
        "setupNotes": "Sign up at hume.ai, create a key. WebSocket: wss://api.hume.ai/v0/evi/chat with 'X-Hume-Api-Key: <key>'.",
        "pricingTier": "Free: 1k min/mo. Pro from $0.10/min for voice + emotion.",
        "docsUrl": "https://docs.hume.ai",
        "availableModels": ["evi-2", "nev-1"],
        "availableAgents": ["empathic-voice-agent", "wellness-companion"],
        "advantages": [
            "First-of-its-kind emotion-aware voice AI",
            "Real-time prosody detection",
            "Integrates with any LLM backend",
            "Voice + emotion in one API",
        ],
        "businessAdvantages": [
            "Emotion detection unlocks wellness / mental health use cases",
            "Differentiated UX vs traditional voice agents",
        ],
        "apiIntegrationDetails": "WebSocket: wss://api.hume.ai/v0/evi/chat. Send audio, receive transcriptions + emotion + response audio.",
        "modalities": ["voice", "agents"],
    },
    {
        "name": "resemble-ai",
        "displayName": "Resemble AI",
        "tagline": "Enterprise voice cloning + TTS — speech-to-speech, localization, real-time voice conversion.",
        "icon": "Mic",
        "color": "#f59e0b",
        "category": "specialized",
        "kind": "service",
        "popularity": "medium",
        "bestFor": [
            "Enterprise voice cloning with consent management",
            "Speech-to-speech voice conversion (real-time)",
            "Video / game localization in 60+ languages",
            "Custom neural voices for brands",
        ],
        "capabilities": [
            "Neural voice cloning (3-minute sample)",
            "Speech-to-speech: convert voice while preserving prosody",
            "Real-time voice conversion (<200ms)",
            "60+ language localization",
            "Watermarking + consent management built-in",
        ],
        "whenToUse": [
            "Enterprise-grade voice cloning with audit trail",
            "Speech-to-speech for gaming / film dubbing",
        ],
        "limitations": [
            "Premium pricing for enterprise features",
            "Smaller voice library than ElevenLabs",
        ],
        "samplePrompts": [
            "Clone a brand voice for IVR in 5 languages.",
            "Real-time voice conversion for gaming chat.",
            "Dub a 30-min video into 10 languages preserving original voice.",
        ],
        "setupNotes": "Sign up at resemble.ai, create a key under API. Endpoint: POST https://app.resemble.ai/api/v2/clips with 'Authorization: Token <key>'.",
        "pricingTier": "Free: 1k chars. Basic: $24/mo for 50k chars. Pro from $99/mo for 250k chars + cloning.",
        "docsUrl": "https://docs.resemble.ai",
        "availableModels": ["resemble-v2", "resemble-v3", "neural-tts"],
        "availableAgents": ["voice-cloner", "dubbing-agent", "ivr-bot"],
        "advantages": [
            "Speech-to-speech preserves prosody — best for dubbing",
            "Real-time voice conversion for live use cases",
            "Watermarking + consent = enterprise-ready",
            "60+ language localization",
        ],
        "businessAdvantages": [
            "Localization at scale (60+ languages)",
            "Speech-to-speech for film / game dubbing",
        ],
        "apiIntegrationDetails": "POST https://app.resemble.ai/api/v2/clips { voice_uuid, data } with 'Authorization: Token <key>'. Returns audio URL.",
        "modalities": ["voice"],
    },
    {
        "name": "lmnt",
        "displayName": "LMNT",
        "tagline": "Real-time conversational TTS — 200ms TTFC, instant voice cloning, 8 default voices.",
        "icon": "Volume2",
        "color": "#0ea5e9",
        "category": "specialized",
        "kind": "service",
        "popularity": "medium",
        "bestFor": [
            "Real-time voice agents needing low-latency TTS",
            "Instant voice cloning (10-second sample)",
            "Conversational AI where latency is critical",
            "Multilingual TTS in 7+ languages",
        ],
        "capabilities": [
            "200ms TTFC (time-to-first-chunk) — competitive with Cartesia",
            "Instant voice cloning (10s sample)",
            "Streaming via websockets",
            "Multilingual: English, Spanish, French, German, Portuguese, Mandarin, Hindi",
        ],
        "whenToUse": [
            "Voice agent latency is the bottleneck",
            "Need quick voice cloning without long samples",
        ],
        "limitations": [
            "Smaller voice library than ElevenLabs / PlayHT",
            "Fewer features (no emotion control)",
        ],
        "samplePrompts": [
            "Real-time voice agent with LMNT streaming TTS (200ms TTFC).",
            "Clone a brand voice for a customer service IVR.",
            "Multilingual voice agent across 7 languages.",
        ],
        "setupNotes": "Sign up at lmnt.com, create a key. WebSocket: wss://api.lmnt.ai/speech/v1/stream with 'Authorization: Bearer <key>'.",
        "pricingTier": "Free: 1k chars/mo. Personal: $20/mo for 1M chars. Pro from $50/mo for 5M chars.",
        "docsUrl": "https://docs.lmnt.ai",
        "availableModels": ["lmnt-tts-v1", "lmnt-conversational"],
        "availableAgents": ["voice-agent", "conversational-ai"],
        "advantages": [
            "Sub-200ms TTFC — competitive with Cartesia",
            "Instant voice cloning (10s sample)",
            "Simple, transparent pricing",
            "Streaming websockets",
        ],
        "businessAdvantages": [
            "Latency edge for voice agents",
            "Simple pricing = predictable cost",
        ],
        "apiIntegrationDetails": "WebSocket: wss://api.lmnt.ai/speech/v1/stream. Send JSON config + text, receive audio chunks.",
        "modalities": ["voice"],
    },
    {
        "name": "speechmatics",
        "displayName": "Speechmatics",
        "tagline": "Enterprise speech-to-text — 50+ languages, on-prem option, best for non-English accuracy.",
        "icon": "AudioWaveform",
        "color": "#1e40af",
        "category": "specialized",
        "kind": "service",
        "popularity": "medium",
        "bestFor": [
            "Non-English STT (best-in-class for many languages)",
            "On-prem deployment for regulated industries",
            "Enterprise SLAs + support",
            "Subtitle / caption generation",
        ],
        "capabilities": [
            "50+ languages with strong non-English accuracy",
            "On-prem deployment option",
            "Real-time streaming + batch",
            "Speaker diarization + custom dictionaries",
            "Enterprise SLAs + 24/7 support",
        ],
        "whenToUse": [
            "Need highest accuracy on non-English audio",
            "On-prem STT for regulated industries",
        ],
        "limitations": [
            "Premium pricing — enterprise sales motion",
            "Slower release cadence than cloud-native competitors",
        ],
        "samplePrompts": [
            "Transcribe 1000 hours of Japanese calls with highest accuracy.",
            "On-prem STT for HIPAA-compliant medical transcription.",
            "Live caption a 4-hour multi-language conference.",
        ],
        "setupNotes": "Contact sales at speechmatics.com for enterprise. Or sign up for cloud at speechmatics.com/cloud. Endpoint: POST https://asr.api.speechmatics.com/v2/jobs.",
        "pricingTier": "Free: 8 hours/mo. Pay-as-you-go: $0.30/min. Enterprise: contact sales.",
        "docsUrl": "https://docs.speechmatics.com",
        "availableModels": ["enhanced", "standard"],
        "availableAgents": ["transcriber", "captioner", "enterprise-stt"],
        "advantages": [
            "Best non-English STT accuracy",
            "On-prem option for regulated industries",
            "Enterprise SLAs + support",
            "Custom dictionaries for domain terms",
        ],
        "businessAdvantages": [
            "Non-English markets unlock growth",
            "On-prem for healthcare / government / defense",
        ],
        "apiIntegrationDetails": "POST https://asr.api.speechmatics.com/v2/jobs { config, data } with 'Authorization: Bearer <key>'. Poll for completion.",
        "modalities": ["voice"],
    },
]


def to_ts_entry(d: dict) -> str:
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
    lines.append("    bestFor: [")
    for b in d["bestFor"]:
        lines.append(f"    `{b}`,")
    lines.append("    ],")
    lines.append("    capabilities: [")
    for c in d["capabilities"]:
        lines.append(f"    `{c}`,")
    lines.append("    ],")
    lines.append("    whenToUse: [")
    for w in d["whenToUse"]:
        lines.append(f"    `{w}`,")
    lines.append("    ],")
    lines.append("    limitations: [")
    for l in d["limitations"]:
        lines.append(f"    `{l}`,")
    lines.append("    ],")
    lines.append("    samplePrompts: [")
    for s in d["samplePrompts"]:
        lines.append(f"    `{s}`,")
    lines.append("    ],")
    lines.append(f"    setupNotes: `{d['setupNotes']}`,")
    lines.append(f"    pricingTier: `{d['pricingTier']}`,")
    lines.append(f"    docsUrl: `{d['docsUrl']}`,")
    lines.append("    availableModels: [")
    for m in d["availableModels"]:
        lines.append(f"    `{m}`,")
    lines.append("    ],")
    lines.append("    availableAgents: [")
    for a in d["availableAgents"]:
        lines.append(f"    `{a}`,")
    lines.append("    ],")
    lines.append("    advantages: [")
    for ad in d["advantages"]:
        lines.append(f"    `{ad}`,")
    lines.append("    ],")
    lines.append("    businessAdvantages: [")
    for ba in d["businessAdvantages"]:
        lines.append(f"    `{ba}`,")
    lines.append("    ],")
    lines.append(f"    apiIntegrationDetails: `{d['apiIntegrationDetails']}`,")
    lines.append(f"    modalities: {arr(d['modalities'])},")
    lines.append("  },")
    return "\n".join(lines)


def main() -> int:
    if not FILE.exists():
        print(f"ERROR: {FILE} not found", file=sys.stderr)
        return 1

    src = FILE.read_text()

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

    added = []
    skipped = []
    blocks = []
    for entry in ENTRIES:
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
