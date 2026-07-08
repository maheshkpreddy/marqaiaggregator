# Marq AI Aggregator — Developer Documentation

**Version:** 2.0 (SaaS)
**Audience:** Frontend/backend engineers onboarding to the codebase; external integrators
**Last updated:** 2026-07-08

---

## 1. Quick Start (5 minutes)

```bash
# 1. Clone
git clone https://github.com/maheshkpreddy/marqaiaggregator.git
cd marqaiaggregator

# 2. Install
bun install   # or: npm install

# 3. Set up the DB
cp .env.example .env
bun run db:push         # creates SQLite tables in db/custom.db

# 4. Seed demo data
bun run seed            # creates demo org/user + 3 providers + sample agent tasks

# 5. Run
bun run dev             # http://localhost:3000

# 6. Log in
# email: demo@marq.ai
# password: marq-demo-123
```

---

## 2. Environment Variables

| Var | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | ✓ | `file:/home/z/my-project/db/custom.db` | SQLite (dev) or `postgres://...` (prod) |
| `ZAI_API_KEY` | optional | — | Used by demo-mode fallback when calling z-ai-web-dev-sdk |
| `VERCEL` | auto | — | Set by Vercel; gates `output: 'standalone'` in next.config |
| `VERCEL_ENV` | auto | — | `production` / `preview` / `development` |

`.env.example` is committed; `.env` is gitignored.

---

## 3. Database Workflow

### Schema changes

1. Edit BOTH `prisma/schema.prisma` (SQLite) AND `prisma/schema.postgres.prisma` (Postgres). They must stay in sync.
2. Run `bun run db:push` to apply to local SQLite.
3. Commit both schema files.
4. On Vercel push, `vercel-build.sh` swaps in the Postgres variant and runs `prisma db push` against the production DB.

**Never use `prisma migrate dev`** for this project — `db push` is simpler and the schema is small enough that we don't need migration history.

### Seed script

`scripts/seed.ts` is **idempotent**: it only creates rows that don't already exist. Safe to run on every deploy. The Vercel build script runs it automatically.

To re-seed from scratch locally:
```bash
rm db/custom.db
bun run db:push
bun run seed
```

---

## 4. Adding a New API Route

### Pattern (session-authenticated, org-scoped)

```ts
// src/app/api/widgets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const ctx = await requireRole("viewer");   // minimum role
  if (ctx instanceof NextResponse) return ctx;

  const widgets = await db.widget.findMany({
    where: { orgId: ctx.org.id },             // ALWAYS scope by orgId
  });
  return NextResponse.json({ widgets });
}

export async function POST(req: NextRequest) {
  const ctx = await requireRole("member");    // writes need >= member
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const widget = await db.widget.create({
    data: { orgId: ctx.org.id, ...body },     // ALWAYS set orgId
  });
  return NextResponse.json({ widget }, { status: 201 });
}
```

### Pattern (API-key authenticated, for external API)

```ts
// src/app/api/v1/widgets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authApiKey } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await authApiKey(req, "widgets");  // require 'widgets' scope
  if (auth instanceof NextResponse) return auth;

  // auth.orgId, auth.orgName, auth.apiKeyId, auth.scopes available
  const widget = await db.widget.create({
    data: { orgId: auth.orgId, ... },
  });
  return NextResponse.json({ widget });
}
```

### Checklist for a new route

- [ ] Calls `requireRole()` or `authApiKey()` at the top — no exceptions.
- [ ] Every DB query includes `where: { orgId: ctx.org.id }` (or `auth.orgId`).
- [ ] Write operations (POST/PATCH/DELETE) require `member` minimum.
- [ ] Admin operations (managing members, API keys, providers) require `admin`.
- [ ] Returns JSON with a meaningful error shape: `{ error: string, detail?: string }`.
- [ ] Status codes: 200 (ok), 201 (created), 400 (bad request), 401 (unauth), 403 (forbidden), 404 (not found), 409 (conflict), 502 (upstream failure).

---

## 5. Adding a New UI Tab

### Step 1: Create the panel component

```tsx
// src/components/widgets-panel.tsx
"use client";

import { useState, useEffect } from "react";
// ... shadcn/ui imports

export function WidgetsPanel() {
  const [widgets, setWidgets] = useState([]);
  useEffect(() => {
    fetch("/api/widgets").then(r => r.json()).then(d => setWidgets(d.widgets ?? []));
  }, []);
  return <div>...</div>;
}
```

### Step 2: Register the tab in `src/app/page.tsx`

1. Add the tab key to the `tab` state type:
   ```ts
   const [tab, setTab] = useState<"chat" | ... | "widgets">("chat");
   ```
2. Add a `<TabsTrigger value="widgets">` in the header `<TabsList>`.
3. Add a `<TabsContent value="widgets">` in the main `<Tabs>` with `<WidgetsPanel />` inside.

### Step 3: Tab triggers refresh

If your tab needs data refresh on focus, add it to the `useEffect` that watches `tab`:

```ts
useEffect(() => {
  if (tab === "widgets") loadWidgets();
}, [tab]);
```

---

## 6. Adding a New Agent Template

1. Edit `src/lib/agent-templates.ts`:
   ```ts
   export const AGENT_TEMPLATES: AgentTemplate[] = [
     // ...existing
     {
       key: "data_scientist",
       displayName: "Data Scientist",
       tagline: "Statistics, ML, data cleaning",
       description: "...",
       icon: "BarChart",
       color: "#3b82f6",
       category: "Engineering",
       defaultMaxSteps: 10,
       tools: ["web_search", "calculator", "text_summary"],  // must match tool registry
       personaPreamble: "You are a Data Scientist agent...",
       suggestedGoals: [
         "Analyze this dataset and report outliers...",
         "Build a regression model for...",
       ],
     },
   ];
   ```
2. Add an icon mapping in `TemplateIcon` (in `src/app/page.tsx`).
3. Add the template key to the `TabsTrigger`/`TabsList` of agent types in the Agent panel.

The `TEMPLATE_KEYS` and `TEMPLATE_MAP` exports auto-update; the `/api/agent/templates` endpoint picks them up automatically.

---

## 7. Adding a New Tool

1. Edit `src/lib/tools.ts`:
   ```ts
   registerTool({
     name: "query_database",
     description: "Run a read-only SQL query against the org's analytics warehouse.",
     inputSchema: {
       type: "object",
       properties: {
         sql: { type: "string", description: "SELECT query" },
       },
       required: ["sql"],
     },
     async execute(input) {
       // input is already validated against inputSchema
       const rows = await runQuery(input.sql);
       return { ok: true, rows };
     },
   });
   ```
2. Add the tool name to the `tools` whitelist of any agent template that should be allowed to use it.
3. The `/api/agent/tools` endpoint auto-lists all registered tools.

**Security:** Tools receive their input as a parsed JS object (already JSON-validated). For tools that interact with the filesystem or external services, always validate input carefully and run with least privilege.

---

## 8. Calling the Unified API (External Integrator Guide)

### Get an API key

1. Sign in to the Marq UI.
2. Go to the **API Keys** tab (requires admin role).
3. Click "New key", name it, select scopes (`chat`, `compare`, `agents`, `read`).
4. Copy the full `marq_live_...` token. **It's only shown once.**

### Chat (OpenAI-compatible)

```bash
curl https://marqaiaggregator.vercel.app/api/v1/chat/completions \
  -H "Authorization: Bearer marq_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is the capital of France?"}
    ]
  }'
```

Response (OpenAI shape + `marq` extension):
```json
{
  "id": "chatcmpl-cmrb...",
  "object": "chat.completion",
  "created": 1783475539,
  "model": "gpt-4o-mini",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "Paris."},
    "finish_reason": "stop"
  }],
  "usage": {"prompt_tokens": 25, "completion_tokens": 2, "total_tokens": 27},
  "marq": {
    "provider": {"id": "...", "name": "openai", "displayName": "OpenAI"},
    "originalProvider": null,
    "failedOver": false,
    "attempts": [{"providerId": "...", "success": true, "latencyMs": 412}],
    "latencyMs": 412,
    "sessionId": "cmrb..."
  }
}
```

### Pin a specific provider

Add `"provider": "claude"` to the request body. The named provider becomes the primary; others remain as failover candidates.

### Use the openai-python SDK

```python
from openai import OpenAI

client = OpenAI(
    api_key="marq_live_...",
    base_url="https://marqaiaggregator.vercel.app/api/v1"
)

response = client.chat.completions.create(
    model="marq-default",  # ignored — Marq picks per-provider
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
print(response.marq.failed_over)  # bool — did failover occur?
```

### Compare models

```bash
curl https://marqaiaggregator.vercel.app/api/v1/compare \
  -H "Authorization: Bearer marq_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain CAP theorem in one paragraph.",
    "providers": ["openai", "gemini", "claude"]
  }'
```

### Run an agent

```bash
curl https://marqaiaggregator.vercel.app/api/v1/agents/run \
  -H "Authorization: Bearer marq_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Project MRR for 100 subscribers at $49 ARPU, 5% monthly churn, 6 months.",
    "agent_type": "sales",
    "max_steps": 5
  }'
```

---

## 9. Local Development Tips

### Reset the database

```bash
rm db/custom.db
bun run db:push
bun run seed
```

### Run the stress tests

```bash
bun run dev &              # in another terminal
bun run scripts/stress-chat.ts
bun run scripts/stress-agent.ts
```

Expected output: stress-chat runs 15 messages, expect ~3 failovers. stress-agent runs 8 mixed agent tasks, reports per-task failover count.

### Type check

```bash
npx tsc --noEmit
```

### Production build (simulates Vercel)

```bash
VERCEL=1 npx next build
```

This skips the `output: 'standalone'` config (which conflicts with Vercel) and runs the build exactly as Vercel would.

### Debug an API route

Add `console.log(JSON.stringify(ctx, null, 2))` at the top of the route handler after `requireRole`. The output appears in the terminal where `bun run dev` is running.

---

## 10. Git Workflow

- `main` is the deployable branch. Pushes to `main` auto-deploy to Vercel.
- For features: branch off `main`, open a PR, get review, squash-merge.
- Commit message convention: `type(scope): subject` (e.g. `feat(auth): add session revocation on password change`).
- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`.

---

## 11. Vercel Deployment Troubleshooting

### "Command bash ./vercel-build.sh exited with 1"

Check the build log for the specific step that failed. The script prints `✓` for each successful step and `❌` for failures.

Common causes:
- `DATABASE_URL` not set → script exits at the sanity check.
- `DATABASE_URL` is not a `postgres://` string → same.
- `prisma db push` fails → tables may already exist with conflicting schema; the script warns but continues.
- `next build` fails → check for TypeScript errors locally with `npx tsc --noEmit`.

### Cold start latency

Vercel serverless functions have ~200ms cold starts. For the chat endpoint, this is on top of provider latency. To reduce: upgrade to Vercel Pro (which keeps functions warm longer) or migrate to edge functions (roadmap).

### Database connection limits

Neon free tier: 100 concurrent connections. Prisma's serverless adapter handles pooling. If you hit limits, enable Prisma Accelerate or upgrade Neon.

---

## 12. Code Style

- **TypeScript:** strict mode, `noImplicitAny: false` (allows `any` for untyped third-party APIs but discourages it).
- **React:** function components with hooks. No class components. No PropTypes (TypeScript covers it).
- **Styling:** Tailwind utility classes. No CSS modules. Custom colors via `tailwind.config.ts`.
- **Imports:** `@/lib/...` for src/lib, `@/components/...` for src/components. Relative imports only within the same feature folder.
- **Naming:** `camelCase` for vars/functions, `PascalCase` for types/components, `SCREAMING_SNAKE_CASE` for constants.
- **Error handling:** always wrap `await` in try/catch at the route boundary; throw `ProviderError` for classified failures in the failover path.

---

## 13. Where to Look When...

| You want to... | Look at |
|---|---|
| Understand the failover loop | `src/lib/failover.ts` |
| Add a new AI provider | `src/lib/providers.ts` + seed script |
| Add a new agent persona | `src/lib/agent-templates.ts` |
| Add a new tool | `src/lib/tools.ts` |
| Change the RBAC rules | `src/lib/auth.ts` (`hasMinRole`) |
| Add a new SaaS route | `src/app/api/.../route.ts` + the patterns in §4 |
| Change the database schema | `prisma/schema.prisma` AND `prisma/schema.postgres.prisma` |
| Debug a production issue | Vercel → Project → Deployments → Logs |
| Add a UI tab | `src/components/<name>-panel.tsx` + `src/app/page.tsx` |
| Update docs | `docs/` (this directory) + `wiki/` (GitHub Wiki mirror) |
