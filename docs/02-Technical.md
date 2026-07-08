# Marq AI Aggregator — Technical Documentation

**Version:** 2.0 (SaaS)
**Audience:** Engineers, architects, DevOps, SREs
**Last updated:** 2026-07-08

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Next.js client)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Chat     │ │ Compare  │ │ Agents   │ │ Prompts  │ │ Team     │  │
│  │ tab      │ │ tab      │ │ tab      │ │ tab      │ │ /APIKeys │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
└───────┼────────────┼────────────┼────────────┼────────────┼─────────┘
        │            │            │            │            │
        ▼            ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Next.js 16 Route Handlers (server-side)                │
│  /api/auth/*   /api/org/*   /api/api-keys/*   /api/chat   /api/...  │
│  /api/v1/chat/completions   /api/v1/compare   /api/v1/agents/run    │
└───────┬────────────┬───────────────────────────────────┬────────────┘
        │            │                                   │
        ▼            ▼                                   ▼
┌──────────────┐  ┌──────────────────┐      ┌────────────────────────┐
│  Auth layer  │  │   Failover       │      │  Agent engine (ReAct)  │
│  (sessions,  │  │   engine         │      │  - tool registry       │
│   RBAC, API  │  │  runWithFailover │      │  - 8 templates         │
│   keys)      │  │  classifyError   │      │  - per-step failover   │
└──────┬───────┘  └────────┬─────────┘      └───────────┬────────────┘
       │                   │                            │
       │                   ▼                            │
       │          ┌──────────────────┐                  │
       │          │ Provider adapters│ ◄────────────────┘
       │          │  callProvider()  │
       │          │  OpenAI/Gemini/  │
       │          │  Claude (demo:   │
       │          │  z-ai-sdk)       │
       │          └────────┬─────────┘
       │                   │
       ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Prisma ORM (TypeScript)                       │
│  Organization, User, Membership, AuthSession, ApiKey, Provider,     │
│  ChatSession, Message, FailoverLog, HealthLog, AgentTask,           │
│  AgentStep, Prompt, FileUpload, ComparisonRun                       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
      SQLite (local dev)        PostgreSQL (Vercel prod)
      db/custom.db              Neon / Supabase / Vercel PG
```

---

## 2. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Latest stable, file-based routing, RSC, edge-ready |
| Language | TypeScript 5 (strict) | Type safety end-to-end |
| Styling | Tailwind CSS 4 + shadcn/ui | Consistent, accessible, themeable |
| ORM | Prisma 6 | Type-safe DB access, schema-first, migrations |
| Database | SQLite (dev) / PostgreSQL (prod) | Zero-friction local dev; prod-grade Postgres on Vercel |
| Auth | Custom (scrypt + opaque session tokens) | No external dependency; full control over revocation |
| AI SDK | z-ai-web-dev-sdk (demo mode) | Works without real OpenAI/Gemini/Claude keys |
| Deployment | Vercel (Next.js native) | Edge functions, automatic HTTPS, git-push-to-deploy |
| Package manager | Bun (faster install) + npm fallback | Vercel build image has both |

---

## 3. Database Schema

The schema is defined in two files kept in sync:
- `prisma/schema.prisma` — SQLite (local dev)
- `prisma/schema.postgres.prisma` — PostgreSQL (Vercel prod)

`vercel-build.sh` swaps the Postgres variant in before `prisma generate` runs.

### Models

**SaaS layer:**
- `Organization` — tenant. Fields: `id`, `name`, `slug` (unique), `plan`, `seatsTotal`, `seatsUsed`.
- `User` — `id`, `email` (unique), `name`, `passwordHash`.
- `Membership` — join table User ↔ Organization with `role`. Unique on `(userId, orgId)`.
- `AuthSession` — `id`, `userId`, `token` (unique), `expiresAt`. Indexed on `userId` and `expiresAt`.
- `ApiKey` — `id`, `orgId`, `name`, `keyPrefix` (first 16 chars), `keyHash` (SHA-256, unique), `scopes` (CSV), `lastUsedAt`, `revokedAt`.
- `Prompt` — `id`, `orgId`, `title`, `body`, `category`, `tags` (CSV), `createdBy`.
- `FileUpload` — `id`, `orgId`, `filename`, `contentType`, `sizeBytes`, `storageKey`, `uploadedBy`.
- `ComparisonRun` — `id`, `orgId`, `prompt`, `providerIds` (JSON), `results` (JSON).

**Core layer:**
- `Provider` — global registry. `name` (unique), `displayName`, `apiKey`, `models` (JSON string), `active`, `priority`.
- `ChatSession` — `id`, `orgId` (nullable for legacy), `title`. Indexed on orgId.
- `Message` — `id`, `sessionId`, `role`, `content`, `providerId`, `model`, `latencyMs`, `tokensUsed`, `failedOver`, `originalProviderId`.
- `FailoverLog` — `id`, `orgId`, `fromProviderId`, `toProviderId`, `reason`, `errorMessage`, `sessionId`. Indexed on `createdAt` and `(orgId, createdAt)`.
- `HealthLog` — `id`, `providerId`, `status`, `latencyMs`, `error`. Indexed on `(providerId, checkedAt)`.
- `AgentTask` — `id`, `orgId`, `title`, `goal`, `agentType`, `status`, `maxSteps`, `primaryProviderId`, `finalAnswer`, `failedOverCount`.
- `AgentStep` — `id`, `taskId`, `stepNumber`, `thought`, `action`, `actionInput` (JSON), `observation`, `providerId`, `failedOver`.

### Indexing strategy

- All org-scoped tables have `@@index([orgId, ...])` for efficient tenant queries.
- Time-series tables (HealthLog, FailoverLog) have `@@index([createdAt])` for the "recent events" UI queries.
- Agent steps are indexed on `(taskId, stepNumber)` for ordered retrieval.

---

## 4. Authentication & RBAC

### Password hashing

`src/lib/auth.ts → hashPassword(plaintext)` uses Node's built-in `scryptSync` with a 16-byte random salt and 64-byte key length. Stored format: `scrypt$<saltHex>$<hashHex>`. Verification uses `timingSafeEqual` to prevent timing attacks.

### Session tokens

On login, `createSession(userId)` generates a 32-byte random token (hex), stores it in `AuthSession` with a 30-day expiry, and sets it as an httpOnly cookie (`marq_session`). Every request reads the cookie, looks up the session, and validates the expiry. Expired sessions are deleted on access.

**Why opaque tokens (not JWTs)?** JWTs can't be revoked without a server-side blocklist. Opaque tokens let us delete the row for instant revocation on logout, password change, or admin force-logout.

### RBAC enforcement

Two helpers in `src/lib/auth.ts`:

```ts
// For session-cookie routes (UI):
export async function requireAuth(): Promise<AuthContext | NextResponse>
export async function requireRole(minRole: Role): Promise<AuthContext | NextResponse>

// For API-key routes (external API):
export async function authApiKey(req: NextRequest, scope: Scope): Promise<ApiKeyContext | NextResponse>
```

Every route handler calls one of these at the top. If the check fails, the helper returns a 401/403 NextResponse and the handler returns it immediately.

The role ladder is `viewer < member < admin < owner`. `hasMinRole(role, min)` checks it.

### Auth context resolution

`getAuthContext()` does:
1. Read `marq_session` cookie → look up `AuthSession` → include `User.memberships.org`.
2. Read `marq_org` cookie → if set, find the matching membership; else fall back to the user's first membership.
3. Return `{ user, org, role, membershipId }` or null.

This lets users with multiple org memberships switch orgs without re-logging in.

---

## 5. Failover Engine

`src/lib/failover.ts → runWithFailover(opts)`:

1. Takes an ordered list of providers (index 0 = primary) and the chat messages.
2. For each provider in order:
   - Call `callProvider(provider, req)` with a per-attempt timeout (default 15s, configurable).
   - On success: write a `HealthLog` row (status=healthy, latencyMs), return the result.
   - On failure: classify the error (`classifyError` maps status codes / message patterns to one of `timeout`, `rate_limit`, `auth_error`, `server_error`, `network`, `unknown`). Write a `HealthLog` row (status=degraded or down). If there's a next provider, write a `FailoverLog` row (`fromProviderId`, `toProviderId`, `reason`, `errorMessage`). Continue to the next iteration.
3. If all providers fail, throw an error.

**Key design choices:**
- Per-attempt timeout (not per-overall-request) so a slow primary doesn't eat the whole budget.
- HealthLog writes are fire-and-forget (`.catch(() => {})`) so a DB issue can't break the chat.
- FailoverLog writes are also best-effort but happen synchronously so the audit trail is correct.

---

## 6. Provider Abstraction

`src/lib/providers.ts → callProvider(provider, req)`:

```ts
export interface ProviderChatRequest {
  messages: ChatMessage[];
  model?: string;
  signal?: AbortSignal;
}
export interface ProviderChatResult {
  content: string;
  model: string;
  latencyMs: number;
  tokensUsed?: number;
}
```

Two execution paths:
- **Demo mode** (`provider.apiKey` is null): simulated per-provider latency (350-700ms base + jitter), simulated failure rates (Claude 18%, Gemini 8%, OpenAI 4%), routes the actual generation through `z-ai-web-dev-sdk`.
- **Real mode** (`provider.apiKey` is set): currently also routes through z-ai-sdk (with no simulated failure) but the function has a clear comment block showing how to swap in `fetch()` calls to OpenAI's `/v1/chat/completions` endpoint. The interface stays identical, so failover and the agent engine don't need to change.

---

## 7. Agent Engine (ReAct)

`src/lib/agent.ts → runAgentTask(opts)`:

1. Load the `AgentTask` row + its existing steps.
2. Mark the task `running`.
3. Load the system prompt: persona preamble (from template) + goal + tool descriptions + format instructions.
4. Loop up to `maxSteps`:
   a. Build the conversation: system prompt + scratchpad of prior (thought, action, observation) triples.
   b. Call `runWithFailover` with all active providers — **every LLM step gets failover**, so a primary failure mid-task is invisible to the agent.
   c. Parse the response into `Thought: ... / Action: ... / Action Input: {...}` or `Final Answer: ...`.
   d. If final answer: persist + break.
   e. Else: look up the tool in the registry, execute it, persist the step + observation, continue.
5. If the loop exits without a final answer, mark the task `failed`.

**Tool registry** (`src/lib/tools.ts`): 11 tools, each with a `name`, `description`, `inputSchema` (JSON Schema), and an async `execute(input)` function. Some tools are deterministic (`current_time`, `calculate_revenue`, `get_deploy_status`, `run_tests`); others call the LLM internally (`generate_code`, `parse_requirements`, `text_summary`).

**Template registry** (`src/lib/agent-templates.ts`): 8 templates, each pinning a `key`, `displayName`, persona preamble, default `maxSteps`, tool whitelist, and `suggestedGoals`.

---

## 8. Unified External API (`/api/v1/*`)

Designed to be **OpenAI-compatible** so existing OpenAI clients (LangChain, openai-python, curl one-liners) can point at Marq with minimal changes.

### Endpoints

| Path | Method | Auth | Body | Returns |
|---|---|---|---|---|
| `/api/v1/chat/completions` | POST | `chat` scope | `{ messages, provider?, session_id?, stream? }` | OpenAI ChatCompletion shape + `marq` extension |
| `/api/v1/compare` | POST | `compare` scope | `{ prompt, providers?, system_prompt? }` | `{ object: "marq.compare", results: [...] }` |
| `/api/v1/agents/run` | POST | `agents` scope | `{ goal, agent_type?, primary_provider?, max_steps? }` | `{ object: "marq.agent.run", final_answer, steps, stats }` |
| `/api/v1/models` | GET | `read` scope | — | OpenAI `/v1/models` shape |

### Auth

`Authorization: Bearer marq_live_<random>`. The token is SHA-256-hashed and looked up in `ApiKey.keyHash`. Scopes are checked. `lastUsedAt` is updated in the background.

### Marq extension

Every `/v1/chat/completions` response includes a `marq` field:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "choices": [...],
  "usage": {...},
  "marq": {
    "provider": { "id": "...", "name": "openai", "displayName": "OpenAI" },
    "originalProvider": null,
    "failedOver": false,
    "attempts": [{ "providerId": "...", "success": true, "latencyMs": 412 }],
    "latencyMs": 412,
    "sessionId": "..."
  }
}
```

This lets clients surface failover info in their own UIs without breaking OpenAI compatibility.

---

## 9. File Structure

```
marqaiaggregator/
├── prisma/
│   ├── schema.prisma              # SQLite (dev)
│   └── schema.postgres.prisma     # PostgreSQL (prod)
├── scripts/
│   ├── seed.ts                    # Seeds demo org/user + providers + sample agent tasks
│   ├── stress-chat.ts             # Stress-tests failover (15 messages, expect ~3 failovers)
│   └── stress-agent.ts            # Stress-tests agent failover (8 mixed agent tasks)
├── src/
│   ├── app/
│   │   ├── page.tsx               # Main UI (~2700 lines, 9 tabs)
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── auth/{signup,login,logout,me,switch-org}/route.ts
│   │       ├── org/{route.ts, members/route.ts}
│   │       ├── api-keys/{route.ts, [id]/route.ts}
│   │       ├── prompts/{route.ts, [id]/route.ts}
│   │       ├── files/{route.ts, [id]/route.ts}
│   │       ├── compare/route.ts
│   │       ├── chat/route.ts
│   │       ├── sessions/{route.ts, [id]/{route.ts, messages/route.ts}}
│   │       ├── providers/{route.ts, [id]/route.ts}
│   │       ├── failovers/route.ts
│   │       ├── agent/{tasks/{route.ts, [id]/route.ts}, templates/route.ts, tools/route.ts}
│   │       └── v1/{chat/completions, compare, agents/run, models}/route.ts
│   ├── components/
│   │   ├── auth-screen.tsx        # Login/signup
│   │   ├── org-panel.tsx          # Team management
│   │   ├── api-keys-panel.tsx     # API key CRUD
│   │   ├── compare-panel.tsx      # Multi-model comparison
│   │   ├── prompts-panel.tsx      # Prompt library
│   │   └── ui/                    # shadcn/ui primitives
│   └── lib/
│       ├── auth.ts                # Sessions, RBAC, API keys, password hashing
│       ├── db.ts                  # Prisma client (cached on globalThis)
│       ├── providers.ts           # callProvider + error classification
│       ├── failover.ts            # runWithFailover loop
│       ├── agent.ts               # ReAct engine
│       ├── agent-templates.ts     # 8 role templates
│       └── tools.ts               # 11-tool registry
├── docs/                          # 4 documentation files
├── wiki/                          # Same 4 docs, formatted for GitHub Wiki
├── vercel-build.sh                # Production build script (schema swap + prisma push + seed + next build)
├── vercel.json                    # Vercel config
└── package.json
```

---

## 10. Deployment

### Vercel

1. Push to GitHub `main` → Vercel auto-deploys.
2. `vercel-build.sh` runs:
   - Swap `schema.postgres.prisma` → `schema.prisma`
   - `npx prisma generate`
   - `npx prisma db push --accept-data-loss` (creates tables in Postgres)
   - `bun run scripts/seed.ts` (idempotent: creates demo org/user + 3 providers if missing)
   - `npx next build`
   - Restore SQLite schema (trap on exit)
3. Required env vars: `DATABASE_URL` (postgres://), optional `ZAI_API_KEY` for demo mode.
4. Build command (set in Vercel project settings): `bash ./vercel-build.sh`
5. Install command: `bun install`

### Local dev

```bash
bun install
bun run db:push        # creates SQLite tables
bun run seed           # seeds demo data
bun run dev            # starts on http://localhost:3000
```

Demo login: `demo@marq.ai` / `marq-demo-123`

---

## 11. Performance & Scaling

| Concern | Current | Mitigation |
|---|---|---|
| Cold starts | Vercel serverless functions cold-start ~200ms | Edge runtime not yet enabled (planned) |
| DB connection pool | Prisma client cached on `globalThis` | Works for serverless; for high-traffic consider Prisma Accelerate |
| Chat latency | Demo mode: 350-700ms + jitter | Real mode with OpenAI direct calls will be similar |
| Agent runtime | Up to 8 steps × 1-3s each = 8-24s typical | Vercel hobby 60s timeout fits; Pro 300s for long tasks |
| Failover overhead | Failed provider adds 0-15s (timeout) before next attempt | Tunable per-attempt timeout in `runWithFailover` |

---

## 12. Testing

- **Stress tests:** `scripts/stress-chat.ts` and `scripts/stress-agent.ts` exercise failover with simulated failure rates.
- **Type safety:** `npx tsc --noEmit` runs in CI; the build fails on any type error.
- **Manual smoke test:** After every deploy, hit `/api/providers`, `/api/auth/me`, `/api/v1/models` with a demo API key.

Missing (roadmap):
- Unit tests for `classifyError`, `hashPassword`, `runWithFailover`.
- Integration tests for the full chat → failover → log flow.
- E2E tests with Playwright.

---

## 13. Observability

Current:
- `console.log` / `console.error` in API routes — visible in Vercel function logs.
- `HealthLog` and `FailoverLog` tables provide per-provider reliability metrics.

Missing (roadmap):
- Structured logging (JSON to stdout for log aggregators).
- OpenTelemetry tracing.
- Alerting on provider-down events (Slack/email).
