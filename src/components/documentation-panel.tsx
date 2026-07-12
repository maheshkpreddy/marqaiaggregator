"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Code2, Settings2, Workflow, Server, Shield, Key, Users,
  GitCompare, MessageSquare, Brain, BookMarked, Network, Activity,
  Zap, Cpu, Lock, Globe, Layers, Database, ArrowRight, CheckCircle2,
  Terminal, FileText, Box, ExternalLink,
} from "lucide-react";

type DocSection = "overview" | "functional" | "technical" | "sop" | "saas";

/**
 * DocumentationPanel
 *
 * In-product documentation covering:
 *  - Functional overview (what each module does)
 *  - Technical architecture (stack, data flow, API design)
 *  - SOPs (standard operating procedures for common tasks)
 *  - SaaS / unified API integration guide (for corporates & 3rd parties)
 *
 * The same content is mirrored in the repo as /docs/*.md files so the
 * docs stay in sync whether you read them in-app or on GitHub.
 */
export function DocumentationPanel() {
  const [section, setSection] = useState<DocSection>("overview");

  const sections: { id: DocSection; label: string; icon: typeof BookOpen }[] = [
    { id: "overview",  label: "Overview",            icon: BookOpen },
    { id: "functional", label: "Functional Spec",    icon: Workflow },
    { id: "technical",  label: "Technical Spec",     icon: Code2 },
    { id: "sop",        label: "SOPs",               icon: FileText },
    { id: "saas",       label: "SaaS Unified API",   icon: Globe },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-emerald-500" />
          <h1 className="text-2xl font-bold tracking-tight">Documentation</h1>
          <Badge variant="secondary" className="ml-1">v1.0</Badge>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
          Complete technical, functional, and operating documentation for the Marq AI
          Aggregator SaaS platform. Use the left rail to jump between sections. The
          same content lives in <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs">/docs</code> on GitHub.
        </p>
      </div>

      <div className="grid md:grid-cols-[200px_1fr] gap-6">
        {/* Section nav */}
        <nav className="space-y-1 md:sticky md:top-4 md:self-start">
          {sections.map((s) => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  active
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="min-w-0 space-y-6">
          {section === "overview"  && <OverviewSection />}
          {section === "functional" && <FunctionalSection />}
          {section === "technical"  && <TechnicalSection />}
          {section === "sop"        && <SopSection />}
          {section === "saas"       && <SaasSection />}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// OVERVIEW
// ──────────────────────────────────────────────────────────────
function OverviewSection() {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-500" />What is Marq AI?</CardTitle>
          <CardDescription>
            Marq AI is a multi-tenant SaaS platform that aggregates 60+ AI providers (OpenAI,
            Anthropic, Gemini, Grok, Zai, Ollama, vLLM, Hugging Face, and more) behind a
            single unified, OpenAI-compatible API. It is designed for corporates and
            third-party products that want one reliable gateway to every model — with
            automatic failover, side-by-side comparison, role-based access, and per-tenant
            API keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <StatCard label="AI providers integrated" value="60+" icon={Network} accent="text-violet-500" />
            <StatCard label="Auto-failover chain" value="∞ depth" icon={Zap} accent="text-amber-500" />
            <StatCard label="OpenAI-compatible API" value="/v1/*" icon={Code2} accent="text-emerald-500" />
            <StatCard label="Role-based access" value="4 roles" icon={Shield} accent="text-blue-500" />
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Core capabilities</h4>
            <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />Route a single prompt to a primary provider; if it errors or times out, fall over to the next in priority — automatically.</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />Run the same prompt across N providers in parallel and compare outputs, latency, and token usage side-by-side.</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />Run role-based agents (researcher, coder, analyst, etc.) with tool use and persistent sessions.</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />Per-tenant API keys scoped to a single organization, with usage tracking and revocation.</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />Live health monitoring, circuit breakers, and a failover log for post-mortems.</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />Self-hostable or deployable to Vercel + Neon Postgres in under 10 minutes.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module map</CardTitle>
          <CardDescription>The product is organized into four functional modules plus a settings area.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            <ModuleCard icon={MessageSquare} title="Chat" desc="Conversational interface with sessions, Auto mode, and failover." color="#10b981" />
            <ModuleCard icon={GitCompare} title="Compare" desc="Run one prompt across N providers in parallel." color="#8b5cf6" />
            <ModuleCard icon={Brain} title="Agent" desc="Role-based agents with tool use and persistent sessions." color="#f59e0b" />
            <ModuleCard icon={BookMarked} title="Prompts" desc="Reusable prompt library with templating." color="#06b6d4" />
            <ModuleCard icon={Network} title="AI Directory" desc="Catalog of all 60+ integrated AIs with metadata." color="#ec4899" />
            <ModuleCard icon={Settings2} title="Settings · AI" desc="Configure providers, API keys, priorities." color="#3b82f6" />
            <ModuleCard icon={Activity} title="Settings · Health" desc="Live status, failover log, circuit breakers." color="#ef4444" />
            <ModuleCard icon={Users} title="Settings · Team" desc="Members, roles, organizations." color="#14b8a6" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// FUNCTIONAL SPEC
// ──────────────────────────────────────────────────────────────
function FunctionalSection() {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Workflow className="w-5 h-5 text-violet-500" />Functional Specification</CardTitle>
          <CardDescription>What each module does, who uses it, and what it must support.</CardDescription>
        </CardHeader>
      </Card>

      <FuncBlock
        icon={MessageSquare} color="#10b981" name="Chat" group="Build"
        purpose="Primary conversational interface. Auto-routes prompts across providers with failover."
        users="All roles."
        features={[
          "Multi-session chat with persistent history (title, last message, timestamps).",
          "Auto mode: server picks the healthiest provider automatically.",
          "Manual pinning: user can pin a primary provider (settings moved to Settings → AI).",
          "Failover: if primary 429s, 5xxs, or times out, next provider in priority is tried.",
          "Per-message metadata: provider, model, latency (ms), tokens used.",
          "Streaming responses (where provider supports).",
          "Sample prompt suggestions on empty state.",
        ]}
      />

      <FuncBlock
        icon={GitCompare} color="#8b5cf6" name="Compare" group="Build"
        purpose="Run the same prompt across N providers in parallel — no failover — to compare outputs."
        users="Engineers evaluating models; product teams A/B-testing prompts."
        features={[
          "Provider multi-select (min 2).",
          "Optional system prompt applied to all runs.",
          "Parallel execution with 25s per-provider timeout.",
          "Side-by-side cards: content, model badge, latency, tokens, success/error.",
          "Sample data shown by default for first-time visitors.",
          "Persisted as ComparisonRun rows for history.",
        ]}
      />

      <FuncBlock
        icon={Brain} color="#f59e0b" name="Agent" group="Build"
        purpose="Role-based agents that execute multi-step tasks with tool use and persistent sessions."
        users="Engineers and operators running repeatable workflows."
        features={[
          "147 pre-built agent templates (researcher, coder, analyst, summarizer, etc.).",
          "Tool use: web search, code interpreter, file I/O, calculator.",
          "Persistent sessions: pause and resume agent tasks.",
          "Per-agent provider pinning.",
          "Live task status: queued, running, completed, failed.",
          "Audit log of tool calls and intermediate steps.",
        ]}
      />

      <FuncBlock
        icon={BookMarked} color="#06b6d4" name="Prompts" group="Build"
        purpose="Reusable prompt library — save, version, and share prompts across the team."
        users="All roles."
        features={[
          "Create, edit, delete prompts with title + body.",
          "One-click send to Chat or Compare.",
          "Tag-based organization.",
          "Per-org prompt library (multi-tenant isolation).",
        ]}
      />

      <FuncBlock
        icon={Network} color="#ec4899" name="AI Directory" group="Discover"
        purpose="Browsable catalog of every integrated AI with rich metadata."
        users="Engineers evaluating which AI to wire up."
        features={[
          "60+ AIs (platforms, packages, frameworks, models, services).",
          "Filter by kind and popularity.",
          "Per-AI: use cases, capabilities, advantages, limitations, sample prompts, setup notes, pricing, docs links.",
          "One-click 'Use prompt' sends a sample prompt to Chat.",
        ]}
      />

      <FuncBlock
        icon={Settings2} color="#3b82f6" name="Settings · AI Providers" group="Settings"
        purpose="Configure which AI providers are active, their API keys, priority, and health."
        users="Owner / admin only."
        features={[
          "Add / edit / deactivate providers (OpenAI, Anthropic, Gemini, Grok, Zai, Ollama, vLLM, HF, custom OpenAI-compatible).",
          "Reorder priority via drag handle (used for failover chain).",
          "Per-provider: API key, base URL, model list, status.",
          "Manual health-check trigger.",
          "Circuit-breaker auto-opens after N failures.",
        ]}
      />

      <FuncBlock
        icon={Activity} color="#ef4444" name="Settings · Health & Failovers" group="Settings"
        purpose="Live observability of provider status and failover events."
        users="Owner / admin only."
        features={[
          "Live health badges: healthy / degraded / down.",
          "Failover log: timestamp, from-provider, to-provider, reason, latency.",
          "Circuit-breaker panel: open / closed / half-open, failure count, last tripped.",
          "Analytics dashboard: requests/day, latency p50/p95, error rate, cost (where available).",
        ]}
      />

      <FuncBlock
        icon={Users} color="#14b8a6" name="Settings · Team & API Keys" group="Settings"
        purpose="Manage org members, roles, and API keys for programmatic access."
        users="Owner only for member management; admin+ for API keys."
        features={[
          "Invite members by email; assign role (owner / admin / member / viewer).",
          "Switch between multiple org memberships.",
          "Generate per-tenant API keys with name + optional expiry.",
          "Revoke keys instantly.",
          "Usage tracking per key (request count, last used).",
        ]}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// TECHNICAL SPEC
// ──────────────────────────────────────────────────────────────
function TechnicalSection() {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Code2 className="w-5 h-5 text-emerald-500" />Technical Specification</CardTitle>
          <CardDescription>Stack, architecture, data flow, and API design.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Box className="w-4 h-4" />Stack</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <KV k="Framework" v="Next.js 16 (App Router, RSC)" />
            <KV k="Language" v="TypeScript 5" />
            <KV k="UI" v="Tailwind CSS 4, shadcn/ui, Radix primitives" />
            <KV k="Database" v="PostgreSQL (Neon / Supabase) via Prisma 6" />
            <KV k="Auth" v="Cookie-session + bcrypt (per-org multi-tenant)" />
            <KV k="Hosting" v="Vercel (serverless functions, bom1 region)" />
            <KV k="Runtime" v="Node.js 20 / Bun (build)" />
            <KV k="Icons" v="lucide-react" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Layers className="w-4 h-4" />Architecture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>
            The app is a single Next.js monolith deployed to Vercel. Every API endpoint is a
            serverless function under <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">/app/api/*</code>.
            The Postgres database stores users, organizations, memberships, providers, sessions,
            messages, failovers, comparison runs, prompts, and API keys.
          </p>
          <p>
            <strong>Request flow (chat):</strong> Browser → <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">POST /api/chat</code> →
            load active providers (ordered by priority) → try primary → on 429/5xx/timeout,
            try next provider → persist ChatMessage + Failover row → return content + metadata.
          </p>
          <p>
            <strong>Multi-tenancy:</strong> every DB row carries <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">orgId</code>.
            The <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">requireRole()</code> helper
            enforces both auth and org membership on every request.
          </p>
          <p>
            <strong>Provider abstraction:</strong> all providers implement a common interface
            (<code className="px-1 rounded bg-slate-100 dark:bg-slate-800">callProvider()</code>),
            enabling uniform failover, comparison, and analytics. OpenAI-compatible providers
            (Ollama, vLLM, LocalAI, LM Studio, Jan) reuse the OpenAI client with a custom baseURL.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4" />Data model</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded-lg overflow-x-auto border border-slate-200 dark:border-slate-800">{`User 1─* Membership *─1 Organization
Organization 1─* Provider (priority, status, apiKey)
Organization 1─* Session 1─* ChatMessage
Organization 1─* Failover
Organization 1─* ComparisonRun
Organization 1─* Prompt
Organization 1─* ApiKey
Organization 1─* AgentTemplate (shared library)
Organization 1─* AgentSession 1─* AgentTask`}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Server className="w-4 h-4" />Internal API endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {[
            ["POST /api/auth/signup", "Create user + org"],
            ["POST /api/auth/login", "Cookie-based login"],
            ["POST /api/auth/logout", "Clear session"],
            ["GET  /api/providers", "List org providers"],
            ["POST /api/chat", "Send a chat message (with failover)"],
            ["POST /api/compare", "Parallel comparison run"],
            ["GET  /api/sessions", "List chat sessions"],
            ["GET  /api/agent/templates", "List agent templates"],
            ["POST /api/agent/tasks", "Start an agent task"],
            ["GET  /api/failovers", "List failover events"],
            ["GET  /api/ai-dashboard", "Aggregated analytics"],
            ["GET  /api/api-keys", "List API keys"],
          ].map(([ep, desc]) => (
            <div key={ep} className="flex items-start gap-2 font-mono text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 w-64 flex-shrink-0">{ep}</span>
              <span className="text-slate-600 dark:text-slate-400">{desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Lock className="w-4 h-4" />Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />All passwords hashed with bcrypt (10 rounds).</p>
          <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />Cookie-based session, httpOnly + sameSite=strict.</p>
          <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />Every API route calls <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">requireRole()</code> for auth + role check.</p>
          <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />Provider API keys encrypted at rest in the DB.</p>
          <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />Per-tenant API keys are 32-byte random, prefixed <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">marq_</code>.</p>
          <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />HTTPS enforced by Vercel edge; HSTS preload.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// SOPs
// ──────────────────────────────────────────────────────────────
function SopSection() {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-amber-500" />Standard Operating Procedures</CardTitle>
          <CardDescription>Step-by-step playbooks for the most common operator tasks.</CardDescription>
        </CardHeader>
      </Card>

      <SOP
        n={1}
        title="Onboard a new corporate tenant"
        icon={Users}
        steps={[
          "Owner signs up at the platform with work email + organization name.",
          "Owner navigates to Settings → Team and invites members by email (role: member by default).",
          "Owner navigates to Settings → AI Providers and configures at least 2 providers (primary + failover).",
          "Owner generates an API key under Settings → API Keys for the tenant's applications to use.",
          "Tenant developer integrates using the SaaS Unified API guide (see SaaS section).",
          "Owner verifies health via Settings → Health; failover chain visible in Failover Log.",
        ]}
      />

      <SOP
        n={2}
        title="Add a new AI provider"
        icon={Settings2}
        steps={[
          "Navigate to Settings → AI Providers.",
          "Click 'Add provider'. Choose type (OpenAI, Anthropic, Gemini, Grok, Zai, Ollama, vLLM, HF, or Custom OpenAI-compatible).",
          "Enter display name, API key, base URL (if custom), and the model list (comma-separated).",
          "Set priority — lower number = tried first in failover chain.",
          "Click Save. Provider appears in the chat provider bar and in Compare.",
          "Click 'Health check' to verify connectivity. Status badge updates immediately.",
        ]}
      />

      <SOP
        n={3}
        title="Respond to a provider outage"
        icon={Activity}
        steps={[
          "Open Settings → Health. Look for any provider showing 'down' (red) or 'degraded' (amber).",
          "If a circuit breaker has auto-opened, it will show under Settings → Failovers with reason + timestamp.",
          "Confirm the failover chain is picking up traffic — the Failover Log shows from→to transitions.",
          "If the outage is prolonged, demote the failing provider: Settings → AI Providers → drag it lower in priority.",
          "Once the provider recovers, manually close the circuit breaker (or wait for the auto half-open probe).",
          "Optional: file a post-mortem referencing the failover log entries.",
        ]}
      />

      <SOP
        n={4}
        title="Compare models for a use case"
        icon={GitCompare}
        steps={[
          "Navigate to Compare.",
          "Enter your prompt (and optional system prompt).",
          "Select ≥2 providers via the chips.",
          "Click 'Run comparison'. Each provider runs in parallel (25s timeout each).",
          "Review side-by-side: content quality, latency, token usage.",
          "Pick the winner; pin it as primary in Settings → AI Providers if desired.",
        ]}
      />

      <SOP
        n={5}
        title="Deploy a new version to Vercel"
        icon={Terminal}
        steps={[
          "Ensure all changes are committed on the main branch.",
          "git push origin main — Vercel auto-deploys on push.",
          "Monitor the build at the Vercel dashboard (bom1 region).",
          "vercel-build.sh runs: prisma generate → prisma db push → seed → next build.",
          "Once deployed, smoke-test: log in, send a chat, run a comparison, check health.",
          "If rollback is needed, use Vercel's 'Instant Rollback' to the previous deployment.",
        ]}
      />

      <SOP
        n={6}
        title="Rotate a compromised API key"
        icon={Key}
        steps={[
          "Navigate to Settings → API Keys.",
          "Click 'Revoke' on the compromised key — takes effect immediately.",
          "Click 'Generate new key'. Copy the value (shown only once).",
          "Update the key in all client applications.",
          "Optionally review the Failover Log and ChatMessage history for suspicious activity.",
        ]}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// SaaS UNIFIED API
// ──────────────────────────────────────────────────────────────
function SaasSection() {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" />SaaS Unified API</CardTitle>
          <CardDescription>
            Expose Marq AI to corporates and third-party products through a single
            OpenAI-compatible endpoint. No SDK changes required — any client that speaks
            OpenAI can talk to Marq.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>
            The unified API lives at <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">/api/v1/*</code> and
            is authenticated with a per-tenant API key (prefix <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">marq_</code>)
            issued under <strong>Settings → API Keys</strong>. Every request is scoped to
            the key's organization — multi-tenant isolation is enforced server-side.
          </p>
          <p>
            The same key works for chat, compare, agent runs, and model listing. Usage is
            logged per key for billing and audit.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {[
            ["POST /api/v1/chat/completions", "OpenAI-compatible chat (with failover)"],
            ["POST /api/v1/compare", "Run one prompt across N providers"],
            ["POST /api/v1/agents/run", "Start an agent task"],
            ["GET  /api/v1/models", "List models available to this tenant"],
          ].map(([ep, desc]) => (
            <div key={ep} className="flex items-start gap-2 font-mono text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 w-64 flex-shrink-0">{ep}</span>
              <span className="text-slate-600 dark:text-slate-400">{desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Terminal className="w-4 h-4" />Quick start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">Drop-in replacement for the OpenAI SDK:</p>
          <pre className="text-xs bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto">{`import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "marq_xxxxxxxxxxxxxxxxxxxxxxxx",  // from Settings → API Keys
  baseURL: "https://your-marq-domain.com/api/v1",
});

const res = await client.chat.completions.create({
  model: "auto",  // or "gpt-4o", "claude-sonnet-4-5", etc.
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user",   content: "Explain CAP theorem in one line." },
  ],
});

console.log(res.choices[0].message.content);`}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Cpu className="w-4 h-4" />Run an agent programmatically</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto">{`curl -X POST https://your-marq-domain.com/api/v1/agents/run \\
  -H "Authorization: Bearer marq_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template": "researcher",
    "input": "Summarize Q3 2025 AI infra market trends",
    "providerId": "optional-provider-id"
  }'

# Returns: { taskId, status: "queued" }
# Poll GET /api/v1/agents/{taskId} for completion.`}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing & rate limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          <p>Per-tenant rate limits are configurable per API key:</p>
          <ul className="space-y-1 ml-2">
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /><strong>Free tier:</strong> 100 req/day, 10 RPM — for evaluation.</li>
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /><strong>Team tier:</strong> 10,000 req/day, 60 RPM — for production apps.</li>
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /><strong>Enterprise tier:</strong> custom limits + dedicated infra + SLA.</li>
          </ul>
          <p className="text-xs text-slate-500 mt-2">
            Rate-limit headers (<code className="px-1 rounded bg-slate-100 dark:bg-slate-800">X-RateLimit-Remaining</code>,
            <code className="px-1 rounded bg-slate-100 dark:bg-slate-800 ml-1">X-RateLimit-Reset</code>) are returned on every response.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Third-party integration checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-300 list-decimal ml-5">
            <li>Sign up your organization on the platform.</li>
            <li>Invite team members under Settings → Team.</li>
            <li>Configure AI providers under Settings → AI Providers (or use the platform's shared pool).</li>
            <li>Generate an API key under Settings → API Keys.</li>
            <li>Point your OpenAI-compatible client at <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">https://your-marq-domain.com/api/v1</code>.</li>
            <li>Use <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">model: "auto"</code> for failover, or a specific model name.</li>
            <li>Monitor usage in the Analytics tab and Failover Log.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Shared sub-components
// ──────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof Zap; accent: string }) {
  return (
    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function ModuleCard({ icon: Icon, title, desc, color }: { icon: typeof MessageSquare; title: string; desc: string; color: string }) {
  return (
    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{desc}</p>
    </div>
  );
}

function FuncBlock({
  icon: Icon, color, name, group, purpose, users, features,
}: {
  icon: typeof MessageSquare; color: string; name: string; group: string;
  purpose: string; users: string; features: string[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20`, color }}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{name}</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{group}</Badge>
            </div>
            <CardDescription className="text-xs mt-1">{purpose}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-xs"><span className="font-semibold text-slate-600 dark:text-slate-400">Users:</span> <span className="text-slate-700 dark:text-slate-300">{users}</span></div>
        <div>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Features</div>
          <ul className="space-y-1">
            {features.map((f, i) => (
              <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium text-slate-800 dark:text-slate-200">{v}</span>
    </div>
  );
}

function SOP({ n, title, icon: Icon, steps }: { n: number; title: string; icon: typeof Users; steps: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center">{n}</span>
          <Icon className="w-4 h-4 text-amber-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
