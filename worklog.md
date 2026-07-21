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
