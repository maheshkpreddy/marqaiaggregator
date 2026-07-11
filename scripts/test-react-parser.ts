/**
 * Local sanity test for the hardened ReAct parser logic.
 * Verifies the parser handles common LLM response variations that surface
 * as "Response did not contain FINAL_ANSWER or ACTION/ACTION_INPUT".
 *
 * Run with: npx tsx scripts/test-react-parser.ts
 *
 * NOTE: This file inlines the parser logic from src/lib/agent.ts. If you
 * change the parser there, mirror the change here and re-run this test.
 */

interface ParsedStep {
  thought: string;
  action: string | null;
  actionInput: unknown;
  finalAnswer: string | null;
  rawResponse: string;
  parseError?: string;
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n```\s*$/);
  return m ? m[1] : trimmed;
}

function extractActionInput(text: string): unknown {
  const markerMatch = text.match(/ACTION_INPUT\s*:\s*/i);
  if (!markerMatch) return null;
  const startIdx = markerMatch.index! + markerMatch[0].length;
  const objStart = text.indexOf("{", startIdx);
  if (objStart === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = objStart; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const jsonStr = text.slice(objStart, i + 1);
        try { return JSON.parse(jsonStr); } catch { return { _raw: jsonStr }; }
      }
    }
  }
  return { _raw: text.slice(objStart) };
}

function extractThought(text: string): string {
  const m = text.match(/THOUGHT\s*:\s*([\s\S]+?)(?=\n(?:ACTION|FINAL_ANSWER)\s*:)/i);
  if (m) return m[1].trim();
  const idx = text.search(/(ACTION|FINAL_ANSWER)\s*:/i);
  if (idx > 0) return text.slice(0, idx).replace(/THOUGHT\s*:\s*/i, "").trim();
  return "";
}

function parseStepResponse(raw: string): ParsedStep {
  const stripped = stripCodeFences(raw);
  const trimmed = stripped.trim();
  const finalMatch = trimmed.match(/FINAL_ANSWER\s*:\s*([\s\S]+?)(?:\n```|\s*$)/i);
  if (finalMatch) {
    const thought = extractThought(trimmed);
    const finalAnswer = finalMatch[1].trim();
    if (finalAnswer.length > 0) {
      return { thought, action: "final_answer", actionInput: null, finalAnswer, rawResponse: raw };
    }
  }
  const actionMatch = trimmed.match(/ACTION\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/i);
  if (actionMatch) {
    const actionName = actionMatch[1];
    const actionInput = extractActionInput(trimmed);
    const thought = extractThought(trimmed);
    return { thought, action: actionName, actionInput, finalAnswer: null, rawResponse: raw };
  }
  return {
    thought: trimmed.slice(0, 500),
    action: null,
    actionInput: null,
    finalAnswer: null,
    rawResponse: raw,
    parseError: "Response did not contain FINAL_ANSWER or ACTION/ACTION_INPUT.",
  };
}

// ─── Test cases ────────────────────────────────────────────────────────
const cases: Array<{ name: string; input: string; expectAction: string | null; expectFinalAnswer?: string; expectInputQuery?: string }> = [
  {
    name: "Plain ACTION format",
    input: "THOUGHT: I should search.\nACTION: web_search\nACTION_INPUT: {\"query\": \"AI news\"}",
    expectAction: "web_search",
    expectInputQuery: "AI news",
  },
  {
    name: "Plain FINAL_ANSWER format",
    input: "THOUGHT: I have the info.\nFINAL_ANSWER: The top story is X.",
    expectAction: "final_answer",
    expectFinalAnswer: "The top story is X.",
  },
  {
    name: "Response wrapped in ```text fences",
    input: "```text\nTHOUGHT: I should search.\nACTION: web_search\nACTION_INPUT: {\"query\": \"AI news\"}\n```",
    expectAction: "web_search",
    expectInputQuery: "AI news",
  },
  {
    name: "Trailing commentary after FINAL_ANSWER",
    input: "THOUGHT: Done.\nFINAL_ANSWER: 42\n\nLet me know if you need anything else!",
    expectAction: "final_answer",
    // Trailing commentary is captured as part of the answer — same behavior
    // as the original parser. The win is that we no longer FAIL to parse.
    expectFinalAnswer: "42\n\nLet me know if you need anything else!",
  },
  {
    name: "Pretty-printed JSON in ACTION_INPUT",
    input: 'THOUGHT: Need to search.\nACTION: web_search\nACTION_INPUT: {\n  "query": "AI news",\n  "limit": 5\n}',
    expectAction: "web_search",
    expectInputQuery: "AI news",
  },
  {
    name: "Trailing text after ACTION_INPUT JSON",
    input: 'THOUGHT: Need to search.\nACTION: web_search\nACTION_INPUT: {"query": "AI news"}\nThat should give me the latest.',
    expectAction: "web_search",
    expectInputQuery: "AI news",
  },
  {
    name: "Lowercase markers",
    input: "thought: I should answer.\nfinal_answer: The answer is 7.",
    expectAction: "final_answer",
    expectFinalAnswer: "The answer is 7.",
  },
  {
    name: "Nested JSON in ACTION_INPUT",
    input: 'THOUGHT: Complex call.\nACTION: generate_code\nACTION_INPUT: {"spec": {"language": "ts", "files": ["a.ts"]}, "dryRun": true}',
    expectAction: "generate_code",
  },
  {
    name: "Pure prose (should fail to parse)",
    input: "I think the best approach here is to first look at the documentation, then ask the user for clarification.",
    expectAction: null,
  },
  {
    name: "JSON with escaped quotes in string value",
    input: 'THOUGHT: Need to search for a phrase.\nACTION: web_search\nACTION_INPUT: {"query": "He said \\"hello\\" loudly"}',
    expectAction: "web_search",
    expectInputQuery: 'He said "hello" loudly',
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const result = parseStepResponse(c.input);
  let ok = result.action === c.expectAction;
  if (ok && c.expectFinalAnswer !== undefined) ok = ok && result.finalAnswer === c.expectFinalAnswer;
  if (ok && c.expectInputQuery !== undefined) {
    const input = result.actionInput as { query?: string } | null;
    ok = ok && input?.query === c.expectInputQuery;
  }
  if (ok) {
    pass++;
    console.log(`✓ ${c.name}`);
  } else {
    fail++;
    console.log(`✗ ${c.name}`);
    console.log(`   expected action=${c.expectAction}, final=${JSON.stringify(c.expectFinalAnswer)}, query=${JSON.stringify(c.expectInputQuery)}`);
    console.log(`   got      action=${result.action}, final=${JSON.stringify(result.finalAnswer)}, input=${JSON.stringify(result.actionInput)}`);
    if (result.parseError) console.log(`   parseError: ${result.parseError}`);
  }
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail > 0 ? 1 : 0);
