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
];

export const TOOL_NAMES = TOOLS.map((t) => t.name);

export function getTool(name: string): Tool | undefined {
  return TOOLS.find((t) => t.name === name);
}

/**
 * Build the system-prompt fragment that describes available tools to the LLM.
 */
export function toolDescriptionsForPrompt(): string {
  return TOOLS.map((t) => {
    return `### ${t.name}\n${t.description}\nSignature: ${t.signature}\nExample: ${t.examples[0]}`;
  }).join("\n\n");
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
