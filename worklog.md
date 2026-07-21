---
Task ID: super-admin-console-and-approval-workflow
Agent: main (super-z)
Task: User requested a super admin login system with role-based access underneath, plus a company registration approval workflow where any new company that registers for the service comes to the super admin for approval, and the super admin assigns the service options based on the pricing strategy / subscription plan. Update the Vercel link.

Work Log:
- Investigated existing architecture: Marq AI already had per-org RBAC (owner/admin/member/viewer) but no global super-admin role, no company approval workflow, no subscription plan catalog.
- Updated Prisma schema (both SQLite + Postgres variants kept in sync):
  - User.globalRole: "user" | "super_admin" (default "user")
  - User.suspendedAt: nullable timestamp
  - Organization.status: "pending_approval" | "approved" | "rejected" | "suspended" (default "pending_approval")
  - Organization.rejectionReason, adminNote, registeredBy, planAssignedAt
  - New SubscriptionPlan model: code, name, priceMonthlyUsd, seatsIncluded, requestsPerMonth, features (CSV), publicVisible, sortOrder, active
- Extended src/lib/auth.ts:
  - AuthContext now exposes isSuperAdmin + org.status
  - getAuthContext bypasses org membership for super admins (synthetic context with role=owner)
  - Suspended users (user.suspendedAt set) get null context = can't log in
  - New requireSuperAdmin() guard for platform-wide routes
  - New requireApprovedOrg() guard that returns 403 with pendingApproval flag
  - requireRole() now bypasses for super admins
- Updated auth API routes:
  - POST /api/auth/signup: new orgs default to pending_approval; auto-approved ONLY when the platform has zero orgs (first-deploy bootstrapping). Stamps registeredBy.
  - POST /api/auth/login: blocks login for pending/rejected/suspended orgs with descriptive errors; super admins always allowed; surfaces globalRole.
  - GET /api/auth/me: surfaces globalRole + isSuperAdmin + per-org status.
  - POST /api/auth/switch-org: surfaces org.status in the response.
- Created 5 new admin API routes (all super-admin-only via requireSuperAdmin):
  - GET /api/admin/stats: platform-wide metrics (org counts by status, user counts, plan distribution, activity totals)
  - GET /api/admin/orgs?status=...&plan=...&q=...: list/filter/search all orgs with owner + counts
  - PATCH /api/admin/orgs/[id]: approve / reject / suspend / restore + change plan + override seats + attach admin note + rejectionReason
  - GET /api/admin/users?q=...: list all users with their memberships
  - PATCH /api/admin/users/[id]: promote/demote super_admin + suspend/unsuspend (with self-protection and last-super-admin protection)
  - GET /api/admin/plans: public catalog for non-admins, full catalog for super admins
  - POST /api/admin/plans: create new subscription plan
- Created SuperAdminPanel component (src/components/super-admin-panel.tsx) with 5 tabs:
  - Overview: stat cards + plan distribution + needs-attention list
  - Approvals: pending company registrations with red badge count + review dialog (plan selector, seats input, admin note, reject expander)
  - Organizations: search + status filter + inline plan switcher + suspend/restore actions
  - Users: search + promote/demote super admin + suspend/reinstate
  - Plans: pricing matrix with all 5 default plans + active-org counts
- Wired SuperAdminPanel into src/app/page.tsx:
  - Added "super-admin" to tab type
  - Added isSuperAdmin state
  - Added violet-accented "Super Admin" nav item (visible only to super admins)
  - Added SuperAdminOnlyShell for super admins with no org membership (full-screen admin console)
  - Added OrgPendingScreen for regular users whose org is pending/rejected/suspended (explains the situation, no app access)
  - Added "★ Super Admin" badge in the sidebar footer
  - Updated NavItem to support an accent prop (emerald default, violet for super admin)
- Updated scripts/seed.ts:
  - Creates admin@marq.ai / marq-admin-123 as globalRole="super_admin"
  - Creates 5 default subscription plans (free, starter $29, pro $99, enterprise $499, custom private)
  - Auto-approves the demo org (status="approved")
  - Backfills legacy demo orgs to status="approved" (idempotent)
- Verified everything:
  - npx prisma db push + npx prisma generate: succeeded
  - npx tsx scripts/seed.ts: created super admin + 5 plans + demo org (all approved)
  - npx tsc --noEmit: 0 errors
  - npx next build: 54 routes compiled (5 new admin routes), 0 warnings
  - Smoke test (scripts/smoke-test-admin.sh): admin/stats, admin/plans, admin/orgs, admin/users all return correct data; regular user gets 403 on admin endpoints
  - E2E approval test (scripts/e2e-test-approval.sh): signup → pending_approval → super admin sees in queue → approves with Pro plan + 25 seats → user can now log in → /api/auth/me confirms plan=pro, status=approved
  - Rejection test: super admin rejects with reason → spammer's next login attempt sees the rejection reason in the error message
- Committed locally with detailed commit message.

Stage Summary:
- Super admin credentials: admin@marq.ai / marq-admin-123 (seeded on every fresh deploy)
- New company signups are blocked from app access until a super admin approves them
- Super admin can assign any of 5 subscription plans (free/starter/pro/enterprise/custom) during approval, override seat counts, attach internal notes, or reject with a reason shown to the user on their next login attempt
- Super admin can also: suspend an org (billing/TOS issue), promote other users to super admin, suspend abusive users (kills their active sessions), and edit the subscription plan catalog
- RBAC is enforced at the API layer — regular users get HTTP 403 on /api/admin/* endpoints even if they craft requests manually
- Self-protection built in: a super admin cannot demote/suspend themselves, and the last super admin cannot be demoted (prevents platform lock-out)
- The commit is local; user needs to `git push origin main` to deploy to Vercel (sandbox lacks GitHub push credentials). All schema + code changes are ready for Vercel's automatic build (vercel-build.sh will swap in the Postgres schema and run prisma db push before building).

---
Task ID: push-to-git-and-vercel-deploy
Agent: main (super-z)
Task: Push the completed super admin / RBAC / approval workflow / subscription plan / custom API builder / failover fix code to GitHub and trigger Vercel deployment using the user-provided PAT.

Work Log:
- Inspected repo state: 15 unpushed commits on local main vs origin/main (last pushed commit was 057e9f5 "feat(gemini): embed Gemini Chat as a tab inside the aggregator"). Local HEAD was d29823a "docs: worklog + smoke/e2e test scripts for super admin workflow".
- The unpushed commits include: Custom API Builder with AI-powered provider selection, Marq AI failover timeout fix, super admin console + company approval workflow, chat soft-delete, Gemini SSE parsing fixes, header z-index fix, smoke/e2e test scripts.
- Configured git remote.origin.url with embedded PAT (ghp_***) for one-shot authenticated push, then immediately restored the clean URL (no token) afterward so the PAT is NOT persisted in git config.
- Ran `git push origin main` — successful fast-forward: 9019341..d29823a. All 15 commits now on origin/main.
- Verified sync: `git log origin/main..HEAD` is empty (local and remote HEAD both point at d29823a).
- Vercel CLI not installed locally and no .vercel project link present; deployment must be triggered via the existing GitHub→Vercel auto-deploy integration on the main branch.

Stage Summary:
- All 15 commits pushed to https://github.com/maheshkpreddy/marqaiaggregator (main branch).
- Vercel auto-deploy should fire automatically from the GitHub push (project uses vercel.json with buildCommand: bash ./vercel-build.sh, installCommand: npm install --legacy-peer-deps, regions: iad1).
- The Vercel build script will: prisma generate (postgres schema) → prisma db push → seed default providers + super admin account (admin@marq.ai / marq-admin-123) + 5 subscription plans + demo org → next build.
- SECURITY: The user shared a GitHub PAT in chat. They should rotate/revoke it at https://github.com/settings/tokens immediately, since it is now exposed in the chat transcript.
- Post-deploy verification commands the user can run against their Vercel URL:
    curl -X POST https://<vercel-url>/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@marq.ai","password":"marq-admin-123"}'
  Then hit /api/admin/stats, /api/admin/orgs?status=pending_approval, /api/admin/plans with the session cookie.

---
Task ID: per-org-module-access-rights
Agent: main (super-z)
Task: User reported that the Super Admin module has no module-wise access-rights assignment option per company. Add per-org module-level access control so the super admin can grant or revoke individual modules (Chat, Agents, Compare, Gemini, Analytics, etc.) per company, on top of the plan's default feature set. Push to git + Vercel.

Work Log:
- Audited existing access model: SubscriptionPlan.features CSV was the only knob — no per-org overrides. The 18 sidebar tabs (chat, agents, compare, prompts, custom-api, directory, unified-ai, gemini, guide, providers, health, failovers, analytics, org, apikeys, docs, chat-history, dashboard) were ALL shown to every approved org regardless of plan.
- Schema changes (kept SQLite + Postgres in sync):
  - New model OrgModuleAccess { id, orgId, moduleKey, enabled, note, updatedBy, createdAt, updatedAt }
  - @@unique([orgId, moduleKey]) — one row per (org, module)
  - Added `moduleAccess OrgModuleAccess[]` relation on Organization
- New constants in src/lib/auth.ts:
  - MODULE_CATALOG: 18 modules with { key, label, group, description, alwaysOn? }
  - ALWAYS_ON_MODULES: ["dashboard", "docs"] — cannot be revoked
  - MODULE_KEYS: derived list of all keys
- New helper `resolveOrgModules(orgId, planCode)`:
  1. Start with plan.features CSV (empty = all modules)
  2. Apply OrgModuleAccess rows (enabled=true → add, enabled=false → remove)
  3. Force-add ALWAYS_ON_MODULES
  4. Filter against MODULE_CATALOG for legacy data safety
- Updated getAuthContext() to populate AuthContext.allowedModules (super admins get MODULE_KEYS; org users get resolveOrgModules result).
- New convenience helper hasModule(ctx, key).
- New API route /api/admin/orgs/[id]/modules:
  - GET: returns { catalog, planCode, planName, planFeatures, alwaysOn, overrides, effective }
  - PUT: body { modules: [{ moduleKey, enabled, note? }] } — atomically replaces all overrides; always-on modules are forced enabled; modules matching plan default have their override dropped (so the table only stores actual overrides).
  - Both guarded by requireSuperAdmin().
- Updated /api/auth/me to surface allowedModules at the top level AND inside each membership (so the frontend can re-filter the sidebar when the user switches orgs without an extra round-trip).
- Frontend src/app/page.tsx:
  - Added `allowedModules` state + `hasModule(key)` helper.
  - Wrapped every sidebar NavItem in hasModule(key) check (16 modules gated; dashboard + docs + super-admin always visible).
  - Added useEffect that bounces the user to /dashboard if their active tab is no longer permitted (e.g. super admin revoked access while they were on it).
  - Updated handleAuthSuccess, handleLogout, handleSwitchOrg to keep allowedModules in sync.
- Frontend src/components/super-admin-panel.tsx:
  - New "Modules" button on every org row (pending + approved + suspended/rejected) — opens the Module Access dialog.
  - Module Access dialog: shows ALL 18 modules grouped by Build/Discover/Settings/Help/System, each with a Switch + optional note input. Highlights overrides vs plan defaults with colored badges. "Reset to plan" button restores plan defaults. Save commits via PUT /api/admin/orgs/[id]/modules.
  - Summary bar shows counts (total / enabled / disabled / plan default).
- Verified build: `npx tsc --noEmit` clean, `npx next build` succeeded with new route /api/admin/orgs/[id]/modules present in build output.

Stage Summary:
- Per-org module-wise access rights are now fully implemented end-to-end:
  schema → API → super admin UI → org user sidebar filtering.
- Super admin can: open any company → toggle any of 18 modules on/off → save → org user's sidebar updates on their next page load.
- Always-on modules (Dashboard, Docs) cannot be revoked.
- Plan defaults are still respected — overrides are stored only when the super admin's choice differs from the plan.
- Files changed: prisma/schema.prisma, prisma/schema.postgres.prisma, src/lib/auth.ts, src/app/api/auth/me/route.ts, src/app/page.tsx, src/components/super-admin-panel.tsx, src/app/api/admin/orgs/[id]/modules/route.ts (new).
- Next: commit + push to GitHub origin/main → Vercel auto-deploys via the existing GitHub integration.
