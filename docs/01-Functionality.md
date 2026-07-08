# Marq AI Aggregator — Functionality Documentation

**Version:** 2.0 (SaaS)
**Audience:** Product owners, business analysts, sales engineers, customer success
**Last updated:** 2026-07-08

---

## 1. Overview

Marq AI Aggregator is a multi-tenant SaaS platform that unifies access to multiple AI models (OpenAI GPT, Google Gemini, Anthropic Claude, and more) under one workspace, one subscription, and one API. Companies sign up, invite their team, and immediately get:

- **Routing** — every prompt is sent to a primary model; if that model is unavailable, the platform automatically falls over to the next model in the priority chain.
- **Comparison** — the same prompt can be run across all configured models in parallel so teams can see which model produces the best output for their use case.
- **Collaboration** — chat history, agents, prompts, and files live in a shared team workspace scoped by organization.
- **Agents** — role-based autonomous agents (Full-Stack Developer, Testing, Business Analyst, Sales, Product Manager, DevOps, Research, General) that execute multi-step tasks using tools.
- **Unified API** — an OpenAI-compatible REST API so external software (CRMs, internal tools, scripts) can call Marq AI using a single API key with auto-failover built in.

This document describes **what** the platform does. For "how it's built" see the Technical documentation; for "how to use it day-to-day" see the User SOPs.

---

## 2. User Roles & Permissions

Marq AI is multi-tenant: each customer is an **Organization**. Users belong to one or more Organizations via **Memberships**, and each membership has one of four roles:

| Role | Can use chat / agents / prompts / files | Can manage team members | Can manage API keys | Can manage providers | Can change org name / plan |
|------|:-:|:-:|:-:|:-:|:-:|
| **Owner** | ✓ | ✓ | ✓ (incl. admin scope) | ✓ | ✓ |
| **Admin** | ✓ | ✓ (member/viewer only) | ✓ | ✓ | ✓ (name only) |
| **Member** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Viewer** | read-only | ✗ | ✗ | ✗ | ✗ |

**Notes:**
- Only **owners** can grant the admin role or remove admins.
- **Owners cannot be removed** from their org (prevents orphaned orgs).
- Viewers can read chats, agent runs, prompts, files, and health metrics but cannot send messages, run agents, or modify anything.

---

## 3. Functional Modules

### 3.1 Chat (Routing + Failover)

**Purpose:** Send a message and get a response from the active primary provider, with automatic failover if that provider fails.

**Flow:**
1. User selects (or accepts the default) primary provider — typically the highest-priority active provider.
2. User types a message and hits send.
3. The platform:
   - Persists the user message in the active chat session.
   - Loads the last 20 messages in that session for context.
   - Calls the primary provider.
   - If the primary returns an error (timeout, rate limit, auth error, server error, network error), the platform classifies the error, logs a failover event, and tries the next provider in priority order.
   - This continues until a provider succeeds OR all providers fail (returns 502).
4. The assistant response is persisted with metadata: which provider ultimately answered, latency, token count, whether failover occurred, and the original (failed) provider.

**Visible to user:** A badge on each assistant message shows the provider that answered. If failover occurred, a warning banner explains "Originally routed to OpenAI, failed over to Gemini" with the reason.

**Status:** Production-ready. Stress-tested with 15-message runs in demo mode (3 successfully failed over with reason logging).

### 3.2 Model Comparison

**Purpose:** Run the **same prompt** across multiple providers **in parallel** and display the outputs side-by-side. **No failover** is used — each provider returns its raw output (or raw error) so the user can judge model quality directly.

**Flow:**
1. User selects 2+ providers (defaults to all active).
2. User enters an optional system prompt and a user prompt.
3. The platform calls each provider in parallel with a 25-second per-provider timeout.
4. Results are displayed in a grid: one card per provider showing the response, model name, latency, and token usage. Failed providers show their error in red.
5. The comparison run is persisted for history (in the `ComparisonRun` table).

**Use cases:**
- Choosing which model to use for a new use case (e.g. "Which model writes the best SQL?").
- A/B testing prompt engineering changes across models.
- Production troubleshooting ("why does Claude give a different answer than GPT-4o for this prompt?").

### 3.3 Agents (Role-Based Autonomous Workers)

**Purpose:** Run multi-step AI tasks that require tool use, with role-specific personas and tool whitelists.

**Available agent templates:**

| Template | Key | Allowed tools | Best for |
|---|---|---|---|
| Full-Stack Developer | `fullstack_dev` | `generate_code`, `web_search`, `text_summary` | Code generation, architecture sketches, refactors |
| Testing / QA | `testing` | `run_tests`, `web_search`, `text_summary` | Test planning, simulated test runs, QA reports |
| DevOps / SRE | `devops` | `get_deploy_status`, `web_search`, `write_runbook` | Deploy checks, runbook authoring, incident response |
| Business Analyst | `business_analyst` | `parse_requirements`, `web_search`, `text_summary` | Briefs → requirements docs, market research |
| Sales | `sales` | `calculate_revenue`, `web_search`, `create_ticket` | MRR/ARR projections, deal qualification, CRM ticket creation |
| Product Manager | `product_manager` | `web_search`, `text_summary`, `create_ticket` | PRDs, competitive analysis, feature specs |
| Research Analyst | `research` | `web_search`, `text_summary` | Literature reviews, trend analysis, source synthesis |
| General Assistant | `general` | all tools | Anything that doesn't fit a specialist role |

**Execution model (ReAct loop):**
1. User submits a goal (e.g. "Project MRR for 100 subscribers at $49 ARPU, 5% monthly churn, 6 months").
2. The platform picks the agent template, builds a system prompt with the goal + tool descriptions, and runs the ReAct loop:
   - **Thought** — the agent reasons about what to do next.
   - **Action** — the agent picks a tool to call.
   - **Observation** — the tool's output is fed back.
   - Repeat until the agent emits a **Final Answer** OR hits the step cap (default 8, max 15).
3. Every LLM call inside the loop uses the failover engine, so if the primary model dies mid-task, the agent transparently continues on the next provider.
4. The full execution trace (each thought/action/observation) is persisted as `AgentStep` rows and visible in the UI.

### 3.4 Provider Registry

**Purpose:** Centralized configuration of AI providers. Each provider has:
- Name (machine identifier: `openai`, `gemini`, `claude`)
- Display name
- Description
- API endpoint
- API key (encrypted at rest via the DB; demo mode skips real calls)
- List of models (e.g. `["gpt-4o", "gpt-4o-mini"]`)
- Active flag
- Priority (0 = primary, 1 = first failover, etc.)
- Brand color and icon

**Demo mode:** When no API key is configured, the platform routes requests through `z-ai-web-dev-sdk` with simulated per-provider latency and failure rates (Claude 18%, Gemini 8%, OpenAI 4%). This lets users exercise failover without spending real tokens.

**Production mode:** When API keys are set, the same `callProvider` interface can be swapped for direct OpenAI/Gemini/Claude SDK calls. The structure is in place; you only fill in the SDK calls.

### 3.5 Health Monitoring

**Purpose:** Real-time visibility into provider reliability.

**Data source:** Every provider call (successful or failed) writes a `HealthLog` row with status (`healthy` / `degraded` / `down`), latency, and error message.

**Displayed metrics:**
- Current status (based on most recent HealthLog)
- Last latency
- Last error message
- Last checked time
- Counts of healthy / degraded / down providers across the registry

### 3.6 Failover Log

**Purpose:** Auditable record of every failover event.

**Schema:** Each row records `fromProvider`, `toProvider`, `reason` (timeout / rate_limit / auth_error / server_error / network / unknown), error message, optional session ID, and timestamp.

**Use cases:**
- Post-mortem analysis ("why did our chat fail over at 3am?").
- Provider reliability trending ("Claude has been failing over to Gemini 3x more often this week").
- Compliance / audit trails for regulated industries.

### 3.7 Prompt Library

**Purpose:** Save reusable prompts in a team-shared library so colleagues don't reinvent the same prompt.

**Schema:** Each prompt has a title, body, category (general / engineering / writing / analysis / sales), tags, and timestamps. Prompts are scoped by org.

**UI:** Search by title, filter by category. Click "Use" to load a prompt into the chat composer.

### 3.8 File Uploads

**Purpose:** Attach documents to the workspace (code reviews, data summaries, reference materials). Files are scoped by org and stored on disk (local dev) or `/tmp` (Vercel ephemeral). For production persistence, swap the storage backend to Vercel Blob or S3 — the `storageKey` field is the abstraction boundary.

**Limits:** 25 MB per file. Content-type is preserved for download.

### 3.9 Team Management

**Purpose:** Admins invite team members, assign roles, and remove access. Seat usage is tracked against the org's plan limit (free plan = 5 seats).

**Invitation flow:** Currently the invitee must already have a Marq account with the matching email. Future enhancement: email-based magic-link invitations.

### 3.10 API Keys & Unified API

**Purpose:** Allow external software to call Marq AI programmatically.

**API key model:**
- Each key is a `marq_live_<random>` token.
- Only the SHA-256 hash is stored; the full token is shown **once** at creation time.
- Each key has a **name** (e.g. "Production server"), a **prefix** (first 16 chars, shown in the UI for identification), and **scopes** (chat, compare, agents, read, admin).
- Keys can be revoked at any time; revocation is instant.

**Unified API endpoints (OpenAI-compatible):**

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/chat/completions` | POST | OpenAI-compatible chat with auto-failover. Accepts `messages`, optional `provider`, optional `session_id`. Returns OpenAI-shaped response with a `marq` extension containing failover details. |
| `/api/v1/compare` | POST | Run one prompt across multiple providers in parallel. |
| `/api/v1/agents/run` | POST | Run a role-based agent synchronously. Returns the final answer + full step trace. |
| `/api/v1/models` | GET | List all available models across providers (OpenAI `/v1/models` shape). |

**Auth:** Bearer token in the `Authorization` header: `Authorization: Bearer marq_live_...`

**Scopes:**
- `chat` — required for `/v1/chat/completions`
- `compare` — required for `/v1/compare`
- `agents` — required for `/v1/agents/run`
- `read` — required for `/v1/models`
- `admin` — grants everything (only owners can issue admin-scoped keys)

---

## 4. Multi-Tenancy & Data Isolation

Every chat session, agent task, prompt, file, API key, failover log, and comparison run is scoped by `orgId`. The auth middleware (`requireRole` / `requireAuth`) enforces this on every endpoint:

- A user in Org A can never read Org B's chats, even if they know the session ID.
- API keys are scoped to a single org; a key issued in Org A cannot read Org B's data.
- Failover logs are tagged with the org ID when a failover occurs, so the Failover Log tab only shows your org's events.

**Providers are shared across orgs** in this build — every tenant sees the same OpenAI/Gemini/Claude registry. This is by design (providers are infrastructure, not data). Per-org provider overrides are a future enhancement.

---

## 5. Security Posture

| Concern | Mitigation |
|---|---|
| Password storage | scrypt hashing (Node built-in, ~equivalent to bcrypt). Salt is per-user. |
| Session tokens | 32 random bytes, hex-encoded. Stored in `AuthSession` table (revocable). Cookie is `httpOnly`, `sameSite=lax`, `secure` in production. |
| Session expiry | 30-day TTL, checked on every request. Expired sessions are deleted. |
| API key storage | Only SHA-256 hashes are stored. Full key shown once at creation. |
| API key transport | Bearer token over HTTPS. Vercel enforces TLS at the edge. |
| RBAC enforcement | Every route handler calls `requireRole(minRole)` or `authApiKey(scope)` at the top. No endpoint is unauthenticated except `/api/auth/login`, `/api/auth/signup`, and `/api/providers` (read-only). |
| SQL injection | All queries go through Prisma ORM (parameterized). No raw SQL. |
| XSS | React escapes all rendered content. No `dangerouslySetInnerHTML` anywhere. |
| CSRF | Cookie is `sameSite=lax`. State-changing endpoints require POST/PATCH/DELETE (not GET). |
| File upload abuse | 25 MB cap. Content-type preserved but file is served as attachment (not inline) to prevent HTML execution. |

---

## 6. Subscription / Plans

The schema includes a `plan` field on Organization (`free` / `pro` / `enterprise`) and `seatsTotal` / `seatsUsed` counters. The current build enforces seat limits on the free plan (5 seats). Billing integration (Stripe) is a future enhancement — the data model is ready.

---

## 7. What's NOT Yet Built (Roadmap)

- **Streaming responses** — chat currently returns the full response. SSE streaming is on the roadmap.
- **Real provider SDK calls** — the demo mode uses z-ai-web-dev-sdk; production mode has the structure for direct OpenAI/Gemini/Claude SDK calls but needs the SDK dependencies added.
- **Email invitations** — invites currently require the user to already have an account.
- **Per-org provider overrides** — providers are shared across orgs in this build.
- **Billing / Stripe** — schema is ready, integration is not.
- **Audit log** — failover logs exist, but a full user-action audit log (who created/edited what) is not yet implemented.
- **Webhook system** — for events like "agent task completed" or "failover occurred".

For implementation status of any specific feature, see the Technical documentation.
