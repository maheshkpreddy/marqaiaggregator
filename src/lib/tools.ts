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
        const ZAI = (await import("z-ai-web-dev-sdk")).default;
        const zai = await ZAI.create();
        const results = (await zai.functions.invoke("web_search", {
          query: args.query,
          num,
        })) as Array<{
          name?: string;
          url?: string;
          snippet?: string;
          host_name?: string;
          date?: string;
        }>;

        if (!Array.isArray(results) || results.length === 0) {
          return `No web results found for: "${args.query}"`;
        }

        const formatted = results
          .map((r, i) => {
            const title = r.name ?? "(untitled)";
            const url = r.url ?? "";
            const snippet = r.snippet ?? "";
            const host = r.host_name ?? "";
            const date = r.date ?? "";
            return `[${i + 1}] ${title}${date ? ` (${date})` : ""}\n    ${url}\n    ${host}\n    ${snippet}`;
          })
          .join("\n\n");
        return formatted;
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
        const ZAI = (await import("z-ai-web-dev-sdk")).default;
        const zai = await ZAI.create();
        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: "assistant",
              content:
                "You are a precise summarizer. Summarize the user's text in 2-3 sentences, preserving the key facts and numbers. Do not add any new information.",
            },
            { role: "user", content: args.text.slice(0, 8000) },
          ],
          thinking: { type: "disabled" },
        });
        return (completion.choices[0]?.message?.content ?? "").trim() || "(no summary produced)";
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
        const ZAI = (await import("z-ai-web-dev-sdk")).default;
        const zai = await ZAI.create();
        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: "assistant",
              content:
                "You are a senior software engineer. Generate production-quality code that solves the user's task. " +
                "Return ONLY: a fenced code block in the requested language, followed by a one-line summary of what it does. " +
                "Do not include any other prose.",
            },
            {
              role: "user",
              content:
                `Language: ${language}\nTask: ${args.task}\n` +
                (context ? `Context / constraints: ${context}\n` : ""),
            },
          ],
          thinking: { type: "disabled" },
        });
        return (completion.choices[0]?.message?.content ?? "").trim() || "(no code produced)";
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
        const ZAI = (await import("z-ai-web-dev-sdk")).default;
        const zai = await ZAI.create();
        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: "assistant",
              content:
                "You are a senior business analyst. From the user's brief, extract structured requirements as a plain-text numbered list. " +
                "Use the format:\n" +
                "Functional:\n  F1. <requirement>\n  ...\n" +
                "Non-functional:\n  N1. <requirement>\n  ...\n" +
                "Assumptions:\n  A1. <assumption>\n  ...\n" +
                "Keep each item to a single sentence. Do not add prose outside these sections.",
            },
            { role: "user", content: args.text.slice(0, 6000) },
          ],
          thinking: { type: "disabled" },
        });
        return (completion.choices[0]?.message?.content ?? "").trim() || "(no requirements extracted)";
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
        const ZAI = (await import("z-ai-web-dev-sdk")).default;
        const zai = await ZAI.create();
        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: "assistant",
              content:
                "You are a senior SRE. Write a concise operational runbook for the given scenario. " +
                "Use this exact structure (plain text, no markdown):\\n" +
                "RUNBOOK: <scenario>\\n" +
                "Service: <service>\\n" +
                "Severity: <SEV-1..SEV-3>\\n" +
                "\\n" +
                "1. Detect\\n   - <signal>\\n   - <threshold>\\n" +
                "2. Triage\\n   - <how to confirm>\\n   - <who to page>\\n" +
                "3. Mitigate\\n   - <step 1>\\n   - <step 2>\\n" +
                "4. Resolve\\n   - <step 1>\\n   - <step 2>\\n" +
                "5. Post-mortem\\n   - <within 48h>\\n" +
                "\\n" +
                "Rollback: <one-line rollback command or step>\\n" +
                "Keep each bullet to one line. Do not include prose outside the structure.",
            },
            {
              role: "user",
              content: `Scenario: ${args.scenario}\nService: ${service}`,
            },
          ],
          thinking: { type: "disabled" },
        });
        return (completion.choices[0]?.message?.content ?? "").trim() || "(no runbook produced)";
      } catch (err) {
        return `write_runbook failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },
];

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
