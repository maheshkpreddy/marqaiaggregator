#!/usr/bin/env bash
# Minimal Vercel build script — diagnostic version.
# Only does: schema swap → prisma generate → next build.
# Skips: prisma db push, seed (those are runtime concerns; can be run manually).
set +e
set -o pipefail

echo "═══════════════════════════════════════════════════════════"
echo "  Marq AI Aggregator — Vercel build (minimal)"
echo "═══════════════════════════════════════════════════════════"
echo "Node: $(node -v 2>/dev/null)    npm: $(npm -v 2>/dev/null)"
echo "VERCEL=$VERCEL  VERCEL_ENV=${VERCEL_ENV:-<unset>}"
echo "DATABASE_URL present: $([ -n "${DATABASE_URL:-}" ] && echo yes || echo no)"

# ── Swap in the Postgres Prisma schema ────────────────────────
echo "→ Switching Prisma schema to PostgreSQL variant"
cp prisma/schema.prisma prisma/schema.sqlite.prisma.bak
cp prisma/schema.postgres.prisma prisma/schema.prisma
trap 'mv -f prisma/schema.sqlite.prisma.bak prisma/schema.prisma 2>/dev/null || true' EXIT

# ── Generate Prisma client for Postgres ───────────────────────
echo "→ Running prisma generate"
npx prisma generate
GEN_EXIT=$?
echo "prisma generate exit code: $GEN_EXIT"
if [ $GEN_EXIT -ne 0 ]; then
  echo "❌ prisma generate failed — aborting build."
  exit 1
fi

# ── Run Next.js build ─────────────────────────────────────────
echo "→ Running next build"
npx next build
NB_EXIT=$?
echo "next build exit code: $NB_EXIT"
if [ $NB_EXIT -ne 0 ]; then
  echo "❌ next build failed — aborting."
  exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Vercel build complete (minimal)"
echo "═══════════════════════════════════════════════════════════"
exit 0
