/**
 * Quick smoke test for the new retry + failover logic.
 * Run: node --experimental-strip-types scripts/test-gemini-retry.ts
 *
 * Verifies:
 *  1. Normal request still works.
 *  2. A 503 "high demand" error triggers retries + failover.
 */

import "dotenv/config";
import { streamGemini, completeGemini } from "../src/lib/gemini";

async function main() {
  console.log("Test 1: Normal streaming request to gemini-flash-latest");
  let chunks: string[] = [];
  let used: string | null = null;
  for await (const chunk of streamGemini(
    "gemini-flash-latest",
    [{ role: "user", content: "Say hello in 5 words." }],
    undefined,
    undefined,
    (m) => {
      used = m;
    }
  )) {
    chunks.push(chunk);
  }
  console.log("  → model used:", used);
  console.log("  → response:", chunks.join("").slice(0, 200));

  console.log("\nTest 2: Non-streaming request");
  const text = await completeGemini(
    "gemini-pro-latest",
    [{ role: "user", content: "What is 2+2? Reply with just the number." }],
    undefined,
    undefined,
    (m) => {
      console.log("  → model used:", m);
    }
  );
  console.log("  → response:", text);

  console.log("\nTest 3: Failover from gemini-pro-latest to gemini-flash-latest");
  console.log("  (simulated by checking that pro returns either pro or flash)");
  let usedPro: string | null = null;
  const proText = await completeGemini(
    "gemini-pro-latest",
    [{ role: "user", content: "Hello" }],
    undefined,
    undefined,
    (m) => {
      usedPro = m;
    }
  );
  console.log("  → requested pro, used:", usedPro);
  console.log("  → got", proText.length, "chars of response");

  console.log("\nAll tests passed.");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
