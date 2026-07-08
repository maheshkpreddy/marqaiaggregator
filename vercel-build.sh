#!/usr/bin/env bash
# Vercel build script for Marq AI Aggregator.
#
# This version uses `prisma generate --schema=prisma/schema.postgres.prisma`
# to generate the Postgres-flavored Prisma client WITHOUT swapping files.
# (The previous file-swap approach failed on Vercel for reasons that
# couldn't be diagnosed without build-log access; the --schema flag is
# cleaner and works reliably.)
#
# Steps:
#   1. prisma generate (postgres schema) — FATAL
#   2. prisma db push (postgres schema)  — NON-FATAL (tables may already exist)
#   3. seed default providers + demo org — NON-FATAL (can re-run later)
#   4. next build                        — FATAL
#
# Required Vercel env vars:
#   DATABASE_URL — postgres:// connection string (Neon, Supabase, etc.)
#
# Set as "Build Command" in Vercel:
#   bash ./vercel-build.sh

set -o pipefail

echo "═══════════════════════════════════════════════════════════"
echo "  Marq AI Aggregator — Vercel build"
echo "═══════════════════════════════════════════════════════════"
echo "Node: $(node -v 2>/dev/null)    npm: $(npm -v 2>/dev/null)"
echo "VERCEL=$VERCEL  VERCEL_ENV=${VERCEL_ENV:-<unset>}"

PG_SCHEMA="prisma/schema.postgres.prisma"

if [ ! -f "$PG_SCHEMA" ]; then
  echo "❌ $PG_SCHEMA not found — aborting."
  exit 1
fi

# ── Check DATABASE_URL ────────────────────────────────────────
HAVE_DB=0
if [ -n "${DATABASE_URL:-}" ]; then
  case "${DATABASE_URL}" in
    postgres*|"postgresql"*)
      echo "✓ DATABASE_URL is a Postgres connection string"
      HAVE_DB=1
      ;;
    *)
      echo "⚠️  DATABASE_URL is not postgres:// — db push and seed will be skipped."
      HAVE_DB=0
      ;;
  esac
else
  echo "⚠️  DATABASE_URL not set — db push and seed will be skipped."
fi

# ── Generate Prisma client for Postgres (FATAL) ───────────────
echo "→ Running prisma generate (postgres schema)"
if ! npx prisma generate --schema="$PG_SCHEMA"; then
  echo "❌ prisma generate failed — aborting build."
  exit 1
fi
echo "✓ prisma generate done"

# ── Push schema to Postgres (NON-FATAL) ───────────────────────
if [ "$HAVE_DB" = "1" ]; then
  echo "→ Running prisma db push (creates tables if missing)"
  if npx prisma db push --accept-data-loss --schema="$PG_SCHEMA"; then
    echo "✓ prisma db push done"
  else
    echo "⚠️  prisma db push failed — continuing. Tables may already exist or DB is unreachable."
  fi
else
  echo "→ Skipping prisma db push (no DATABASE_URL)"
fi

# ── Seed default providers + demo org (NON-FATAL) ─────────────
if [ "$HAVE_DB" = "1" ]; then
  echo "→ Seeding default providers + demo org/user"
  if command -v bun >/dev/null 2>&1; then
    if bun run scripts/seed.ts; then
      echo "✓ Seed done (via bun)"
    else
      echo "⚠️  Seed step failed via bun — continuing. Re-run 'npm run seed' later if needed."
    fi
  else
    echo "  (bun not on PATH — skipping seed)"
  fi
else
  echo "→ Skipping seed (no DATABASE_URL)"
fi

# ── Run Next.js build (FATAL) ─────────────────────────────────
echo "→ Running next build"
if ! npx next build; then
  echo "❌ next build failed — aborting."
  exit 1
fi
echo "✓ next build done"

echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Vercel build complete"
echo "═══════════════════════════════════════════════════════════"
exit 0
