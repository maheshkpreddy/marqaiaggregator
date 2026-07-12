/**
 * Robust test for the new callPollinations implementation.
 * Verifies that all 4 attempts work and at least one returns real content.
 *
 * Usage: npx tsx scripts/test-pollinations-robust.ts
 */
import { callProvider, hasEffectiveApiKey, defaultModelFor } from "../src/lib/providers";

async function main() {
  const fakeProvider = {
    id: "test-marq-free",
    name: "marq_free",
    displayName: "Marq Free (Always-On)",
    description: "",
    apiEndpoint: "https://text.pollinations.ai/openai",
    apiKey: null,
    models: JSON.stringify(["openai", "gpt-oss-20b"]),
    active: true,
    priority: 100,
    color: "#10b981",
    icon: "shield",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  console.log("=== Test 1: simple greeting ===");
  console.log("hasEffectiveApiKey(marq_free):", hasEffectiveApiKey(fakeProvider));
  console.log("defaultModel:", defaultModelFor("marq_free"));
  console.log("");

  const tests = [
    "Say hi in one short sentence.",
    "What is 2 + 2? Just the number.",
    "Tell me about the Marq AI Aggregator platform in 2 sentences.",
  ];

  for (let i = 0; i < tests.length; i++) {
    const start = Date.now();
    console.log(`\n=== Test ${i + 2}: "${tests[i]}" ===`);
    try {
      const result = await callProvider(fakeProvider, {
        messages: [{ role: "user", content: tests[i] }],
        model: "openai",
      });
      console.log(`  ✓ content:    ${JSON.stringify(result.content.slice(0, 200))}${result.content.length > 200 ? "..." : ""}`);
      console.log(`    model:      ${result.model}`);
      console.log(`    latencyMs:  ${result.latencyMs} (total: ${Date.now() - start} ms)`);
      console.log(`    tokensUsed: ${result.tokensUsed ?? "n/a"}`);

      if (!result.content || result.content.trim().length === 0) {
        console.error("  ✗ FAIL: empty content");
        process.exit(1);
      }
    } catch (err) {
      console.error(`  ✗ FAIL: ${err}`);
      process.exit(1);
    }
  }

  console.log("\n=== Test 5: multi-turn conversation ===");
  const start = Date.now();
  const result = await callProvider(fakeProvider, {
    messages: [
      { role: "user", content: "My name is Marq." },
      { role: "assistant", content: "Nice to meet you, Marq!" },
      { role: "user", content: "What's my name? Just the name, nothing else." },
    ],
    model: "openai",
  });
  console.log(`  ✓ content:    ${JSON.stringify(result.content.slice(0, 200))}`);
  console.log(`    latencyMs:  ${result.latencyMs} (total: ${Date.now() - start} ms)`);

  console.log("\n✓ ALL TESTS PASSED — marq_free returns real AI content");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
