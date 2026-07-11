#!/usr/bin/env python3
"""
Generate `src/lib/agent-templates-data.json` for the Marq AI Aggregator by
importing all 139 skills from https://marqaiskills.vercel.app/api/skills.

Each skill becomes one AgentTemplate entry. The skill's `content` (markdown)
becomes the template's `persona` preamble; the skill's `description` becomes
the template `description`; the emoji `icon` and hex `color` are passed
through unchanged; the 10 reference categories are mapped to slugs that
extend the existing 4-category union (engineering/business/operations/general).

Output: /home/z/my-project/src/lib/agent-templates-data.json
"""
import json
import re
import sys
from pathlib import Path

INPUT = Path("/tmp/all_skills.json")
OUTPUT = Path("/home/z/my-project/src/lib/agent-templates-data.json")

# Category mapping: reference-site category  ->  our slug
CATEGORY_MAP = {
    "AI Agent Architecture": "agent_arch",
    "Marq AI Products": "marq_products",
    "Sales and Revenue": "sales",
    "Consulting": "consulting",
    "Engineering & DevOps": "engineering",
    "Security & Compliance": "security",
    "Marketing & Content": "marketing",
    "Strategy & Finance": "strategy",
    "Operations & People": "operations",
    "Sports & Entertainment": "sports",
}

# Tool whitelist per destination category. These are the tools already
# registered in src/lib/tools.ts:
#   web_search, calculator, current_time, text_summary,
#   generate_code, run_tests, parse_requirements, calculate_revenue,
#   get_deploy_status, create_ticket, write_runbook
TOOLS_BY_CATEGORY = {
    "agent_arch":    ["web_search", "generate_code", "text_summary", "current_time", "create_ticket"],
    "marq_products": ["generate_code", "run_tests", "get_deploy_status", "web_search", "text_summary", "current_time", "create_ticket"],
    "sales":         ["calculate_revenue", "web_search", "text_summary", "calculator", "current_time"],
    "consulting":    ["parse_requirements", "web_search", "text_summary", "create_ticket", "calculator", "current_time"],
    "engineering":   ["generate_code", "run_tests", "get_deploy_status", "write_runbook", "web_search", "create_ticket", "current_time", "text_summary"],
    "security":      ["web_search", "generate_code", "run_tests", "create_ticket", "text_summary", "current_time"],
    "marketing":     ["web_search", "text_summary", "current_time", "create_ticket"],
    "strategy":      ["calculator", "web_search", "text_summary", "calculate_revenue", "current_time"],
    "operations":    ["parse_requirements", "web_search", "text_summary", "create_ticket", "current_time"],
    "sports":        ["web_search", "calculator", "current_time", "text_summary"],
}

# Default step budget per category.
STEPS_BY_CATEGORY = {
    "agent_arch": 8,
    "marq_products": 8,
    "sales": 6,
    "consulting": 6,
    "engineering": 8,
    "security": 7,
    "marketing": 6,
    "strategy": 6,
    "operations": 6,
    "sports": 5,
}


def slug_to_key(slug: str) -> str:
    """'agent-army' -> 'agent_army' (TS-friendly identifier)."""
    return slug.replace("-", "_")


def slug_to_display(slug: str) -> str:
    """'agent-army' -> 'Agent Army'."""
    return " ".join(word.capitalize() for word in slug.split("-"))


def make_tagline(desc: str, limit: int = 110) -> str:
    """First sentence/clause of description, truncated to a sensible tagline."""
    if not desc:
        return ""
    # Take up to the first period+space or first newline, whichever comes first.
    first = re.split(r"(?<=[.!?])\s+", desc.strip(), maxsplit=1)[0]
    if len(first) > limit:
        # Truncate at the last word boundary before `limit`.
        truncated = first[:limit]
        cut = truncated.rfind(" ")
        if cut > 40:
            truncated = truncated[:cut]
        first = truncated.rstrip(",;:") + "…"
    return first.strip()


def make_suggested_goals(skill: dict) -> list[str]:
    """Derive 2 one-click starter goals from the skill description + name."""
    desc = (skill.get("description") or "").strip()
    display = slug_to_display(skill["name"])

    # Goal 1: "Run <Display Name> on a sample scenario."
    # Goal 2: derived from the second sentence of the description (if any),
    #         otherwise "Use <Display Name> to analyze a real example."
    parts = re.split(r"(?<=[.!?])\s+", desc)
    if len(parts) >= 2 and len(parts[1]) > 30:
        second = parts[1].strip()
        if len(second) > 140:
            second = second[:137].rstrip() + "…"
        goal2 = f"{display}: {second[0].lower()}{second[1:]}"
    else:
        goal2 = f"Use {display} to analyze a real example end-to-end and summarize the output."

    goal1 = f"Run {display} on a representative sample and walk me through the result."
    return [goal1, goal2]


def make_persona(skill: dict) -> str:
    """Build the system-prompt preamble from the skill content.

    The skill's `content` field IS the skill prompt — instructions, sections,
    examples. We wrap it with a short Marq Agent framing line so the ReAct
    loop still knows it's an agent persona.
    """
    content = (skill.get("content") or "").strip()
    display = slug_to_display(skill["name"])
    framing = (
        f"You are Marq Agent — {display}.\n"
        f"Follow the skill instructions below precisely. Reason step-by-step "
        f"and call the available tools when needed to accomplish the user's goal.\n\n"
        f"---\n\n"
    )
    return framing + content


def main() -> int:
    if not INPUT.exists():
        print(f"ERROR: {INPUT} not found. Run the fetch first.", file=sys.stderr)
        return 1

    with INPUT.open() as f:
        data = json.load(f)

    skills = data.get("skills", [])
    print(f"Loaded {len(skills)} skills from {INPUT}")

    templates = []
    skipped = []
    for s in skills:
        name = s.get("name") or s.get("slug")
        if not name:
            skipped.append(s)
            continue
        cat_ref = s.get("category") or "Operations & People"
        cat = CATEGORY_MAP.get(cat_ref, "operations")
        key = slug_to_key(name)
        # Skip if collides with the 8 existing curated template keys.
        if key in {"general", "fullstack_dev", "testing", "devops",
                   "business_analyst", "sales", "product_manager", "research"}:
            # Rename to avoid collision.
            key = key + "_v2"

        tpl = {
            "key": key,
            "displayName": slug_to_display(name),
            "tagline": make_tagline(s.get("description", "")),
            "description": s.get("description", "") or slug_to_display(name),
            "icon": s.get("icon") or "✨",
            "color": s.get("color") or "#6366f1",
            "category": cat,
            "defaultMaxSteps": STEPS_BY_CATEGORY.get(cat, 6),
            "tools": TOOLS_BY_CATEGORY.get(cat, ["web_search", "current_time", "text_summary"]),
            "persona": make_persona(s),
            "suggestedGoals": make_suggested_goals(s),
            "sourceCategory": cat_ref,  # kept for debugging; ignored by app
        }
        templates.append(tpl)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w") as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(templates)} templates to {OUTPUT} ({OUTPUT.stat().st_size} bytes)")

    # Summary by category
    from collections import Counter
    by_cat = Counter(t["category"] for t in templates)
    print("\nTemplates by category:")
    for cat, n in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {cat:14s} {n:3d}")

    if skipped:
        print(f"\nSkipped {len(skipped)} skills (no name)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
