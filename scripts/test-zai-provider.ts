/**
 * Quick local test: verify callZaiGlm works with the sandbox's /etc/.z-ai-config.
 * We set ZAI_TOKEN from the config file and invoke the marq_glm provider.
 */
import { readFileSync } from "fs";

// Load the sandbox z-ai config into env vars.
const cfg = JSON.parse(readFileSync("/etc/.z-ai-config", "utf-8"));
process.env.ZAI_TOKEN = cfg.token;
process.env.ZAI_BASE_URL = cfg.baseUrl;
process.env.ZAI_API_KEY = cfg.apiKey;
process.env.ZAI_CHAT_ID = cfg.chatId;
process.env.ZAI_USER_ID = cfg.userId;

import { callProvider } from "../src/lib/providers";

const fakeProvider: any = {
  id: "test",
  name: "marq_glm",
  displayName: "Marq GLM",
  apiKey: null,
  apiEndpoint: null,
  models: JSON.stringify(["glm-4-plus"]),
};

(async () => {
  console.log("Calling marq_glm provider...");
  const result = await callProvider(fakeProvider, {
    messages: [
      { role: "system", content: "You are a helpful assistant. Be concise." },
      { role: "user", content: "How does the Marq AI Aggregator platform work? Answer in 2 sentences." },
    ],
  });
  console.log("Content:", result.content);
  console.log("Model:", result.model);
  console.log("Latency:", result.latencyMs, "ms");
  console.log("Tokens:", result.tokensUsed);
})().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
