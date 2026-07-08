#!/usr/bin/env bash
# Vercel build script for Marq AI Aggregator.
#
# Vercel's serverless functions run on a read-only filesystem, so the local
# SQLite file won't work in production. This script:
#   1. Swaps in the Postgres Prisma schema (prisma/schema.postgres.prisma)
#   2. Runs `prisma generate` (fatal — required for build)
#   3. Runs `prisma db push` (NON-fatal — tables may already exist)
#   4. Seeds default providers (NON-fatal — can re-run later)
#   5. Hands off to `next build` (fatal — required for deploy)
#
# IMPORTANT: We deliberately use `set -o pipefail` only (NOT `set -e` or
# `set -u`) so that DB-connection failures in step 3/4 don't abort the
# whole build. The build can still succeed even if the DB is unreachable —
# the app will surface a runtime error to the user instead.
#
# Required Vercel env vars:
#   DATABASE_URL       — postgres:// connection string (Neon, Supabase, etc.)
#
# Set this file as the "Build Command" in Vercel:
#   Project Settings → Build & Development Settings → Build Command:
#     bash ./vercel-build.sh

set -o pipefail

echo "═══════════════════════════════════════════════════════════"
echo "  Marq AI Aggregator — Vercel build"
echo "═══════════════════════════════════════════════════════════"
echo "Node: $(node -v 2>/dev/null || echo '?')    npm: $(npm -v 2>/dev/null || echo '?')"
echo "VERCEL=$VERCEL  VERCEL_ENV=${VERCEL_ENV:-<unset>}"

# ── Sanity check (warning only — don't abort) ────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "⚠️  DATABASE_URL env var is not set — prisma db push and seed will be skipped."
  echo "    Add a postgres:// connection string in Vercel → Settings → Environment Variables."
  HAVE_DB=0
else
  case "${DATABASE_URL}" in
    postgres*|"postgresql"*)
      echo "✓ DATABASE_URL is a Postgres connection string"
      HAVE_DB=1
      ;;
    *)
      echo "⚠️  DATABASE_URL is not a postgres:// string — prisma db push and seed will be skipped."
      echo "    Got: ${DATABASE_URL:0:30}…"
      HAVE_DB=0
      ;;
  esac
fi

# ── Helper: prefer npx, fall back to bunx ─────────────────────
if command -v npx >/dev/null 2>&1; then
  PX="npx"
elif command -v bunx >/dev/null 2>&1; then
  PX="bunx"
else
  echo "❌ Neither npx nor bunx is available — cannot run prisma generate."
  exit 1
fi
echo "Using runner: $PX"

# ── Swap in the Postgres Prisma schema ────────────────────────
echo "→ Switching Prisma schema to PostgreSQL variant"
cp prisma/schema.prisma prisma/schema.sqlite.prisma.bak
cp prisma/schema.postgres.prisma prisma/schema.prisma

# Restore SQLite schema on exit so local dev isn't broken if build fails.
trap 'mv -f prisma/schema.sqlite.prisma.bak prisma/schema.prisma 2>/dev/null || true' EXIT

# ── Generate Prisma client for Postgres (FATAL) ───────────────
echo "→ Running prisma generate"
if ! $PX prisma generate; then
  echo "❌ prisma generate failed — aborting build."
  exit 1
fi
echo "✓ prisma generate done"

# ── Push schema to Postgres (NON-FATAL) ───────────────────────
if [ "$HAVE_DB" = "1" ]; then
  echo "→ Running prisma db push (creates tables if missing)"
  if $PX prisma db push --accept-data-loss; then
    echo "✓ prisma db push done"
  else
    echo "⚠️  prisma db push failed — tables may already exist with data, or the DB is unreachable."
    echo "    Continuing anyway; the app will fail at runtime only if tables are missing."
  fi
else
  echo "→ Skipping prisma db push (no DATABASE_URL)"
fi

# ── Seed default providers (NON-FATAL) ────────────────────────
if [ "$HAVE_DB" = "1" ]; then
  echo "→ Seeding default providers + demo org/user"
  # Try bun first (pre-installed on Vercel build image), fall back to npx tsx
  if command -v bun >/dev/null 2>&1; then
    if bun run scripts/seed.ts; then
      echo "✓ Seed done (via bun)"
    else
      echo "⚠️  Seed step failed via bun — continuing. You can re-run with 'bun run seed' later."
    fi
  else
    echo "  (bun not on PATH — skipping seed; re-run 'npm run seed' locally if needed)"
  fi
else
  echo "→ Skipping seed (no DATABASE_URL)"
fi

# ── Run Next.js build (FATAL) ─────────────────────────────────
echo "→ Running next build"
if ! $PX next build; then
  echo "❌ next build failed — aborting."
  exit 1
fi
echo "✓ next build done"

echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Vercel build complete"
echo "═══════════════════════════════════════════════════════════"
