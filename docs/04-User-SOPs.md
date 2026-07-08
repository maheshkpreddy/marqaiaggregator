# Marq AI Aggregator — User Standard Operating Procedures (SOPs)

**Version:** 2.0 (SaaS)
**Audience:** End users (all roles), team admins, API integrators
**Last updated:** 2026-07-08

---

## SOP 1: Sign Up and Create Your Workspace

**Who:** Anyone starting a new company account on Marq AI.
**Time:** 2 minutes.

1. Go to https://marqaiaggregator.vercel.app
2. The sign-up form is shown by default. Fill in:
   - **Your name** (e.g. "Jane Doe")
   - **Work email** (e.g. `jane@acme.com`) — this is your login ID
   - **Password** — minimum 8 characters
   - **Organization name** (e.g. "Acme Inc.") — your team will share this workspace
3. Click **Create workspace**.
4. You're in. You're automatically the **Owner** of this organization with full control.

**Notes:**
- The first user to sign up with an org name becomes its owner.
- A single user can belong to multiple organizations (e.g. you might be a member of "Acme Inc." and an owner of "Jane's Personal Workspace"). Use the org switcher in the top-right to switch.

---

## SOP 2: Invite Team Members

**Who:** Org owners and admins.
**Time:** 1 minute per invite.

1. Sign in to your workspace.
2. Click the **Team** tab.
3. Click **Add member**.
4. Enter the invitee's email and pick a role:
   - **Admin** — can manage members, API keys, and providers. Can't change the org plan or delete the org.
   - **Member** — full app use: chat, agents, prompts, files. Can't manage the team or API keys.
   - **Viewer** — read-only. Can see chats, agent runs, and health metrics but can't send messages or run agents.
5. Click **Add member**.

**Important:** The invitee **must already have a Marq AI account** with that email. If they don't, ask them to sign up first (they'll create their own org, but you can still add them to yours afterward — they'll be able to switch between orgs using the org switcher).

**To change a member's role later:** Use the dropdown next to their name in the Team tab. (Only owners can grant admin role.)

**To remove a member:** Click the trash icon next to their name. (Owners cannot be removed. Only owners can remove admins.)

---

## SOP 3: Send a Chat Message (With Auto-Failover)

**Who:** All roles (viewers can read but not send).
**Time:** 10-30 seconds per message.

1. Click the **Chat** tab.
2. (Optional) In the left sidebar, click **New Conversation** for a fresh start, or pick an existing session.
3. ( Optional) Pick a **primary provider** from the dropdown at the top of the chat panel. The default is the highest-priority active provider (usually OpenAI).
4. Type your message in the composer at the bottom.
5. Hit **Enter** (or click the send button).

**What happens next:**
- Your message is saved to the session.
- Marq calls your primary provider.
- If the primary succeeds: the response appears with a green badge showing the provider name.
- If the primary fails (timeout, rate limit, server error, etc.): Marq automatically tries the next provider in priority order. A yellow warning banner appears: "Originally routed to OpenAI, failed over to Gemini — reason: rate_limit".
- If all providers fail: you get a red error message.

**Tips:**
- The chat keeps the last 20 messages as context for each new prompt.
- Click any session in the sidebar to switch context.
- Hover over an assistant message to see latency and token usage.

---

## SOP 4: Compare Model Outputs Side-by-Side

**Who:** All roles (viewer can run comparisons).
**Time:** 10-30 seconds.

Use this when you want to see how different AI models answer the same prompt — useful for picking the best model for a new use case, or for A/B testing prompt changes.

1. Click the **Compare** tab.
2. (Optional) Enter a **System prompt** (e.g. "You are a SQL expert. Respond with only the query, no explanation.").
3. Enter your **Prompt** (e.g. "Write a query to find the top 5 customers by total order value in the last 30 days.").
4. Select which providers to compare — by default, all active providers are selected. Click a provider's pill to toggle it off. At least 2 must be selected.
5. Click **Run comparison**.

**What you see:**
- A grid of cards, one per provider.
- Each card shows: provider name, model name, the response (or error in red if that provider failed), latency in ms, and token count.
- Scroll horizontally if you compared 4+ providers.

**Notes:**
- Comparison does NOT use failover — each provider returns its raw output. This is intentional so you can judge model quality directly.
- The comparison run is saved to your org's history (visible to admins in the database, not yet surfaced in a UI tab — roadmap).

---

## SOP 5: Run an Agent Task

**Who:** All roles except viewer.
**Time:** 10-60 seconds (depends on step count and provider latency).

Agents are role-based AI workers that execute multi-step tasks using tools. Each agent type has a persona, a set of allowed tools, and a max step count.

1. Click the **Agent** tab.
2. Pick an agent type from the gallery (Full-Stack Developer, Testing, Business Analyst, Sales, Product Manager, DevOps, Research, General). Each card shows the persona, allowed tools, and suggested goals.
3. (Optional) Click a suggested goal to pre-fill the input, or type your own goal.
4. (Optional) Pick a primary provider (defaults to OpenAI).
5. (Optional) Adjust max steps (default 8, max 15).
6. Click **Run task**.

**What you see:**
- The task runs synchronously (you'll see a spinner).
- On completion, the **Execution Trace** appears: each step shows the agent's thought, the tool it called, the input it passed, the observation (tool output), which provider answered, latency, and whether that step failed over.
- The **Final Answer** appears at the bottom.
- Past tasks are listed in the left sidebar; click any to re-view its trace.

**Tips:**
- For long tasks (8+ steps), expect 30-60 seconds runtime.
- If a task fails, you can re-run it (the rerun button clears prior steps).
- The same failover engine applies — if the primary model dies mid-task, the agent continues on the next provider transparently.

---

## SOP 6: Save and Reuse a Prompt

**Who:** All roles except viewer.

1. Click the **Prompts** tab.
2. Click **New prompt**.
3. Fill in:
   - **Title** (e.g. "SQL refactor prompt")
   - **Category** (general / engineering / writing / analysis / sales)
   - **Tags** (comma-separated, e.g. `sql, refactor, postgres`)
   - **Body** (the actual prompt text)
4. Click **Save prompt**.

**To reuse a prompt:**
- Find it in the library (use the search box or category filter).
- Click **Use** — the prompt body is loaded into the Chat composer. Switch to the Chat tab and hit send.

**To edit:** Click the pencil icon. **To delete:** Click the trash icon. **To copy to clipboard:** Click the copy icon.

---

## SOP 7: Check Provider Health

**Who:** All roles.

1. Click the **Health** tab.
2. You'll see:
   - **KPI cards** at the top: total providers, healthy count, degraded count, down count.
   - One card per provider showing current status (healthy / degraded / down / unknown), last latency, last error, and last checked time.

**Status meanings:**
- **Healthy** — most recent call succeeded.
- **Degraded** — most recent call failed with a timeout or network error (transient).
- **Down** — most recent call failed with a server error or auth error (likely persistent).
- **Unknown** — no calls have been made yet.

**To force a refresh:** The Health tab auto-refreshes when you switch to it. To trigger fresh data, send a chat message — every chat message writes HealthLog rows for each provider attempt.

---

## SOP 8: Investigate Failover Events

**Who:** All roles.

1. Click the **Failover Log** tab.
2. You'll see a chronological list (newest first) of every failover event in your org:
   - **From** — the provider that failed.
   - **To** — the provider that took over.
   - **Reason** — timeout / rate_limit / auth_error / server_error / network / unknown.
   - **Error message** — the actual error returned by the failed provider.
   - **Session ID** — links to the chat session that triggered the failover (clickable in a future UI enhancement).
   - **Timestamp**.

**Use cases:**
- "Why did our chat fail over at 3am?" — find the row, read the reason.
- "Is Claude becoming less reliable?" — count Claude-failovers over the last week vs. the week before.
- Compliance audit — every failover is recorded for forensic review.

---

## SOP 9: Generate an API Key (for External Integration)

**Who:** Org owners and admins.

1. Click the **API Keys** tab.
2. Click **New key**.
3. Fill in:
   - **Name** (e.g. "Production server", "Zapier integration", "Internal CRM")
   - **Scopes** — check the ones you need:
     - `chat` — for `/api/v1/chat/completions`
     - `compare` — for `/api/v1/compare`
     - `agents` — for `/api/v1/agents/run`
     - `read` — for `/api/v1/models`
4. Click **Create key**.
5. **COPY THE FULL TOKEN NOW.** It looks like `marq_live_<random>`. You will never see it again — only a SHA-256 hash is stored.

**To revoke a key:** Click the trash icon next to it. Revocation is instant.

**To see when a key was last used:** The "Last used" column updates on every API call.

---

## SOP 10: Call Marq AI from External Software

**Who:** Developers integrating Marq into other apps.

Once you have an API key (SOP 9), any HTTP client can call Marq. The API is OpenAI-compatible.

### Example 1: curl

```bash
curl https://marqaiaggregator.vercel.app/api/v1/chat/completions \
  -H "Authorization: Bearer marq_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Summarize this article in 2 sentences: ..."}
    ]
  }'
```

### Example 2: Python (using openai SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="marq_live_YOUR_KEY",
    base_url="https://marqaiaggregator.vercel.app/api/v1"
)

response = client.chat.completions.create(
    model="marq-default",  # ignored — Marq picks per-provider
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
print(f"Failed over: {response.marq.failed_over}")
```

### Example 3: Node.js / JavaScript

```javascript
const response = await fetch("https://marqaiaggregator.vercel.app/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.MARQ_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    messages: [{ role: "user", content: "What's the weather forecast?" }],
    provider: "openai",  // optional: pin to a specific provider
  }),
});
const data = await response.json();
console.log(data.choices[0].message.content);
console.log(`Answered by: ${data.marq.provider.displayName}`);
```

### Example 4: Run an agent task

```bash
curl https://marqaiaggregator.vercel.app/api/v1/agents/run \
  -H "Authorization: Bearer marq_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Project MRR for 100 subscribers at $49 ARPU, 5% monthly churn, 6 months.",
    "agent_type": "sales",
    "max_steps": 5
  }'
```

**Endpoints reference:**

| Endpoint | Method | Required scope | Purpose |
|---|---|---|---|
| `/api/v1/chat/completions` | POST | `chat` | Chat with auto-failover (OpenAI-compatible) |
| `/api/v1/compare` | POST | `compare` | Run one prompt across multiple models |
| `/api/v1/agents/run` | POST | `agents` | Run a role-based agent synchronously |
| `/api/v1/models` | GET | `read` | List available models |

---

## SOP 11: Switch Between Organizations

**Who:** Users belonging to 2+ organizations.

1. Click the org name in the top-right of the header.
2. A dropdown lists all your org memberships with your role in each.
3. Click the org you want to switch to.
4. The page reloads with that org's data: chats, agents, prompts, failovers, etc.

**Notes:**
- Switching orgs does NOT log you out — you keep the same session.
- The active org is stored in a cookie, so it persists across browser sessions.
- All data you see is scoped to the active org. You cannot accidentally see another org's data.

---

## SOP 12: Sign Out

**Who:** All users.

1. Click the **logout icon** (arrow-out) in the top-right of the header, next to your avatar.
2. Your session is revoked server-side and the cookie is cleared.
3. You're returned to the sign-in screen.

**Note:** If you're on a shared computer, always sign out when done. The session cookie is httpOnly so it can't be stolen by XSS, but it can still be used by anyone with access to your browser.

---

## FAQ

**Q: I forgot my password. What do I do?**
A: Password reset is not yet implemented (roadmap). Ask your org owner to remove your membership and re-add you with a new account, or contact support.

**Q: Can I use my own OpenAI API key instead of the demo mode?**
A: Yes — an admin can edit a provider in the Providers tab and paste the API key. The platform will use it for real calls (the demo-mode simulated failure rate is skipped when a key is set). Note: the current build still routes through z-ai-web-dev-sdk for the actual generation; direct OpenAI SDK calls are stubbed but not yet wired in.

**Q: How do I add a new AI provider (e.g. Mistral, DeepSeek)?**
A: An admin goes to the Providers tab, clicks "Add Provider", fills in the name, display name, API endpoint, API key, and model list. Set the priority (0 = primary). The new provider immediately participates in failover.

**Q: What's the difference between the Chat tab and the Compare tab?**
A: Chat uses failover (one provider answers, falling back on failure). Compare runs the same prompt across all selected providers in parallel with NO failover — you see every provider's raw output.

**Q: How long do agent tasks take?**
A: 10-60 seconds typically, depending on step count (default 8, max 15) and provider latency. Vercel's free tier has a 60-second function timeout; if you need longer, upgrade to Pro (300s timeout).

**Q: Can I export my chat history?**
A: Not yet via the UI. You can hit `/api/sessions` and `/api/sessions/{id}/messages` with your session cookie to pull JSON. A CSV export button is on the roadmap.

**Q: Is my data shared between organizations?**
A: No. Every chat, agent task, prompt, file, and failover log is scoped by `orgId`. Users in Org A cannot read Org B's data, even if they know the IDs. API keys are scoped to a single org.

**Q: What happens if I revoke an API key?**
A: All in-flight requests using that key will fail with 401. New requests with that key will also fail. Revocation is instant.

**Q: Can I have multiple API keys?**
A: Yes, unlimited. Best practice: one key per integration (production server, staging, Zapier, internal CRM, etc.) so you can revoke one without affecting others.

**Q: How do I rotate an API key?**
A: Create a new key, update your integration to use it, then revoke the old key. There's no atomic rotation mechanism (roadmap).

**Q: What's the demo login?**
A: `demo@marq.ai` / `marq-demo-123` — created by the seed script on every fresh deploy. Useful for kicking the tires before signing up.
