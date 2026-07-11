#!/usr/bin/env python3
"""Surgically remove the old inline AgentPanel/AgentTaskDetail/AgentStepCard
block (and the toolIcons/taskStatusMeta/templateIconMap/TemplateIcon helpers
that only it used) from src/app/page.tsx.

The block runs from the line:
    // ---------- Agent Panel ----------
to (and including) the closing brace of AgentStepCard, right before:
    // ---------- Empty state ----------
"""
from pathlib import Path

path = Path("/home/z/my-project/src/app/page.tsx")
lines = path.read_text().splitlines(keepends=True)

start_marker = "// ---------- Agent Panel ----------\n"
end_marker = "// ---------- Empty state ----------\n"

start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if line == start_marker and start_idx is None:
        start_idx = i
    if line == end_marker and start_idx is not None and end_idx is None:
        end_idx = i
        break

if start_idx is None or end_idx is None:
    raise SystemExit(f"Markers not found. start={start_idx} end={end_idx}")

print(f"Removing lines {start_idx+1}..{end_idx} ({end_idx - start_idx} lines)")
new_lines = lines[:start_idx] + lines[end_idx:]
path.write_text("".join(new_lines))
print(f"New file: {len(new_lines)} lines (was {len(lines)})")
