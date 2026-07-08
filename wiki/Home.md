# Marq AI Aggregator — Wiki Home

Welcome to the Marq AI Aggregator documentation. Marq AI is a multi-tenant SaaS platform that unifies access to OpenAI, Google Gemini, and Anthropic Claude under one workspace, with automatic failover, role-based agents, model comparison, and an OpenAI-compatible unified API for external integrations.

## Documentation Index

| Document | Audience | What's inside |
|---|---|---|
| **[Functionality](Functionality)** | Product, business, sales | What the platform does: every feature, role, and module explained in business terms. Read this first if you're evaluating Marq AI. |
| **[Technical](Technical)** | Engineers, architects, DevOps | How it's built: architecture, data model, failover engine, agent engine, deployment, security posture, performance characteristics. |
| **[Developer](Developer)** | Engineers onboarding to the codebase; external integrators | How to extend the codebase: add routes, tabs, agents, tools. How to call the unified API from external software (curl/Python/Node). Local dev setup. |
| **[User SOPs](User-SOPs)** | All end users, team admins, API integrators | Step-by-step guides for every common task: sign up, invite team, send a chat, run an agent, generate an API key, integrate external software. |

## Quick Links

- **Live app:** https://marqaiaggregator.vercel.app
- **Source code:** https://github.com/maheshkpreddy/marqaiaggregator
- **Demo login:** `demo@marq.ai` / `marq-demo-123` (created automatically on every fresh deploy)

## What's New in v2.0 (SaaS)

This release adds the full multi-tenant SaaS layer on top of the v1.0 aggregator:

1. **Multi-user login** — email/password auth with scrypt hashing and 30-day sessions.
2. **Organizations** — each customer is a tenant with isolated data.
3. **Role-based access** — owner, admin, member, viewer roles per membership.
4. **Team management** — invite users, change roles, remove members, seat limits.
5. **Unified external API** — OpenAI-compatible `/api/v1/chat/completions`, `/api/v1/compare`, `/api/v1/agents/run`, `/api/v1/models` with API key auth and scoped permissions.
6. **API key management** — generate, name, scope, revoke. SHA-256 hashed at rest.
7. **Model comparison** — run one prompt across multiple models in parallel, side-by-side UI.
8. **Prompt library** — save reusable prompts in a team-shared library.
9. **File uploads** — attach documents to your workspace (25 MB per file).
10. **Org switcher** — users in multiple orgs can switch without re-logging in.

Plus all v1.0 features remain: auto-failover engine, 8 role-based agents, 11-tool registry, provider health monitoring, failover audit log.

## Getting Help

- Found a bug? Open an issue: https://github.com/maheshkpreddy/marqaiaggregator/issues
- Want to extend the platform? Read the [Developer guide](Developer) → "Adding a New API Route" / "Adding a New UI Tab" / "Adding a New Agent Template".
- Onboarding a new team member? Point them at the [User SOPs](User-SOPs) — start with SOP 1 (sign up) and SOP 3 (send a chat).
