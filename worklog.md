---
Task ID: agent-templates
Agent: main (super-z)
Task: Add specialized agent personas (Full-Stack Developer, Testing, Business Analyst, Sales, DevOps, Research, Product Manager) to the Marq AI Aggregator Agent tab, each with its own system prompt, tool whitelist, and suggested goals — all running through the same failover engine.

Work Log:
- Added `agentType` column to `AgentTask` model in both SQLite (`prisma/schema.prisma`) and PostgreSQL (`prisma/schema.postgres.prisma`) schemas, with `@default("general")` and a new `@@index([agentType])`.
- Ran `prisma generate` + `prisma db push` — schema applied; existing 11 agent tasks backfilled to `agentType="general"`.
- Created `src/lib/agent-templates.ts` with 8 personas grouped into 4 categories:
  - Engineering: Full-Stack Developer, Testing/QA
  - Business: Business Analyst, Sales, Product Manager
  - Operations: DevOps/SRE
  - General: General Assistant, Research Analyst
  Each template pins: displayName, tagline, description, icon, color, defaultMaxSteps, tool whitelist, persona preamble, suggestedGoals.
- Added 6 new domain-specific tools in `src/lib/tools.ts`:
  - `generate_code` (LLM-backed, for fullstack_dev)
  - `run_tests` (deterministic simulated test report, for testing)
  - `parse_requirements` (LLM-backed, for business_analyst)
  - `calculate_revenue` (deterministic MRR/ARR projection, for sales)
  - `get_deploy_status` (deterministic simulated deploy status, for devops)
  - `create_ticket` (deterministic ticket ID generator, for PM/ops)
  - `write_runbook` (LLM-backed, for devops)
- Updated `toolDescriptionsForPrompt(onlyTools?)` to accept an optional whitelist so templates only expose their allowed tools.
- Updated `src/lib/agent.ts` `runAgentTask`:
  - Loads the template via `getTemplate(task.agentType)` (falls back to "general").
  - `buildSystemPrompt(goal, template)` now injects the template's persona preamble and uses the template's tool whitelist in the "Available tools" section.
  - Added a tool-whitelist enforcement gate: if the LLM tries to call a tool not in the template's whitelist, an error observation is recorded ("Tool X is not allowed for the Y agent") and the loop continues, so the LLM picks a different approach.
- Updated `src/app/api/agent/tasks/route.ts`:
  - POST validates `agentType` against `TEMPLATE_KEYS`; falls back to "general" on invalid/missing.
  - POST derives default `maxSteps` from the template when not specified.
  - GET accepts `?agentType=` filter and returns `agentType` on each task.
- Created `src/app/api/agent/templates/route.ts` — returns all templates with their tools (resolved via `getToolsByNames`) and suggested goals.
- Rewrote the `AgentPanel` component in `src/app/page.tsx`:
  - Added `AgentTemplate` interface + `agentType` field on `AgentTask`.
  - Added a **template picker** at the top: cards grouped by category (Engineering/Business/Operations/General), each card shows icon, name, tagline, tool count, max steps. Selected card gets a colored border + glow in the template's accent color.
  - Goal composer below now adapts to the selected template: title, color, button text ("Run Full-Stack Developer"), suggested goals (one-click starters).
  - Task list filters client-side: shows all tasks when "general" is selected, otherwise shows only tasks for the selected template. Each task card shows the template's icon + colored badge.
  - Task detail (`AgentTaskDetail`) now receives `templates` and shows a colored agent-type badge at the top, plus the final-answer box uses the template's accent color.
  - Tools reference section at the bottom only shows tools available to the selected template.
- Updated `scripts/seed.ts` to seed one sample pending task per template (skipping "general") so users see populated history on first load.
- Updated `scripts/stress-agent.ts` to mix agent types (general, sales, testing, devops, fullstack_dev) in its 8-task run.
- Ran `bun run lint` → clean. Ran `bun run build` → succeeded. Ran the stress test → all 8 tasks completed, 4/8 triggered failover, each agent type used only its whitelisted tools, 8 failover log entries recorded.
- Took screenshots of the Agent tab with the new template picker (general + fullstack_dev selected + task detail) and verified via VLM that all UI elements render correctly.

Stage Summary:
- Agent module now has 8 specialized personas selectable from a dedicated picker in the Agent tab.
- Each persona enforces its own tool whitelist — Sales can't call `generate_code`, Full-Stack Dev can't call `calculate_revenue`, etc. — enforced both in the prompt and at execution time.
- Failover engine unchanged: every LLM call in every agent's ReAct loop still routes through `runWithFailover`. Stress test confirmed 4/8 multi-template tasks triggered failover (Claude→OpenAI or vice versa) with all tasks completing successfully.
- All 8 templates visible and selectable in the UI; task list, task detail, and tools reference all adapt to the selected template.
- Schema migration applied to local SQLite; Postgres schema updated in lockstep for Vercel.
- Build green, lint green, ready to push to GitHub + Vercel.
