/**
 * Stress-test the failover engine: send N messages via the chat API
 * and report how many triggered failover. Run with:
 *   bun run /home/z/my-project/scripts/stress-chat.ts
 */

const SESSION_ID = process.argv[2] || undefined;

async function main() {
  const messages = [
    "Say hello in one short sentence.",
    "What is 2+2? Reply with just the number.",
    "Tell me a fun fact in one sentence.",
    "What's the capital of France? One word.",
    "Say hi in Spanish, one word.",
    "Tell me a one-sentence joke.",
    "What color is the sky? One word.",
    "Name a planet. One word.",
    "Say goodbye in one sentence.",
    "What's 5*5? One word.",
    "Tell me another fun fact, one sentence.",
    "What's the largest mammal? One word.",
    "Say hi in French, one word.",
    "What's your name? One sentence.",
    "Tell me a riddle in one sentence.",
  ];

  let failoverCount = 0;
  let successCount = 0;
  let firstFailoverSessionId: string | null = null;

  for (let i = 0; i < messages.length; i++) {
    const body = {
      sessionId: SESSION_ID,
      message: messages[i],
      primaryProviderId: undefined, // use priority default (Claude first since it has 18% fail rate when pinned)
    };
    // Pin Claude as primary by leaving it to the server's default priority order — OpenAI is #0.
    // To force failover, we'll explicitly request Claude as primary.
    const providerRes = await fetch("http://localhost:3000/api/providers");
    const providerData = await providerRes.json();
    const claude = providerData.providers.find((p: any) => p.name === "claude");
    if (claude) body.primaryProviderId = claude.id;

    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.log(`[${i + 1}/${messages.length}] FAILED: ${data.error} / ${data.detail}`);
      continue;
    }
    if (data.failedOver) {
      failoverCount++;
      firstFailoverSessionId = firstFailoverSessionId ?? data.sessionId;
      console.log(
        `[${i + 1}/${messages.length}] FAILOVER: ${data.originalProvider?.displayName} → ${data.provider.displayName} (reason: ${data.attempts[0]?.reason})`,
      );
    } else {
      successCount++;
      console.log(
        `[${i + 1}/${messages.length}] OK: ${data.provider.displayName} (${data.message.latencyMs}ms)`,
      );
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total messages:  ${messages.length}`);
  console.log(`Primary success: ${successCount}`);
  console.log(`Failovers:       ${failoverCount}`);
  console.log(`First session:   ${firstFailoverSessionId ?? "n/a"}`);

  // Check the failover log API.
  const logRes = await fetch("http://localhost:3000/api/failovers?limit=20");
  const logData = await logRes.json();
  console.log(`\nFailover log entries: ${logData.failovers?.length ?? 0}`);
  if (logData.failovers?.length > 0) {
    for (const f of logData.failovers.slice(0, 5)) {
      console.log(
        `  - ${f.fromProvider.displayName} → ${f.toProvider.displayName} (${f.reason}) at ${f.createdAt}`,
      );
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
