#!/usr/bin/env python3
"""
Insert `modalities: [...]` into every provider entry in provider-benefits.ts.

Strategy:
  1. Parse each entry block (delimited by `name: \`...\`` through the closing `},`)
  2. Look up the provider name in MODALITY_MAP (manual curated mapping)
  3. Insert `modalities: [...],` as the LAST field in the entry,
     right before the closing `},` (which is preceded by `apiIntegrationDetails: ...,`)

The script is idempotent — if an entry already has a `modalities:` field, it skips.
"""

import re
import sys
from pathlib import Path

# Curated modality assignments per provider.
# Based on the provider's known capabilities, kind, and bestFor text.
# Modalities: chat, voice, video, image, vision, code, reasoning, agents, tools, embeddings
MODALITY_MAP = {
    # ── Frontier cloud services ──
    "openai":       ["chat", "code", "vision", "image", "voice", "agents", "tools", "reasoning", "embeddings"],
    "gemini":       ["chat", "code", "vision", "image", "video", "voice", "agents", "tools", "reasoning", "embeddings"],
    "claude":       ["chat", "code", "vision", "agents", "tools", "reasoning"],
    "grok":         ["chat", "code", "reasoning", "tools", "vision"],
    "marq_glm":     ["chat", "code", "reasoning", "agents", "tools"],
    "zai":          ["chat", "code", "reasoning", "agents", "tools"],
    "marq_free":    ["chat", "code", "reasoning"],

    # ── Open-source / hosted zoos ──
    "huggingface":  ["chat", "code", "vision", "image", "voice", "embeddings", "agents"],
    "ollama":       ["chat", "code", "vision", "embeddings"],
    "replit":       ["code", "agents", "tools"],
    "modal":        ["code", "agents", "tools"],
    "gradio":       ["chat", "vision", "image", "voice"],

    # ── MLOps / platforms ──
    "mlflow":       ["agents", "tools"],
    "crewai":       ["agents", "tools", "code"],
    "langchain":    ["agents", "tools", "code", "chat"],
    "qvac":         ["chat", "code", "agents"],
    "anaconda":     ["code", "agents"],
    "outerbounds":  ["agents", "tools"],

    # ── ML packages ──
    "pytorch":      ["code", "vision", "image", "voice"],
    "tensorflow":   ["code", "vision", "image", "voice"],
    "keras":        ["code", "vision", "image"],
    "opencv":       ["vision", "image", "video"],
    "scikit_learn": ["code", "tools"],
    "transformers": ["chat", "code", "vision", "image", "voice", "embeddings"],
    "instructor":   ["code", "tools", "chat"],

    # ── Serving runtimes ──
    "vllm":         ["chat", "code", "embeddings"],
    "autogen":      ["agents", "tools", "code", "chat"],
    "openclaw":     ["agents", "tools", "code"],

    # ── Open-weight model families ──
    "qwen":         ["chat", "code", "vision", "image", "voice", "agents", "tools", "embeddings"],
    "mistral":      ["chat", "code", "vision", "agents", "tools", "embeddings"],
    "deepseek":     ["chat", "code", "reasoning", "agents", "tools"],
    "llama":        ["chat", "code", "vision", "agents", "tools", "embeddings"],

    # ── Local runtimes (infrabase.ai alternatives) ──
    "llamacpp":         ["chat", "code", "embeddings"],
    "lmstudio":         ["chat", "code", "embeddings"],
    "jan":              ["chat", "code", "embeddings"],
    "gpt4all":          ["chat", "code", "embeddings"],
    "localai":          ["chat", "code", "vision", "image", "voice", "embeddings"],

    # ── Agent / LLM frameworks (infrabase.ai alternatives) ──
    "dify":             ["agents", "tools", "chat", "code"],
    "litellm":          ["chat", "code", "agents", "tools", "embeddings"],
    "llamaindex":       ["agents", "tools", "code", "chat", "embeddings"],
    "dspy":             ["code", "agents", "tools"],
    "langgraph":        ["agents", "tools", "code"],
    "semantic-kernel":  ["agents", "tools", "code", "chat"],
    "vercel-ai-sdk":    ["chat", "code", "agents", "tools"],
    "mastra":           ["agents", "tools", "code"],
    "pydantic-ai":      ["agents", "tools", "code"],
    "spring-ai":        ["agents", "tools", "code", "chat"],
    "haystack":         ["agents", "tools", "code", "chat"],
    "phidata":          ["agents", "tools", "code"],
    "google-adk":       ["agents", "tools", "code"],
    "stagehand":        ["agents", "tools", "code"],
    "tanstack-ai":      ["code", "agents", "tools"],
    "modular":          ["code"],
    "burr":             ["agents", "tools", "code"],
    "ms-agent-framework": ["agents", "tools", "code"],
    "langroid":         ["agents", "tools", "code"],
    "llmkit":           ["agents", "tools", "code"],
    "cc-switch":        ["chat", "code", "agents"],
    "llm-browser":      ["agents", "tools"],
}


def quote_modality(m: str) -> str:
    return f'"{m}"'


def build_modalities_line(modalities: list[str]) -> str:
    """Build the `modalities: [...],` line with proper indentation (4 spaces)."""
    mods = ", ".join(quote_modality(m) for m in modalities)
    return f"    modalities: [{mods}],"


def process_file(path: Path) -> tuple[int, int]:
    """
    Process the file. Returns (entries_updated, entries_skipped).
    Skipped = already had modalities field OR provider name not in map.
    """
    text = path.read_text()
    updated = 0
    skipped = 0

    # Find each entry block. An entry starts with `    name: \`xxx\`,` and ends with `  },`
    # We'll find the `apiIntegrationDetails: \`...\`,` line and insert after it.
    # But that line can span multiple lines (the value is a long string).
    # Simpler: find the closing `  },` of each entry and insert before it.

    # Pattern: match `    name: \`xxx\`,` to capture the provider name, then everything
    # up to and including the next `  },` that closes the entry.
    # We use a non-greedy match across newlines.
    pattern = re.compile(
        r'(    name: `([^`]+)`,[\s\S]*?)(  \},)',
        re.MULTILINE,
    )

    def replacer(match: re.Match) -> str:
        nonlocal updated, skipped
        prefix = match.group(1)
        provider_name = match.group(2)
        closing = match.group(3)

        # Skip if modalities field already exists in the block
        if "modalities:" in prefix:
            skipped += 1
            return match.group(0)

        modalities = MODALITY_MAP.get(provider_name)
        if modalities is None:
            print(f"  WARN: No modality mapping for provider '{provider_name}' — skipping", file=sys.stderr)
            skipped += 1
            return match.group(0)

        new_line = build_modalities_line(modalities)
        # Insert the new line right before the closing `  },`.
        # The prefix ends with the apiIntegrationDetails line (no trailing newline before closing).
        # Ensure exactly one blank line between the last field and the closing brace.
        result = f"{prefix}\n{new_line}\n{closing}"
        updated += 1
        return result

    new_text = pattern.sub(replacer, text)

    if updated == 0:
        print("No changes needed.", file=sys.stderr)
        return (0, skipped)

    path.write_text(new_text)
    return (updated, skipped)


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    target = repo_root / "src" / "lib" / "provider-benefits.ts"

    if not target.exists():
        print(f"ERROR: {target} not found", file=sys.stderr)
        return 1

    print(f"Processing {target}...")
    updated, skipped = process_file(target)
    print(f"  Updated: {updated} entries")
    print(f"  Skipped: {skipped} entries")
    return 0


if __name__ == "__main__":
    sys.exit(main())
