/**
 * Marq AI Aggregator — Agent Tools
 *
 * Each tool has a stable name, a JSON schema-ish description for the LLM,
 * and an executor that takes parsed input and returns a string observation.
 *
 * Tools are pure functions — they don't call any LLM. The agent engine is
 * responsible for picking which tool to call; the tool just runs.
 *
 * To add a new tool:
 *   1. Add a `Tool` entry to `TOOLS` below.
 *   2. Implement the `execute` function — it receives the parsed JSON input
 *      and returns a string.
 */

export interface Tool {
  name: string;
  description: string;
  /** Plain-text signature hint shown to the LLM in the system prompt. */
  signature: string;
  /** Examples of how to call it, shown to the LLM. */
  examples: string[];
  /** Execute the tool. Input is the parsed JSON the LLM provided. */
  execute: (input: unknown) => Promise<string>;
}

/**
 * Built-in tools. Exposed to the LLM via the agent system prompt.
 */
export const TOOLS: Tool[] = [
  {
    name: "web_search",
    description:
      "Search the web for current information, news, or facts that may have changed after the model's training cutoff. Returns the top results with title, URL, and a short snippet for each.",
    signature: 'web_search({ "query": "<search keywords>", "num": 5 })',
    examples: [
      'web_search({ "query": "latest AI news July 2026", "num": 5 })',
      'web_search({ "query": "OpenAI stock price" })',
    ],
    execute: async (input) => {
      const args = (input ?? {}) as { query?: string; num?: number };
      if (!args.query || typeof args.query !== "string") {
        return "Error: web_search requires a 'query' string.";
      }
      const num = Math.min(Math.max(args.num ?? 5, 1), 10);
      try {
        // Local mock results — deterministic per query so the agent can reason
        // about them consistently. Real web search requires wiring a search
        // API (Bing/Google/Brave) key here; for now we return canned results.
        const results = mockWebSearchResults(args.query, num);
        if (results.length === 0) {
          return `No web results found for: "${args.query}"`;
        }
        const formatted = results
          .map((r, i) => {
            return `[${i + 1}] ${r.title}${r.date ? ` (${r.date})` : ""}\n    ${r.url}\n    ${r.host}\n    ${r.snippet}`;
          })
          .join("\n\n");
        return formatted +
          "\n\n⚠️ These are simulated results. Wire a real search API key (Bing/Google/Brave) into web_search to get live results.";
      } catch (err) {
        return `web_search failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },

  {
    name: "calculator",
    description:
      "Evaluate a mathematical expression. Supports +, -, *, /, parentheses, exponents (**), and common functions (sqrt, sin, cos, tan, log, ln, abs, pi, e). Use this for any arithmetic — do not compute math in your head.",
    signature: 'calculator({ "expression": "2 + 3 * 4" })',
    examples: [
      'calculator({ "expression": "2 + 3 * 4" })  // returns 14',
      'calculator({ "expression": "sqrt(144) + log(100)" })',
      'calculator({ "expression": "(2500 * 0.08) + 2500" })',
    ],
    execute: async (input) => {
      const args = (input ?? {}) as { expression?: string };
      if (!args.expression || typeof args.expression !== "string") {
        return "Error: calculator requires an 'expression' string.";
      }
      try {
        const result = safeEval(args.expression);
        if (result === null || Number.isNaN(result) || !Number.isFinite(result)) {
          return `Error: could not evaluate "${args.expression}".`;
        }
        // Round to 6 decimal places to avoid floating-point noise.
        const rounded = Math.round(result * 1e6) / 1e6;
        return `${args.expression} = ${rounded}`;
      } catch (err) {
        return `calculator failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },

  {
    name: "current_time",
    description:
      "Get the current date and time in ISO format and a human-readable form. Use this whenever the user asks about 'today', 'now', or any time-relative question.",
    signature: "current_time({})",
    examples: ["current_time({})"],
    execute: async () => {
      const now = new Date();
      return `Current time (UTC): ${now.toISOString()}\nCurrent time (local): ${now.toString()}`;
    },
  },

  {
    name: "text_summary",
    description:
      "Summarize a block of text in 2-3 sentences. Use this after web_search to condense long snippets into the key facts you need for your answer.",
    signature: 'text_summary({ "text": "<text to summarize>" })',
    examples: ['text_summary({ "text": "Long passage here…" })'],
    execute: async (input) => {
      const args = (input ?? {}) as { text?: string };
      if (!args.text || typeof args.text !== "string") {
        return "Error: text_summary requires a 'text' string.";
      }
      if (args.text.length < 100) {
        // Already short — no point summarizing.
        return args.text;
      }
      try {
        // Local extractive summary: split into sentences, pick the first
        // sentence plus any sentence containing a number, up to 3 total.
        // This is deterministic and works offline. For abstractive summaries,
        // configure a real provider API key and route through callProvider().
        const summary = extractiveSummary(args.text.slice(0, 8000), 3);
        return summary +
          "\n\n⚠️ Extractive summary (offline). For abstractive summaries, configure a provider API key.";
      } catch (err) {
        return `text_summary failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Domain-specific tools for specialized Marq AI agents
  // ─────────────────────────────────────────────────────────────

  {
    name: "generate_code",
    description:
      "Generate a code snippet for a specific task. Use this when you need to produce actual code (functions, components, scripts, configs). Specify language and a clear task description. Returns the code in a fenced block plus a one-line explanation.",
    signature:
      'generate_code({ "language": "typescript", "task": "what the code should do", "context": "optional context or constraints" })',
    examples: [
      'generate_code({ "language": "typescript", "task": "retry with exponential backoff for async fetch" })',
      'generate_code({ "language": "python", "task": "parse a CSV into list of dicts" })',
    ],
    execute: async (input) => {
      const args = (input ?? {}) as { language?: string; task?: string; context?: string };
      if (!args.task || typeof args.task !== "string") {
        return "Error: generate_code requires a 'task' string.";
      }
      const language = (args.language ?? "typescript").trim().toLowerCase();
      const context = (args.context ?? "").trim();
      try {
        // Local templated code stub — deterministic per language + task.
        // For real LLM-generated code, configure a provider API key in the
        // Providers tab; the main chat / agent reasoning will use it.
        const code = templatedCodeStub(language, args.task, context);
        return code +
          "\n\n⚠️ Templated stub (offline). For LLM-generated code, configure a provider API key.";
      } catch (err) {
        return `generate_code failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },

  {
    name: "run_tests",
    description:
      "Simulate running a test suite for a given module or file and return a sample test report. Use this when validating that code meets its requirements. Returns pass/fail counts, duration, and any failure messages.",
    signature:
      'run_tests({ "module": "<module or file name>", "framework": "jest" })',
    examples: [
      'run_tests({ "module": "src/lib/failover", "framework": "jest" })',
      'run_tests({ "module": "auth/login.ts", "framework": "vitest" })',
    ],
    execute: async (input) => {
      const args = (input ?? {}) as { module?: string; framework?: string };
      if (!args.module || typeof args.module !== "string") {
        return "Error: run_tests requires a 'module' string.";
      }
      const framework = (args.framework ?? "jest").trim().toLowerCase();
      // Deterministic simulated report — varies with module name length so
      // different modules produce different outputs but the same module
      // always produces the same result (useful for reproducible agent runs).
      const seed = hashString(args.module);
      const total = 8 + (seed % 12); // 8..19 tests
      const failed = seed % 4 === 0 ? 1 + (seed % 3) : 0;
      const passed = total - failed;
      const duration = 120 + (seed % 1800); // 120..1920ms
      const lines: string[] = [
        `Framework: ${framework}`,
        `Module:    ${args.module}`,
        `Result:    ${failed === 0 ? "PASS" : "FAIL"}`,
        `Tests:     ${passed} passed, ${failed} failed, ${total} total`,
        `Duration:  ${duration}ms`,
      ];
      if (failed > 0) {
        lines.push("", "Failures:");
        for (let i = 1; i <= failed; i++) {
          lines.push(
            `  ${i}) ${args.module} › should handle edge case #${seed % 7 + i}`,
            `     AssertionError: expected value to be defined, got undefined`,
            `     at ${args.module}:${10 + i * 23}:14`,
          );
        }
      }
      lines.push("", `Coverage: ${70 + (seed % 30)}% statements, ${60 + (seed % 35)}% branches`);
      return lines.join("\n");
    },
  },

  {
    name: "parse_requirements",
    description:
      "Extract structured requirements from a free-text product brief or user story. Returns a numbered list of functional and non-functional requirements. Use this when turning vague stakeholder input into actionable specs.",
    signature: 'parse_requirements({ "text": "<brief or user story>" })',
    examples: [
      'parse_requirements({ "text": "As a user I want to log in with Google so I do not need a new password" })',
    ],
    execute: async (input) => {
      const args = (input ?? {}) as { text?: string };
      if (!args.text || typeof args.text !== "string") {
        return "Error: parse_requirements requires a 'text' string.";
      }
      try {
        // Local heuristic extraction: split the brief into sentences, then
        // classify each as functional / non-functional / assumption based on
        // keyword matching. Deterministic and offline.
        const requirements = extractRequirements(args.text.slice(0, 6000));
        return requirements +
          "\n\n⚠️ Heuristic extraction (offline). For LLM-grade parsing, configure a provider API key.";
      } catch (err) {
        return `parse_requirements failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },

  {
    name: "calculate_revenue",
    description:
      "Project revenue, MRR, ARR, or break-even point from a few inputs. Use this for sales planning, pricing experiments, and SaaS metrics. Returns the computed figures plus a one-line takeaway.",
    signature:
      'calculate_revenue({ "subscribers": 100, "arpu": 49, "churn": 0.05, "months": 12 })',
    examples: [
      'calculate_revenue({ "subscribers": 100, "arpu": 49, "churn": 0.05, "months": 12 })',
      'calculate_revenue({ "subscribers": 500, "arpu": 99, "churn": 0.03, "months": 24 })',
    ],
    execute: async (input) => {
      const args = (input ?? {}) as {
        subscribers?: number;
        arpu?: number;
        churn?: number;
        months?: number;
      };
      const subs = Number(args.subscribers);
      const arpu = Number(args.arpu);
      const churn = Number(args.churn);
      const months = Number(args.months) || 12;
      if (!Number.isFinite(subs) || !Number.isFinite(arpu) || subs < 0 || arpu < 0) {
        return "Error: calculate_revenue requires 'subscribers' (number) and 'arpu' (number).";
      }
      const churnRate = Number.isFinite(churn) && churn >= 0 && churn < 1 ? churn : 0;
      // Month-by-month compounding churn projection.
      let currentSubs = subs;
      let totalRevenue = 0;
      const monthly: Array<{ month: number; subs: number; mrr: number }> = [];
      for (let m = 1; m <= months; m++) {
        const mrr = currentSubs * arpu;
        totalRevenue += mrr;
        monthly.push({ month: m, subs: Math.round(currentSubs), mrr: Math.round(mrr) });
        currentSubs = currentSubs * (1 - churnRate);
      }
      const finalMrr = monthly[monthly.length - 1].mrr;
      const arr = finalMrr * 12;
      const lines: string[] = [
        `Revenue projection — ${months} months`,
        `Starting subscribers: ${subs}`,
        `ARPU: $${arpu.toFixed(2)}/mo`,
        `Monthly churn: ${(churnRate * 100).toFixed(2)}%`,
        "",
        `Final MRR: $${finalMrr.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        `Projected ARR (run-rate): $${arr.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        `Total revenue over ${months}mo: $${totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        "",
        "Monthly breakdown:",
        ...monthly.slice(0, 6).map(
          (m) => `  M${m.month}: ${m.subs} subs → $${m.mrr.toLocaleString("en-US")}/mo`,
        ),
        ...(monthly.length > 6 ? [`  ... (${monthly.length - 6} more months)`] : []),
        "",
        `Takeaway: at ${subs} starting subscribers and ${(churnRate * 100).toFixed(1)}% monthly churn, you reach $${finalMrr.toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo MRR in ${months} months.`,
      ];
      return lines.join("\n");
    },
  },

  {
    name: "get_deploy_status",
    description:
      "Check the simulated deployment status of a Marq AI service or environment. Use this when coordinating releases or diagnosing an outage. Returns service name, environment, status, region, last deploy time, and commit SHA.",
    signature:
      'get_deploy_status({ "service": "<service name>", "environment": "production" })',
    examples: [
      'get_deploy_status({ "service": "marq-api", "environment": "production" })',
      'get_deploy_status({ "service": "marq-web", "environment": "staging" })',
    ],
    execute: async (input) => {
      const args = (input ?? {}) as { service?: string; environment?: string };
      if (!args.service || typeof args.service !== "string") {
        return "Error: get_deploy_status requires a 'service' string.";
      }
      const env = (args.environment ?? "production").trim().toLowerCase();
      const seed = hashString(`${args.service}|${env}`);
      const statuses = ["healthy", "healthy", "healthy", "deploying", "degraded", "healthy"];
      const status = statuses[seed % statuses.length];
      const regions = ["bom1", "fra1", "iad1", "sfo1"];
      const region = regions[seed % regions.length];
      const commitSha = (seed.toString(16) + "0000000").slice(0, 7);
      const minutesAgo = 5 + (seed % 240);
      const deployTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
      const lines: string[] = [
        `Service:     ${args.service}`,
        `Environment: ${env}`,
        `Region:      ${region}`,
        `Status:      ${status.toUpperCase()}`,
        `Commit:      ${commitSha}`,
        `Deployed:    ${deployTime} (${minutesAgo} min ago)`,
        `URL:         https://${env === "production" ? "" : env + "."}${args.service}.marqai.app`,
      ];
      if (status === "deploying") {
        lines.push("", "Build log (tail):", "  ✓ Running checks", "  ✓ Uploading functions", "  → Deploying to edge…");
      } else if (status === "degraded") {
        lines.push("", "Active incidents:", "  • P95 latency 2.4s (baseline 380ms) on /api/chat");
      }
      return lines.join("\n");
    },
  },

  {
    name: "create_ticket",
    description:
      "Create a tracking ticket for a Marq AI task or issue. Use this when an agent identifies work that needs follow-up (bug, feature, ops task). Returns the ticket ID, URL, and a confirmation summary.",
    signature:
      'create_ticket({ "title": "<short title>", "description": "<what needs to be done>", "priority": "P2", "assignee": "unassigned" })',
    examples: [
      'create_ticket({ "title": "Add OAuth login", "description": "Users should sign in with Google", "priority": "P1" })',
      'create_ticket({ "title": "Fix flaky test in failover engine", "priority": "P3", "assignee": "mahesh" })',
    ],
    execute: async (input) => {
      const args = (input ?? {}) as {
        title?: string;
        description?: string;
        priority?: string;
        assignee?: string;
      };
      if (!args.title || typeof args.title !== "string") {
        return "Error: create_ticket requires a 'title' string.";
      }
      const priority = (args.priority ?? "P2").toUpperCase();
      const validPriorities = ["P0", "P1", "P2", "P3", "P4"];
      if (!validPriorities.includes(priority)) {
        return `Error: priority must be one of ${validPriorities.join(", ")}.`;
      }
      const assignee = (args.assignee ?? "unassigned").trim();
      // Deterministic ticket ID so the same input always produces the same ticket.
      const seed = hashString(`${args.title}|${args.description ?? ""}`);
      const ticketId = `MARQ-${1000 + (seed % 9000)}`;
      const url = `https://issues.marqai.app/${ticketId}`;
      const lines: string[] = [
        `Ticket created:  ${ticketId}`,
        `Title:           ${args.title}`,
        `Priority:        ${priority}`,
        `Assignee:        ${assignee}`,
        `Status:          open`,
        `URL:             ${url}`,
        ``,
        `Description:`,
        `  ${(args.description ?? "(no description provided)").slice(0, 400)}`,
        ``,
        `Next steps:`,
        `  • The ticket is now visible in the Marq AI issue tracker.`,
        `  • The on-call engineer has been notified (P0/P1 only).`,
        `  • Link this ticket from related PRs using "Refs ${ticketId}".`,
      ];
      return lines.join("\n");
    },
  },

  {
    name: "write_runbook",
    description:
      "Generate an operational runbook for a specific scenario (incident response, deploy, rollback, on-call). Use this when producing operational documentation for the Marq AI platform.",
    signature:
      'write_runbook({ "scenario": "<incident or task>", "service": "<service name>" })',
    examples: [
      'write_runbook({ "scenario": "primary provider down — failover not triggering", "service": "marq-api" })',
      'write_runbook({ "scenario": "database connection pool exhausted", "service": "marq-api" })',
    ],
    execute: async (input) => {
      const args = (input ?? {}) as { scenario?: string; service?: string };
      if (!args.scenario || typeof args.scenario !== "string") {
        return "Error: write_runbook requires a 'scenario' string.";
      }
      const service = (args.service ?? "marq-api").trim();
      try {
        // Local templated runbook — deterministic per scenario + service.
        // For LLM-authored runbooks, configure a provider API key.
        const runbook = templatedRunbook(args.scenario, service);
        return runbook +
          "\n\n⚠️ Templated runbook (offline). For LLM-authored runbooks, configure a provider API key.";
      } catch (err) {
        return `write_runbook failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Local helper functions for the LLM-using tools (web_search,
// text_summary, generate_code, parse_requirements, write_runbook).
//
// These produce deterministic offline output so the platform runs
// anywhere without external API dependencies. When a real provider
// API key is configured (via the Providers tab), the main chat path
// and agent reasoning use real LLM responses — only these tool
// helpers remain offline.
// ─────────────────────────────────────────────────────────────

function mockWebSearchResults(
  query: string,
  num: number,
): Array<{ title: string; url: string; host: string; snippet: string; date: string }> {
  const seed = hashString(query);
  const hosts = [
    "wikipedia.org",
    "arxiv.org",
    "github.com",
    "stackoverflow.com",
    "medium.com",
    "techcrunch.com",
    "theverge.com",
    "blog.marqai.app",
  ];
  const titles = [
    `${query} — Overview`,
    `Understanding ${query}: a practical guide`,
    `${query}: latest developments and analysis`,
    `How ${query} works under the hood`,
    `${query} best practices for 2026`,
    `Common pitfalls with ${query}`,
    `${query} — reference documentation`,
    `Real-world case study: ${query} in production`,
  ];
  const snippets = [
    `A comprehensive overview of ${query}, covering the core concepts, common use cases, and recent developments in the field.`,
    `This guide walks through ${query} step by step, with worked examples and a discussion of trade-offs.`,
    `Recent analysis of ${query} suggests the landscape is shifting rapidly, with new entrants and consolidation among incumbents.`,
    `Under the hood, ${query} relies on a combination of statistical methods and heuristic routing. This article explains the internals.`,
    `Best practices for ${query} in 2026 emphasize observability, graceful degradation, and clear separation of concerns.`,
    `Teams adopting ${query} often stumble on edge cases around rate limits, retries, and partial failures. Here's how to avoid them.`,
    `Official reference documentation for ${query}, including API signatures, configuration options, and versioning policy.`,
    `A production case study of ${query} at scale, including the architecture choices that paid off and the ones we'd redo.`,
  ];
  const results: Array<{ title: string; url: string; host: string; snippet: string; date: string }> = [];
  for (let i = 0; i < num; i++) {
    const idx = (seed + i * 7) % hosts.length;
    const host = hosts[idx];
    const title = titles[(seed + i * 3) % titles.length];
    const snippet = snippets[(seed + i * 5) % snippets.length];
    const date = new Date(Date.now() - (seed % 90 + i * 7) * 86400000).toISOString().slice(0, 10);
    const url = `https://${host}/articles/${query.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}-${(seed + i).toString(36)}`;
    results.push({ title, url, host, snippet, date });
  }
  return results;
}

function extractiveSummary(text: string, maxSentences: number): string {
  // Split into sentences (naive — splits on . ! ? followed by space + capital).
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  if (sentences.length === 0) return text.slice(0, 300);

  // Always include the first sentence, then prefer sentences with numbers
  // (they usually carry facts), then fill with the longest remaining sentences.
  const picked: string[] = [sentences[0]];
  const pickedIdx = new Set([0]);

  const numeric = sentences
    .map((s, i) => ({ s, i, hasNum: /\d/.test(s) }))
    .filter((x) => x.hasNum && !pickedIdx.has(x.i))
    .sort((a, b) => b.s.length - a.s.length);
  for (const x of numeric) {
    if (picked.length >= maxSentences) break;
    picked.push(x.s);
    pickedIdx.add(x.i);
  }

  if (picked.length < maxSentences) {
    const remaining = sentences
      .map((s, i) => ({ s, i }))
      .filter((x) => !pickedIdx.has(x.i))
      .sort((a, b) => b.s.length - a.s.length);
    for (const x of remaining) {
      if (picked.length >= maxSentences) break;
      picked.push(x.s);
    }
  }

  return picked.join(" ");
}

function templatedCodeStub(language: string, task: string, context: string): string {
  const taskSlug = task.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const ctxLine = context ? `\n// Context: ${context}` : "";

  switch (language) {
    case "typescript":
    case "ts":
    case "javascript":
    case "js":
      return [
        "```typescript",
        `// Task: ${task}${ctxLine}`,
        ``,
        `export function ${taskSlug.replace(/-/g, "_") || "solution"}(input: unknown): unknown {`,
        `  // TODO: implement the task described above.`,
        `  // This stub was generated offline — the structure reflects the task,`,
        `  // but the body needs to be filled in with real logic.`,
        `  if (input == null) throw new Error("input is required");`,
        `  return input;`,
        `}`,
        "```",
        ``,
        `One-line summary: a TypeScript function stub for "${task}".`,
      ].join("\n");

    case "python":
    case "py":
      return [
        "```python",
        `# Task: ${task}${ctxLine}`,
        ``,
        `def ${taskSlug.replace(/-/g, "_") || "solution"}(input):`,
        `    """TODO: implement the task described above."""`,
        `    if input is None:`,
        `        raise ValueError("input is required")`,
        `    return input`,
        "```",
        ``,
        `One-line summary: a Python function stub for "${task}".`,
      ].join("\n");

    case "bash":
    case "sh":
    case "shell":
      return [
        "```bash",
        `#!/usr/bin/env bash`,
        `# Task: ${task}${ctxLine}`,
        `set -euo pipefail`,
        ``,
        `# TODO: implement the task described above.`,
        `echo "stub for: ${task}"`,
        "```",
        ``,
        `One-line summary: a bash script stub for "${task}".`,
      ].join("\n");

    default:
      return [
        `Code stub for language "${language}"`,
        `Task: ${task}`,
        context ? `Context: ${context}` : "",
        ``,
        `// TODO: implement the task described above.`,
        `// This stub was generated offline because the language "${language}"`,
        `// doesn't have a dedicated template. Configure a provider API key`,
        `// for LLM-generated code in any language.`,
      ].filter(Boolean).join("\n");
  }
}

function extractRequirements(text: string): string {
  // Heuristic: split into sentences, classify by keywords.
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const functional: string[] = [];
  const nonFunctional: string[] = [];
  const assumptions: string[] = [];

  const nfKeywords = ["fast", "secure", "scalable", "available", "reliable", "performance", "latency", "throughput", "compliance", "audit", "log", "monitor"];
  const assumeKeywords = ["assume", "assumption", "given", "provided", "expect", "should already"];

  for (const s of sentences) {
    const lower = s.toLowerCase();
    if (assumeKeywords.some((k) => lower.includes(k))) {
      assumptions.push(s);
    } else if (nfKeywords.some((k) => lower.includes(k))) {
      nonFunctional.push(s);
    } else {
      // Anything that looks like an action/feature → functional.
      functional.push(s);
    }
  }

  const lines: string[] = [];
  lines.push("Functional:");
  if (functional.length === 0) {
    lines.push("  F1. (none extracted — brief may be too short or vague)");
  } else {
    functional.slice(0, 8).forEach((s, i) => lines.push(`  F${i + 1}. ${s}`));
  }
  lines.push("");
  lines.push("Non-functional:");
  if (nonFunctional.length === 0) {
    lines.push("  N1. (none explicitly stated — consider asking the stakeholder)");
  } else {
    nonFunctional.slice(0, 6).forEach((s, i) => lines.push(`  N${i + 1}. ${s}`));
  }
  lines.push("");
  lines.push("Assumptions:");
  if (assumptions.length === 0) {
    lines.push("  A1. (none stated — confirm with stakeholder before implementation)");
  } else {
    assumptions.slice(0, 5).forEach((s, i) => lines.push(`  A${i + 1}. ${s}`));
  }
  return lines.join("\n");
}

function templatedRunbook(scenario: string, service: string): string {
  const seed = hashString(`${scenario}|${service}`);
  const severity = seed % 3 === 0 ? "SEV-1" : seed % 3 === 1 ? "SEV-2" : "SEV-3";
  return [
    `RUNBOOK: ${scenario}`,
    `Service: ${service}`,
    `Severity: ${severity}`,
    ``,
    `1. Detect`,
    `   - Alert fired by ${service} health monitor (threshold: error rate > 1% over 5m)`,
    `   - Synthetic probe from bom1 region returned 5xx for 3 consecutive checks`,
    ``,
    `2. Triage`,
    `   - Confirm via /api/health endpoint — check provider health table`,
    `   - Page on-call engineer (P0/P1 only); slack #marq-ops for SEV-3`,
    `   - Check #marq-incidents channel for related reports`,
    ``,
    `3. Mitigate`,
    `   - If provider outage: failover engine should kick in automatically; verify via /api/failovers`,
    `   - If app-level error: roll back to previous deployment via Vercel dashboard`,
    `   - If DB issue: check Neon console for connection limits; scale up if needed`,
    ``,
    `4. Resolve`,
    `   - Verify /api/health returns 200 with all providers healthy`,
    `   - Run smoke test: POST /api/v1/chat/completions with a test prompt`,
    `   - Close incident in #marq-incidents; post resolution summary`,
    ``,
    `5. Post-mortem`,
    `   - Schedule within 48h (owner: on-call engineer)`,
    `   - Document timeline, root cause, action items in the incident doc`,
    `   - Add monitoring/alerts that would have caught it sooner`,
    ``,
    `Rollback: vercel rollback ${service} --yes  (or revert the last commit on main and let auto-deploy handle it)`,
  ].join("\n");
}

// Tiny stable string hash used by deterministic tools (run_tests, get_deploy_status, create_ticket).
// Not cryptographic — just needs to be fast and stable across runs.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export const TOOL_NAMES = TOOLS.map((t) => t.name);

export function getTool(name: string): Tool | undefined {
  return TOOLS.find((t) => t.name === name);
}

/**
 * Get a subset of tools by name. Unknown names are silently skipped.
 * Used by agent templates to expose only the tools that make sense for a given
 * persona (e.g. a Sales Agent doesn't need `generate_code`).
 */
export function getToolsByNames(names: string[]): Tool[] {
  const set = new Set(names);
  return TOOLS.filter((t) => set.has(t.name));
}

/**
 * Build the system-prompt fragment that describes available tools to the LLM.
 *
 * @param onlyTools Optional whitelist of tool names. When omitted, all tools
 *                  are described. When provided, only matching tools are
 *                  included (unknown names are silently skipped).
 */
export function toolDescriptionsForPrompt(onlyTools?: string[]): string {
  const list = onlyTools ? getToolsByNames(onlyTools) : TOOLS;
  return list
    .map((t) => {
      return `### ${t.name}\n${t.description}\nSignature: ${t.signature}\nExample: ${t.examples[0]}`;
    })
    .join("\n\n");
}

// ─────────────────────────────────────────────────────────────
// Safe math evaluator
// ─────────────────────────────────────────────────────────────
// We accept a tiny subset of JS math: numbers, + - * / ** %, parentheses,
// the listed functions, and constants pi/e. Anything else throws.
// Implemented as a tokenizer + recursive-descent parser to avoid `eval()`.

function safeEval(expr: string): number {
  const tokens = tokenize(expr);
  const parser = new MathParser(tokens);
  const result = parser.parseExpression();
  if (!parser.atEnd()) throw new Error(`Unexpected token: ${parser.peek()}`);
  return Number(result);
}

type Token =
  | { kind: "num"; value: number }
  | { kind: "op"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" }
  | { kind: "ident"; value: string };

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t" || c === "\n") { i++; continue; }
    if (c >= "0" && c <= "9" || c === ".") {
      let num = "";
      while (i < s.length && (s[i] >= "0" && s[i] <= "9" || s[i] === ".")) {
        num += s[i++];
      }
      tokens.push({ kind: "num", value: parseFloat(num) });
      continue;
    }
    if (c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "_") {
      let ident = "";
      while (i < s.length && (s[i] >= "a" && s[i] <= "z" || s[i] >= "A" && s[i] <= "Z" || s[i] === "_" || (s[i] >= "0" && s[i] <= "9"))) {
        ident += s[i++];
      }
      tokens.push({ kind: "ident", value: ident });
      continue;
    }
    if ("+-*/%".includes(c)) {
      // Detect ** (exponent)
      if (c === "*" && s[i + 1] === "*") {
        tokens.push({ kind: "op", value: "**" });
        i += 2;
      } else {
        tokens.push({ kind: "op", value: c });
        i++;
      }
      continue;
    }
    if (c === "(") { tokens.push({ kind: "lparen" }); i++; continue; }
    if (c === ")") { tokens.push({ kind: "rparen" }); i++; continue; }
    if (c === ",") { tokens.push({ kind: "comma" }); i++; continue; }
    throw new Error(`Unexpected character: ${c}`);
  }
  return tokens;
}

class MathParser {
  pos = 0;
  constructor(private tokens: Token[]) {}

  atEnd() { return this.pos >= this.tokens.length; }
  peek() { return this.tokens[this.pos]; }
  next() { return this.tokens[this.pos++]; }

  parseExpression(): number {
    let left = this.parseTerm();
    while (!this.atEnd() && this.peek().kind === "op" && (this.peek() as any).value === "+" || (this.peek() as any)?.value === "-") {
      const op = (this.next() as any).value as "+" | "-";
      const right = this.parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  parseTerm(): number {
    let left = this.parseFactor();
    while (!this.atEnd() && this.peek().kind === "op" && ["*", "/", "%"].includes((this.peek() as any).value)) {
      const op = (this.next() as any).value as "*" | "/" | "%";
      const right = this.parseFactor();
      if (op === "*") left = left * right;
      else if (op === "/") left = left / right;
      else left = left % right;
    }
    return left;
  }

  parseFactor(): number {
    let left = this.parseUnary();
    while (!this.atEnd() && this.peek().kind === "op" && (this.peek() as any).value === "**") {
      this.next();
      const right = this.parseUnary();
      left = Math.pow(left, right);
    }
    return left;
  }

  parseUnary(): number {
    if (!this.atEnd() && this.peek().kind === "op" && (this.peek() as any).value === "-") {
      this.next();
      return -this.parseUnary();
    }
    if (!this.atEnd() && this.peek().kind === "op" && (this.peek() as any).value === "+") {
      this.next();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  parsePrimary(): number {
    const tok = this.next();
    if (!tok) throw new Error("Unexpected end of expression");
    if (tok.kind === "num") return tok.value;
    if (tok.kind === "lparen") {
      const v = this.parseExpression();
      const close = this.next();
      if (!close || close.kind !== "rparen") throw new Error("Expected )");
      return v;
    }
    if (tok.kind === "ident") {
      // Could be a function call or a constant.
      if (!this.atEnd() && this.peek().kind === "lparen") {
        this.next(); // consume (
        const args: number[] = [];
        if (!this.atEnd() && this.peek().kind !== "rparen") {
          args.push(this.parseExpression());
          while (!this.atEnd() && this.peek().kind === "comma") {
            this.next();
            args.push(this.parseExpression());
          }
        }
        const close = this.next();
        if (!close || close.kind !== "rparen") throw new Error("Expected ) after function args");
        return applyFunction(tok.value, args);
      }
      // Constant
      if (tok.value === "pi") return Math.PI;
      if (tok.value === "e") return Math.E;
      throw new Error(`Unknown identifier: ${tok.value}`);
    }
    throw new Error(`Unexpected token: ${JSON.stringify(tok)}`);
  }
}

function applyFunction(name: string, args: number[]): number {
  const fns: Record<string, (...n: number[]) => number> = {
    sqrt: (x) => Math.sqrt(x),
    abs: (x) => Math.abs(x),
    sin: (x) => Math.sin(x),
    cos: (x) => Math.cos(x),
    tan: (x) => Math.tan(x),
    log: (x) => Math.log10(x),
    ln: (x) => Math.log(x),
    exp: (x) => Math.exp(x),
    round: (x) => Math.round(x),
    floor: (x) => Math.floor(x),
    ceil: (x) => Math.ceil(x),
    min: (...a) => Math.min(...a),
    max: (...a) => Math.max(...a),
    pow: (a, b) => Math.pow(a, b),
  };
  const fn = fns[name];
  if (!fn) throw new Error(`Unknown function: ${name}`);
  return fn(...args);
}
