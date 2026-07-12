# Marq AI Aggregator — SaaS Platform & Unified API

**Version:** 3.0
**Audience:** CTOs, integration engineers, third-party product teams, corporate IT
**Last updated:** 2026-07-12

---

## 1. Executive summary

Marq AI Aggregator is a **multi-tenant SaaS platform** that gives corporates and
third-party products a single, reliable, OpenAI-compatible gateway to 60+ AI
providers — OpenAI, Anthropic, Google Gemini, xAI Grok, Zai, Mistral, DeepSeek,
Qwen, Llama, Ollama, vLLM, Hugging Face, and many more (see the in-product
**AI Directory** tab for the full catalog).

The platform is sold as a service: each corporate tenant gets an isolated
workspace (organization), team members with role-based access, configurable
AI providers (bring-your-own-keys or use the platform's shared pool), and a
**unified API** that lets any OpenAI-compatible client talk to every model
through one endpoint.

**Key value props:**

| Pillar | What it means |
|---|---|
| **One API, every model** | Replace 10 SDK integrations with one. Switch providers without code changes. |
| **Automatic failover** | If your primary model 429s or 5xxs, requests route to the next provider in priority — zero user-visible downtime. |
| **Multi-tenant by design** | Per-org isolation, per-tenant API keys, per-tenant rate limits and usage tracking. |
| **Side-by-side comparison** | Run the same prompt across N providers in parallel; judge latency, quality, cost. |
| **Role-based agents** | 147 pre-built agent templates (researcher, coder, analyst, etc.) with tool use. |
| **Self-hostable** | Open source (MIT-licensed core). Deploy to Vercel + Neon in 10 minutes, or run on your own VPC. |

---

## 2. SaaS architecture

```
                          ┌──────────────────────────────────────┐
                          │       Corporate tenant (org)         │
                          │  ┌────────────┐  ┌────────────────┐  │
                          │  │  Members   │  │  API keys      │  │
                          │  │ (RBAC)     │  │  (marq_…)      │  │
                          │  └────────────┘  └────────────────┘  │
                          │  ┌────────────────────────────────┐  │
                          │  │   Per-tenant rate limits       │  │
                          │  │   Per-tenant usage tracking    │  │
                          │  └────────────────────────────────┘  │
                          └──────────────────────────────────────┘
                                       │
                                       ▼
            ┌────────────────────────────────────────────────────┐
            │              Marq AI Aggregator                     │
            │                                                     │
            │   ┌─────────────┐   ┌───────────┐   ┌───────────┐  │
            │   │ /api/v1/*   │   │ /api/*    │   │  Web UI   │  │
            │   │ (SaaS API)  │   │ (internal)│   │ (Next.js) │  │
            │   └─────────────┘   └───────────┘   └───────────┘  │
            │                                                     │
            │   ┌─────────────────────────────────────────────┐   │
            │   │     Provider router + failover engine        │   │
            │   │     (priority chain, circuit breakers)       │   │
            │   └─────────────────────────────────────────────┘   │
            │                                                     │
            │   ┌─────────────────────────────────────────────┐   │
            │   │     PostgreSQL (Neon / Supabase)             │   │
            │   │     Users · Orgs · Providers · Sessions ·    │   │
            │   │     Failovers · ComparisonRuns · ApiKeys     │   │
            │   └─────────────────────────────────────────────┘   │
            └────────────────────────────────────────────────────┘
                                       │
                       ┌───────────────┼───────────────┐
                       ▼               ▼               ▼
                  ┌─────────┐     ┌─────────┐     ┌─────────┐
                  │ OpenAI  │     │ Claude  │     │ Gemini  │  … 60+ providers
                  └─────────┘     └─────────┘     └─────────┘
```

### 2.1 Multi-tenancy model

Every DB row carries an `orgId`. The `requireRole()` server-side helper
enforces **both** authentication and org membership on every request. A
tenant can never read or write another tenant's data — even if they
guessed the row ID.

| Resource | Isolation level |
|---|---|
| Users | A user can belong to multiple orgs (memberships). Each session has one active org. |
| Providers | Per-org. Each tenant configures their own providers + API keys. |
| Sessions / messages | Per-org. Chat history is isolated. |
| API keys | Per-org. Keys are scoped to one org; rotation is independent. |
| Prompts | Per-org prompt library. |
| Agent templates | Shared library + per-org overrides. |
| Failover log | Per-org. |
| Analytics | Per-org (with optional cross-org rollup for platform admins). |

### 2.2 Role-based access control (RBAC)

| Role | Capabilities |
|---|---|
| **Owner** | Everything. Can delete the org, transfer ownership, manage billing. |
| **Admin** | Everything except org deletion / billing. Can manage members and API keys. |
| **Member** | Use chat, compare, agents, prompts. Cannot manage providers or members. |
| **Viewer** | Read-only access to chat history, analytics, and health. |

### 2.3 Rate limiting & quotas

Per-tenant rate limits are configurable per API key:

| Tier | Requests/day | Requests/min | Notes |
|---|---|---|---|
| **Free** | 100 | 10 | Evaluation only. |
| **Team** | 10,000 | 60 | Production use. |
| **Enterprise** | Custom | Custom | Dedicated infra + SLA. |

Rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset`) are returned on every `/api/v1/*` response.

---

## 3. Unified API (`/api/v1/*`)

The unified API is **OpenAI-compatible** — any client that speaks OpenAI
can talk to Marq AI without code changes. Just change the `baseURL` and
the `apiKey`.

### 3.1 Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/chat/completions` | OpenAI-compatible chat (with auto-failover) |
| `POST` | `/api/v1/compare` | Run one prompt across N providers in parallel |
| `POST` | `/api/v1/agents/run` | Start an agent task |
| `GET`  | `/api/v1/agents/{taskId}` | Poll agent task status |
| `GET`  | `/api/v1/models` | List models available to this tenant |

### 3.2 Authentication

Every request must include:

```
Authorization: Bearer marq_xxxxxxxxxxxxxxxxxxxxxxxx
```

API keys are issued under **Settings → API Keys** in the web UI. Keys
are 32-byte random, prefixed `marq_`, and stored hashed (only shown once
at creation time).

### 3.3 Quick start — drop-in OpenAI replacement

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "marq_xxxxxxxxxxxxxxxxxxxxxxxx",
  baseURL: "https://your-marq-domain.com/api/v1",
});

const res = await client.chat.completions.create({
  model: "auto",  // or "gpt-4o", "claude-sonnet-4-5", "gemini-2.0-flash", etc.
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user",   content: "Explain the CAP theorem in one line." },
  ],
});

console.log(res.choices[0].message.content);
console.log(res.headers["x-provider-used"]);  // "openai" | "anthropic" | ...
```

### 3.4 Model routing

The `model` field accepts:

| Value | Behavior |
|---|---|
| `"auto"` | Server picks the healthiest provider; failover chain applies. |
| `"gpt-4o"` (or any specific model) | Server routes to the provider that exposes this model; failover applies only between providers exposing the same model. |
| `"openai/gpt-4o"` (provider-prefixed) | Forces the specific provider; no failover. |

### 3.5 Comparison API

```bash
curl -X POST https://your-marq-domain.com/api/v1/compare \
  -H "Authorization: Bearer marq_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain CAP theorem.",
    "systemPrompt": "You are concise.",
    "providerIds": ["provider-1", "provider-2", "provider-3"]
  }'
```

Returns one result per provider with content, latency, tokens, and
error (if any). No failover — each provider returns its raw output for
comparison.

### 3.6 Agent API

```bash
# Start an agent task
curl -X POST https://your-marq-domain.com/api/v1/agents/run \
  -H "Authorization: Bearer marq_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "researcher",
    "input": "Summarize Q3 2025 AI infra market trends"
  }'

# Response: { "taskId": "task_abc123", "status": "queued" }

# Poll for completion
curl https://your-marq-domain.com/api/v1/agents/task_abc123 \
  -H "Authorization: Bearer marq_xxxxxxxx"
```

### 3.7 Response headers

Every `/api/v1/*` response includes:

| Header | Description |
|---|---|
| `X-Provider-Used` | Which provider actually served the request (post-failover). |
| `X-Failover-Count` | Number of providers tried before success. `0` = primary succeeded. |
| `X-RateLimit-Limit` | Requests/min allowed for this key. |
| `X-RateLimit-Remaining` | Requests remaining in current window. |
| `X-RateLimit-Reset` | Epoch seconds until the window resets. |

---

## 4. Integration patterns

### 4.1 Corporate CRM / internal tool

A corporate CRM can replace its OpenAI integration with Marq AI by
changing only the `baseURL` and `apiKey`. All existing prompts,
function-calling, and streaming continue to work. The CRM gets
multi-model failover for free.

### 4.2 Third-party SaaS product

A SaaS product that wants to offer AI features without coupling to a
single provider integrates with Marq AI's unified API. Each of the
SaaS's customers gets a Marq org + API key; the SaaS passes the
customer's key in the `Authorization` header. Per-tenant isolation is
enforced server-side.

### 4.3 Edge / IoT

For edge devices that can't run a full LLM, Marq AI acts as the cloud
backend. The device calls `/api/v1/chat/completions` with `model:
"auto"`; Marq picks the cheapest healthy provider and returns the
result. Failover prevents outages when a provider goes down.

### 4.4 On-premise with local models

Self-host Marq AI in your VPC. Configure Ollama / vLLM / LocalAI as
providers. Your internal apps hit your private Marq deployment — no
data leaves your network. Add external providers (OpenAI, Claude) as
fallbacks for when local capacity is exceeded.

---

## 5. SLA & support

| Tier | Uptime SLA | Support | Onboarding |
|---|---|---|---|
| Free | Best-effort | Community | Self-serve |
| Team | 99.5% | Email, 1 business day | Self-serve + docs |
| Enterprise | 99.95% | Slack channel, 1 hour | White-glove + training |

---

## 6. Roadmap

- **Q3 2025:** Streaming for `/api/v1/chat/completions` (SSE).
- **Q3 2025:** Per-key usage quotas (monthly cap, hard or soft).
- **Q4 2025:** Webhook callbacks for agent task completion.
- **Q4 2025:** BYOK (bring-your-own-key) for tenants who want to use their own provider keys.
- **Q1 2026:** Multi-region deployment (US, EU, APAC).
- **Q1 2026:** Audit log export (SIEM integration).

---

## 7. Contact

- **Sales:** sales@marq.ai
- **Support:** support@marq.ai
- **Security:** security@marq.ai
- **Docs:** In-product **Docs** tab, or `/docs` on GitHub.
