/**
 * Set ZAI_TOKEN (and related Z.ai env vars) on the Vercel project using the
 * Vercel REST API. This avoids the need for interactive `vercel login`.
 *
 * Usage:
 *   VERCEL_TOKEN=xxx npx tsx scripts/set-vercel-env.ts
 *
 * The script reads the Z.ai JWT token from the local /etc/.z-ai-config file
 * (the sandbox's built-in Z.ai credentials) and pushes it as an encrypted
 * production env var on the Vercel project.
 *
 * Get a Vercel token at: https://vercel.com/account/tokens
 */
import { readFileSync } from "fs";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
if (!VERCEL_TOKEN) {
  console.error("ERROR: VERCEL_TOKEN env var is not set.");
  console.error("Create a token at https://vercel.com/account/tokens then run:");
  console.error("  VERCEL_TOKEN=xxx npx tsx scripts/set-vercel-env.ts");
  process.exit(1);
}

// Read Z.ai credentials from the sandbox config.
const cfg = JSON.parse(readFileSync("/etc/.z-ai-config", "utf-8"));
const envVars = [
  { key: "ZAI_TOKEN", value: cfg.token },
  { key: "ZAI_BASE_URL", value: cfg.baseUrl },
  { key: "ZAI_API_KEY", value: cfg.apiKey },
  { key: "ZAI_CHAT_ID", value: cfg.chatId },
  { key: "ZAI_USER_ID", value: cfg.userId },
];

// The Vercel project name — matches the GitHub repo name.
// Override with VERCEL_PROJECT_NAME if different.
const projectName = process.env.VERCEL_PROJECT_NAME || "marqaiaggregator";

async function main() {
  console.log(`Setting ${envVars.length} env vars on Vercel project "${projectName}"...`);

  // First, check the project exists and get its ID.
  const projectRes = await fetch(
    `https://api.vercel.com/v9/projects/${projectName}`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
  );
  if (!projectRes.ok) {
    const text = await projectRes.text();
    console.error(`Failed to find project "${projectName}": ${projectRes.status} ${text.slice(0, 300)}`);
    console.error("");
    console.error("If your Vercel project has a different name, set VERCEL_PROJECT_NAME:");
    console.error("  VERCEL_TOKEN=xxx VERCEL_PROJECT_NAME=your-project npx tsx scripts/set-vercel-env.ts");
    process.exit(1);
  }
  const project = await projectRes.json();
  console.log(`  Found project: ${project.name} (id: ${project.id})`);

  // Set each env var.
  for (const { key, value } of envVars) {
    // Check if the env var already exists — if so, delete it first (the Vercel
    // API doesn't support update-in-place via POST).
    const existingRes = await fetch(
      `https://api.vercel.com/v9/projects/${projectName}/env`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
    );
    if (existingRes.ok) {
      const existing = await existingRes.json();
      const dupe = existing.envs?.find((e: { key: string }) => e.key === key);
      if (dupe) {
        console.log(`  Deleting existing ${key} (id: ${dupe.id})...`);
        await fetch(
          `https://api.vercel.com/v9/projects/${projectName}/env/${dupe.id}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
        );
      }
    }

    // Create the env var as encrypted, targeting production.
    const createRes = await fetch(
      `https://api.vercel.com/v10/projects/${projectName}/env`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key,
          value,
          type: "encrypted",
          target: ["production", "preview"],
        }),
      },
    );
    if (createRes.ok) {
      console.log(`  OK  ${key} set (production + preview)`);
    } else {
      const text = await createRes.text();
      console.error(`  FAIL  ${key}: ${createRes.status} ${text.slice(0, 200)}`);
    }
  }

  console.log("");
  console.log("Done! Triggering a redeploy so the new env vars take effect...");

  // Trigger a fresh production deploy from the main branch.
  const deployRes = await fetch(
    `https://api.vercel.com/v13/deployments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName,
        target: "production",
        gitSource: {
          org: "maheshkpreddy",
          repo: "marqaiaggregator",
          ref: "main",
        },
      }),
    },
  );
  if (deployRes.ok) {
    const deploy = await deployRes.json();
    console.log(`  Deploy triggered: ${deploy.url ?? deploy.id}`);
    console.log(`  Watch at: https://vercel.com/maheshkpreddy/${projectName}`);
  } else {
    const text = await deployRes.text();
    console.error(`  Could not auto-trigger deploy: ${deployRes.status} ${text.slice(0, 200)}`);
    console.error("  The env vars are set — just go to Vercel and click 'Redeploy' on the latest deployment.");
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
