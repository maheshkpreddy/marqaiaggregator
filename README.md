# Marq AI Aggregator Platform

A unified AI gateway that connects **OpenAI**, **Google Gemini**, and **Anthropic Claude** under one workspace with automatic **failover**. When one provider goes down, Marq seamlessly routes your request to the next provider in your priority chain.

Use Marq as the **backup plan** for any AI-powered application — point your app at a single endpoint and never worry about a single provider outage again.

![Marq AI](https://img.shields.io/badge/Marq-AI%20Aggregator-10b981?style=for-the-badge)
![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2d3748?style=for-the-badge&logo=prisma)

---

## Features

- **Unified Chat API** — One endpoint, every model. `POST /api/chat` with `{ message, primaryProviderId?, model? }`.
- **Automatic Failover** — Tries providers in priority order. If the primary fails (timeout, rate limit, server error, auth, network), Marq falls over to the next and logs the transition.
- **Provider Management UI** — Add, edit, enable/disable, reorder, and configure API keys for any AI provider.
- **Health Dashboard** — Live status, latency, last error, and 24h failover metrics for every provider.
- **Failover Log** — Every failover event with from→to providers, reason, error message, and timestamp.
- **Multi-session Chat** — Conversation history with per-session provider attribution.

---

## Quick Start (Local Dev)

```bash
# 1. Install dependencies
bun install

# 2. Set up the database (SQLite, zero-config)
bun run db:push

# 3. Seed default providers (OpenAI, Gemini, Claude)
bun run scripts/seed.ts

# 4. Start dev server
bun run dev
```

Open `http://localhost:3000`.

Without any real API keys configured, Marq runs in **demo mode**: every provider routes through `z-ai-web-dev-sdk` with per-provider personality, simulated latency, and a small failure rate so you can watch the failover engine actually trigger.

To switch to live mode, open the **Providers** tab and paste in your real OpenAI / Gemini / Claude API keys.

---

## Deploy to Vercel

Vercel's serverless functions run on a read-only filesystem, so the local SQLite file doesn't work in production. Marq uses **PostgreSQL** in production via the included `vercel-build.sh` script which automatically swaps in the Postgres schema at build time.

### Step 1 — Create a Postgres database

Pick any hosted Postgres provider:

| Provider | Free tier? | Notes |
|----------|-----------|-------|
| [Neon](https://neon.tech) | ✅ Yes | Recommended. Serverless Postgres, generous free tier. |
| [Supabase](https://supabase.com) | ✅ Yes | Postgres + auth + storage. |
| [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) | ✅ Yes | Native Vercel integration. |

Create a project and copy the `postgres://…` connection string.

### Step 2 — Import the GitHub repo

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import the GitHub repo: `maheshkpreddy/marqaiaggregator`.
3. Vercel auto-detects Next.js. **Do not change the Build Command** — `vercel.json` already points it to `bash ./vercel-build.sh`.

### Step 3 — Set environment variables

In **Vercel → Project Settings → Environment Variables**, add:

| Name | Value | Required |
|------|-------|----------|
| `DATABASE_URL` | `postgres://user:pass@host/db?sslmode=require` | ✅ Yes |
| `ZAI_API_KEY` | (your z-ai-web-dev-sdk key, optional — only for demo mode) | ⛔ Optional |

### Step 4 — Deploy

Click **Deploy**. The build script will:

1. Swap in `prisma/schema.postgres.prisma`
2. Run `prisma generate` (Postgres client)
3. Run `prisma db push` (creates tables in your Postgres)
4. Seed default providers + welcome session
5. Run `next build`
6. Restore the SQLite schema for local dev continuity

Once deployed, open the app, go to **Providers**, and paste your real OpenAI / Gemini / Claude API keys to switch from demo mode to live mode.

---

## API Reference

### `POST /api/chat` — Unified chat with failover

```typescript
// Request
{
  "message": "Hello!",
  "sessionId": "clxxxx...",       // optional — creates a new session if omitted
  "primaryProviderId": "clxxxx",  // optional — defaults to priority order
  "model": "gpt-4o"               // optional — defaults to provider's first model
}

// Response
{
  "message": {
    "id": "msg_xxx",
    "role": "assistant",
    "content": "Hi! How can I help?",
    "latencyMs": 1240,
    "tokensUsed": 32,
    "failedOver": false,
    "createdAt": "2026-07-08T..."
  },
  "provider": { "id": "...", "name": "openai", "displayName": "OpenAI", "color": "#10a37f" },
  "originalProvider": null,       // populated if failover happened
  "model": "gpt-4o-mini",
  "attempts": [                   // every provider tried, in order
    { "providerId": "...", "providerName": "OpenAI", "success": true, "latencyMs": 1240 }
  ],
  "failedOver": false,
  "sessionId": "clxxxx..."
}
```

### Other endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/providers` | List all providers with live status |
| `POST` | `/api/providers` | Add a new provider |
| `PATCH` | `/api/providers/[id]` | Update a provider (name, key, priority, active, etc.) |
| `DELETE` | `/api/providers/[id]` | Remove a provider |
| `GET` | `/api/sessions` | List all chat sessions |
| `POST` | `/api/sessions` | Create a new session |
| `DELETE` | `/api/sessions/[id]` | Delete a session |
| `GET` | `/api/sessions/[id]/messages` | Get all messages in a session |
| `GET` | `/api/failovers?limit=50` | Recent failover events |
| `POST` | `/api/chat` | Unified chat with failover |

---

## Project Structure

```
├── prisma/
│   ├── schema.prisma              # SQLite schema (local dev)
│   └── schema.postgres.prisma     # PostgreSQL schema (Vercel production)
├── scripts/
│   ├── seed.ts                    # Seeds OpenAI / Gemini / Claude defaults
│   └── stress-chat.ts             # Sends N messages to exercise failover
├── src/
│   ├── app/
│   │   ├── api/                   # All REST endpoints
│   │   │   ├── chat/route.ts
│   │   │   ├── providers/
│   │   │   ├── sessions/
│   │   │   └── failovers/
│   │   ├── layout.tsx
│   │   └── page.tsx               # Full single-page UI (4 tabs)
│   └── lib/
│       ├── db.ts                  # Prisma client (cached on globalThis)
│       ├── providers.ts           # Provider adapters + error classification
│       └── failover.ts            # Failover engine
├── vercel-build.sh                # Vercel build: swaps schema + prisma push + seed
├── vercel.json                    # Vercel config
├── .env.example                   # Template for env vars
└── package.json
```

---

## How Failover Works

1. You send a message via `POST /api/chat`.
2. Marq loads all **active** providers, ordered by `priority` (lower = tried first).
3. For each provider, in order:
   - Calls `callProvider()` (with a 20-second timeout).
   - On success → returns the response, logs a `healthy` health check.
   - On failure → classifies the error (`timeout`, `rate_limit`, `auth_error`, `server_error`, `network`), logs a `degraded`/`down` health check, records a `FailoverLog` entry, and tries the next provider.
4. Returns the first successful response along with the full `attempts[]` array so the UI can show the path the request took.

Error classification lives in `src/lib/providers.ts` — extend `classifyError()` if you need to recognize new patterns.

---

## Going to Production with Real API Keys

The included `src/lib/providers.ts` has the structure for real provider SDK calls but currently routes through `z-ai-web-dev-sdk` so the platform runs end-to-end in the sandbox. To use real OpenAI / Gemini / Claude APIs:

1. `bun add openai @google/generative-ai @anthropic-ai/sdk`
2. Edit `realModeCall()` in `src/lib/providers.ts`:
   ```typescript
   if (provider.name === "openai") {
     const openai = new OpenAI({ apiKey: provider.apiKey! });
     const res = await openai.chat.completions.create({
       model: req.model || "gpt-4o-mini",
       messages: req.messages,
     });
     return {
       content: res.choices[0].message.content ?? "",
       model: res.model,
       latencyMs: Date.now() - start,
       tokensUsed: res.usage?.total_tokens,
     };
   }
   // …similar for gemini / claude
   ```
3. Set real API keys via the **Providers** tab UI — they're stored in the `Provider.apiKey` column.

---

## License

MIT
