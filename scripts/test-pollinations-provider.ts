/**
 * Quick local test for the marq_free provider (Pollinations.ai).
 * Verifies callProvider routes marq_free correctly and returns real content.
 *
 * Usage: npx tsx scripts/test-pollinations-provider.ts
 */
import { callProvider, hasEffectiveApiKey, defaultModelFor } from "../src/lib/providers";

async function main() {
  // Simulate a marq_free provider row (no DB needed for this test).
  const fakeProvider = {
    id: "test-marq-free",
    name: "marq_free",
    displayName: "Marq Free (Always-On)",
    description: "",
    apiEndpoint: "https://text.pollinations.ai/openai",
    apiKey: null,
    models: JSON.stringify(["openai", "mistral"]),
    active: true,
    priority: 100,
    color: "#10b981",
    icon: "shield",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  console.log("hasEffectiveApiKey(marq_free):", hasEffectiveApiKey(fakeProvider));
  console.log("defaultModel:", defaultModelFor("marq_free"));
  console.log("");
  console.log("Calling marq_free with 'Say hi in one short sentence.'...");
  const start = Date.now();
  const result = await callProvider(fakeProvider, {
    messages: [{ role: "user", content: "Say hi in one short sentence." }],
    model: "openai",
  });
  console.log("  content:    ", JSON.stringify(result.content));
  console.log("  model:      ", result.model);
  console.log("  latencyMs:  ", result.latencyMs, "(total:", Date.now() - start, "ms)");
  console.log("  tokensUsed: ", result.tokensUsed);
  console.log("");
  if (!result.content || result.content.trim().length === 0) {
    console.error("FAIL: empty content");
    process.exit(1);
  }
  console.log("PASS: marq_free returns real AI content");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
