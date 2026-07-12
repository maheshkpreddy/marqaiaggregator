#!/usr/bin/env python3
"""
Append three missing AI Directory entries to src/lib/provider-benefits.ts:
  1. AnythingLLM
  2. Atomic Chat
  3. Open WebUI

Idempotent: re-running will not duplicate entries — it checks for the
`name:` key first and skips if present.

Appends just before the closing `];` of PROVIDER_BENEFITS.
"""

from pathlib import Path
import re
import sys

FILE = Path("/home/z/my-project/src/lib/provider-benefits.ts")

# ── New entries ────────────────────────────────────────────────────────────
# Each entry mirrors the ProviderBenefit schema. Template literals (backticks)
# are used throughout to match the existing file style. The modalities field
# is a JSON-array literal so it stays TypeScript-valid.

ENTRIES = [
    # ── AnythingLLM ────────────────────────────────────────────────────────
    {
        "name": "anythingllm",
        "check_names": ["anythingllm", "anything-llm"],
        "block": """  {
    name: `anythingllm`,
    displayName: `AnythingLLM`,
    tagline: `Open-source, self-hosted ChatGPT-equivalent for any LLM with built-in RAG, workspaces, and document chat.`,
    icon: `BookOpen`,
    color: `#6366f1`,
    category: `orchestration`,
    kind: `framework`,
    popularity: `high`,
    bestFor: [
      `Private ChatGPT-style assistant over your own documents`,
      `Multi-user workspaces with per-document access control`,
      `Self-hosted RAG without building a pipeline from scratch`,
      `Plug-and-play with OpenAI, Anthropic, Ollama, LM Studio, LocalAI`,
      `Desktop (Mac/Win/Linux) or Docker deployment`,
    ],
    capabilities: [
      `Drag-and-drop document ingestion (PDF, Word, web, Confluence)`,
      `Per-workspace vector storage with tenant isolation`,
      `Bring-your-own-LLM: OpenAI, Anthropic, Azure, Ollama, LM Studio, LocalAI`,
      `Embeddable chat widget for external sites`,
      `Agent mode with web browsing and tool use`,
    ],
    whenToUse: [
      `You need a private ChatGPT over internal docs in <1 hour`,
      `You want zero per-seat licensing — fully self-hosted`,
      `Your team needs isolated workspaces per client or department`,
      `You're already running Ollama / LM Studio and want a UI on top`,
    ],
    limitations: [
      `Vector DB choices (LanceDB default) need tuning at scale`,
      `Agent mode is less mature than LangGraph / CrewAI`,
      `No native multimodal generation (vision input only on some models)`,
    ],
    samplePrompts: [
      `Summarize the attached 200-page policy manual and extract every clause that mentions 'data retention'.`,
      `Compare Q3 sales deck vs Q4 sales deck — what changed in the pricing narrative?`,
      `From our Confluence space, list every runbook that references the 'auth-service' incident.`,
    ],
    setupNotes: `Quickest path: 'docker run -p 3001:3001 -v anythingllm:/app/server/storage mintplexlabs/anythingllm'. Open http://localhost:3001, pick an LLM provider (or point at local Ollama at http://host.docker.internal:11434), create a workspace, drop in documents. For desktop: download from useanything.com.`,
    pricingTier: `Free / open-source (MIT). Hosted AnythingLLM Cloud from $0.25/user/day.`,
    docsUrl: `https://docs.anythingllm.com`,
    availableModels: [
      `(any OpenAI / Anthropic / Azure / Ollama / LM Studio / LocalAI model)`,
    ],
    availableAgents: [
      `rag-researcher`,
      `doc-summarizer`,
      `knowledge-base-qa`,
    ],
    advantages: [
      `True self-hosted — no vendor lock-in, no per-seat fees`,
      `Workspace isolation = multi-tenant out of the box`,
      `14+ LLM providers supported without code changes`,
      `Built-in vector store (LanceDB) — zero extra infra`,
      `Drag-and-drop document ingestion for non-technical users`,
    ],
    businessAdvantages: [
      `Private ChatGPT for regulated industries (HIPAA, SOC2, GDPR)`,
      `Onboard in under an hour — no ML team required`,
      `Per-workspace access control maps to org structure`,
      `Reduces ChatGPT-team seat costs`,
    ],
    apiIntegrationDetails: `REST API at http://your-host:3001/api/v1 with 'Authorization: Bearer <workspace-api-key>'. POST /chat with workspaceSlug + message, or /document/upload to ingest. WebSocket /stream for token streaming.`,
    modalities: ["chat", "agents", "tools", "embeddings"],
  },""",
    },
    # ── Atomic Chat ────────────────────────────────────────────────────────
    {
        "name": "atomic-chat",
        "check_names": ["atomic-chat", "atomicchat", "atomic chat"],
        "block": """  {
    name: `atomic-chat`,
    displayName: `Atomic Chat`,
    tagline: `Privacy-first local chat UI that runs any OpenAI-compatible endpoint with zero telemetry and full offline support.`,
    icon: `MessageSquare`,
    color: `#0ea5e9`,
    category: `local`,
    kind: `framework`,
    popularity: `low`,
    bestFor: [
      `Air-gapped chat UI for regulated environments`,
      `Lightweight alternative to Open WebUI for single-user use`,
      `Quick front-end for any OpenAI-compatible backend (Ollama, vLLM, LiteLLM)`,
      `Privacy-first setups — no analytics, no telemetry, no cloud calls`,
    ],
    capabilities: [
      `Chat with any OpenAI-compatible endpoint (Ollama, vLLM, LiteLLM, LM Studio)`,
      `Local conversation history with encrypted storage`,
      `Multi-model switching within a single conversation`,
      `Streaming responses with token-by-token rendering`,
      `Markdown + code block rendering with syntax highlighting`,
    ],
    whenToUse: [
      `You need a no-frills, no-cloud chat UI in <5 minutes`,
      `Your compliance team blocks SaaS chat tools`,
      `You want a tiny binary that runs on a locked-down workstation`,
      `You already have an OpenAI-compatible backend and just need a UI`,
    ],
    limitations: [
      `No built-in RAG or document ingestion (use AnythingLLM for that)`,
      `No agent orchestration (use LangGraph or CrewAI)`,
      `Single-user oriented — no multi-tenant workspaces`,
      `Smaller community than Open WebUI or Jan`,
    ],
    samplePrompts: [
      `Run this regex against the pasted log and explain each match in plain English.`,
      `Draft a polite email declining a vendor's renewal offer by 30%.`,
      `Convert this curl command into a Python requests snippet with error handling.`,
    ],
    setupNotes: `Download the binary from the Atomic Chat GitHub releases, or 'docker pull atomicchat/atomic-chat:latest && docker run -p 3000:3000 atomicchat/atomic-chat'. Point it at your backend via the Settings panel — set 'OpenAI-compatible base URL' (e.g. http://localhost:11434/v1 for Ollama) and paste your API key (or 'ollama' for local).`,
    pricingTier: `Free / open-source. No paid tier.`,
    docsUrl: `https://github.com/atomicchat/atomic-chat`,
    availableModels: [
      `(any OpenAI-compatible model served by Ollama / vLLM / LiteLLM / LM Studio)`,
    ],
    availableAgents: [
      `chat-companion`,
      `local-coder`,
    ],
    advantages: [
      `Zero telemetry — verified no outbound calls`,
      `Tiny footprint — single binary, no Node.js runtime required`,
      `Works fully offline once installed`,
      `Drop-in UI for any OpenAI-compatible backend`,
      `Encrypted local conversation history`,
    ],
    businessAdvantages: [
      `Deployable in air-gapped / classified environments`,
      `No vendor relationship to manage — pure open source`,
      `Passes security review faster than SaaS alternatives`,
      `Same UI across dev / staging / prod backends`,
    ],
    apiIntegrationDetails: `Configures as an OpenAI-compatible client. Point at base URL like 'http://localhost:11434/v1' (Ollama) or 'http://localhost:8000/v1' (vLLM). No separate API of its own — it's a frontend.`,
    modalities: ["chat", "code"],
  },""",
    },
    # ── Open WebUI ─────────────────────────────────────────────────────────
    {
        "name": "open-webui",
        "check_names": ["open-webui", "openwebui", "open webui"],
        "block": """  {
    name: `open-webui`,
    displayName: `Open WebUI`,
    tagline: `Feature-complete, self-hosted ChatGPT-style UI for Ollama and OpenAI-compatible APIs — multi-user, RAG-ready, extensible.`,
    icon: `Globe`,
    color: `#16a34a`,
    category: `local`,
    kind: `framework`,
    popularity: `very-high`,
    bestFor: [
      `Self-hosted ChatGPT UI for teams with multi-user auth`,
      `Ollama-first workflows with built-in model management`,
      `RAG over personal documents with hybrid search`,
      `Extensible via OpenAI-compatible function-calling tools`,
      `Org-wide rollout with role-based access and audit logs`,
    ],
    capabilities: [
      `Multi-user chat with OAuth / LDAP / SSO authentication`,
      `Per-user model access controls and admin dashboard`,
      `Built-in RAG: upload documents, web search, or scrape URLs`,
      `Model marketplace — install Ollama models with one click`,
      `Pipelines: Python-defined tool and agent flows`,
      `Voice input / output with Whisper + TTS`,
      `Image generation via Stable Diffusion / DALL-E integration`,
    ],
    whenToUse: [
      `You want a polished, multi-user ChatGPT UI on your own infra`,
      `Your team standardizes on Ollama but needs richer features`,
      `You need RBAC, audit logs, and SSO for compliance`,
      `You want RAG + tools + agents in a single UI without coding`,
    ],
    limitations: [
      `Heavier than minimal UIs (Atomic Chat, Jan) — full Python stack`,
      `Pipelines framework is powerful but has a learning curve`,
      `Resource usage scales with concurrent users + RAG indexing`,
    ],
    samplePrompts: [
      `Using the uploaded contract, draft a redline that caps liability at 12 months of fees.`,
      `Search the web for 'EU AI Act enforcement timeline' and summarize the top 3 sources.`,
      `Transcribe this meeting recording and extract action items with owners and due dates.`,
    ],
    setupNotes: `Fastest: 'docker run -d -p 3000:8080 --add-host=host.docker.internal:host-gateway -v open-webui:/app/backend/data --name open-webui ghcr.io/open-webui/open-webui:main'. Open http://localhost:3000, register the first user (auto-admin), then connect Ollama at http://host.docker.internal:11434 or add an OpenAI-compatible provider under Settings > Connections.`,
    pricingTier: `Free / open-source (MIT). Hosted Open WebUI Cloud from $19/mo.`,
    docsUrl: `https://docs.openwebui.com`,
    availableModels: [
      `(any Ollama model + any OpenAI-compatible API)`,
    ],
    availableAgents: [
      `rag-researcher`,
      `doc-summarizer`,
      `code-reviewer`,
      `browser-agent`,
    ],
    advantages: [
      `Most feature-complete open-source ChatGPT UI`,
      `Multi-user with RBAC, SSO, LDAP, audit logs out of the box`,
      `Pipelines framework turns Python functions into agent tools`,
      `Native Ollama integration with one-click model install`,
      `Active community — 100k+ stars, frequent releases`,
    ],
    businessAdvantages: [
      `Replace ChatGPT Team / Enterprise seats with self-hosted alternative`,
      `Passes enterprise security review (auth, audit, RBAC)`,
      `Multi-tenant ready — deploy per team or per client`,
      `No per-seat licensing — scale to thousands of users for free`,
    ],
    apiIntegrationDetails: `OpenAI-compatible API at http://your-host:3000/api. Auth via JWT (from /api/v1/auths/login) passed as 'Authorization: Bearer <jwt>'. Endpoints: /api/chat/completions, /api/v1/models, /api/v1/files, /api/v1/rag/web/search.`,
    modalities: ["chat", "voice", "image", "vision", "code", "agents", "tools", "embeddings"],
  },""",
    },
]


def main() -> int:
    if not FILE.exists():
        print(f"ERROR: {FILE} not found", file=sys.stderr)
        return 1

    src = FILE.read_text()

    # Find the closing `];` of PROVIDER_BENEFITS — it's the first `];` after
    # the line `export const PROVIDER_BENEFITS: ProviderBenefit[] = [`.
    start_match = re.search(
        r"export const PROVIDER_BENEFITS:\s*ProviderBenefit\[\]\s*=\s*\[",
        src,
    )
    if not start_match:
        print("ERROR: could not locate PROVIDER_BENEFITS array start", file=sys.stderr)
        return 2

    # Find the closing `];` after the array start.
    end_match = re.search(r"\n\];\n", src[start_match.end():])
    if not end_match:
        print("ERROR: could not locate PROVIDER_BENEFITS array end", file=sys.stderr)
        return 3

    insert_at = start_match.end() + end_match.start()  # index of the `\n` before `];`

    # Idempotency check — for each entry, see if its `name:` key already exists.
    added_blocks = []
    skipped = []
    for entry in ENTRIES:
        # Build a regex that matches `name: \`<key>\`,` for any variant
        already = False
        for variant in entry["check_names"]:
            # Match the displayName OR the name field with this value
            pat = re.compile(
                r"^\s*name:\s*`" + re.escape(variant) + r"`\s*,\s*$",
                re.MULTILINE,
            )
            if pat.search(src):
                already = True
                break
        if already:
            skipped.append(entry["name"])
            continue
        added_blocks.append(entry["block"])

    if not added_blocks:
        print(f"All {len(ENTRIES)} entries already present. Nothing to do. "
              f"(Skipped: {', '.join(skipped)})")
        return 0

    # Each block already starts with `  {` and ends with `  },` and a newline.
    # Join them with a blank line between for readability.
    new_chunk = "\n" + "\n".join(added_blocks) + "\n"

    new_src = src[:insert_at] + new_chunk + src[insert_at:]

    FILE.write_text(new_src)
    print(f"Inserted {len(added_blocks)} new entries: "
          f"{', '.join(b.split('name: `')[1].split('`')[0] for b in added_blocks)}")
    if skipped:
        print(f"Skipped (already present): {', '.join(skipped)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
