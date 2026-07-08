#!/usr/bin/env bash
# Vercel build script for Marq AI Aggregator.
#
# Vercel's serverless functions run on a read-only filesystem, so the local
# SQLite file won't work in production. This script:
#   1. Swaps in the Postgres Prisma schema (prisma/schema.postgres.prisma)
#   2. Runs `prisma generate` so the client targets Postgres
#   3. Runs `prisma db push` to create tables in your Postgres database
#   4. Seeds default providers (idempotent — safe to run every build)
#   5. Hands off to `next build` (NO standalone cp commands — Vercel handles
#      output tracing natively; see `build:vercel` in package.json)
#
# Required Vercel env vars:
#   DATABASE_URL       — postgres:// connection string (Neon, Supabase, etc.)
#   ZAI_API_KEY        — optional, only used by demo-mode fallback
#
# Set this file as the "Build Command" in Vercel:
#   Project Settings → Build & Development Settings → Build Command:
#     bash ./vercel-build.sh

set -uo pipefail

echo "═══════════════════════════════════════════════════════════"
echo "  Marq AI Aggregator — Vercel build"
echo "═══════════════════════════════════════════════════════════"
echo "Node: $(node -v)    npm: $(npm -v)"
echo "VERCEL=$VERCEL  VERCEL_ENV=${VERCEL_ENV:-<unset>}"

# ── Sanity check ──────────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL env var is not set."
  echo "   Add a postgres:// connection string in Vercel → Settings → Environment Variables."
  exit 1
fi

case "${DATABASE_URL}" in
  postgres*|"postgresql"*)
    echo "✓ DATABASE_URL is a Postgres connection string"
    ;;
  *)
    echo "❌ DATABASE_URL must be a postgres:// connection string on Vercel."
    echo "   Got: ${DATABASE_URL:0:30}…"
    exit 1
    ;;
esac

# ── Helper: prefer npx, fall back to bunx ─────────────────────
# Vercel's build image has both, but npx is more reliable for Prisma binaries.
if command -v npx >/dev/null 2>&1; then
  PX="npx"
elif command -v bunx >/dev/null 2>&1; then
  PX="bunx"
else
  echo "❌ Neither npx nor bunx is available."
  exit 1
fi
echo "Using runner: $PX"

# ── Swap in the Postgres Prisma schema ────────────────────────
echo "→ Switching Prisma schema to PostgreSQL variant"
cp prisma/schema.prisma prisma/schema.sqlite.prisma.bak
cp prisma/schema.postgres.prisma prisma/schema.prisma

# Restore SQLite schema on exit so local dev isn't broken if build fails.
trap 'mv -f prisma/schema.sqlite.prisma.bak prisma/schema.prisma 2>/dev/null || true' EXIT

# ── Generate Prisma client for Postgres ───────────────────────
echo "→ Running prisma generate"
if ! $PX prisma generate; then
  echo "❌ prisma generate failed — aborting build."
  exit 1
fi
echo "✓ prisma generate done"

# ── Push schema to Postgres ───────────────────────────────────
echo "→ Running prisma db push (creates tables if missing)"
if $PX prisma db push --accept-data-loss; then
  echo "✓ prisma db push done"
else
  echo "⚠️  prisma db push failed — tables may already exist with data, or the DB is unreachable."
  echo "    Continuing anyway; the app will fail at runtime if tables are missing."
fi

# ── Seed default providers (idempotent) ───────────────────────
# The seed script upserts providers and only creates a welcome session if
# none exists, so it's safe to run on every build. If it fails (e.g. DB
# connection limits), we don't fail the whole build — the app can still
# boot and the user can seed manually via `bun run seed`.
echo "→ Seeding default providers (OpenAI, Gemini, Claude)"
if bun run scripts/seed.ts; then
  echo "✓ Seed done"
else
  echo "⚠️  Seed step failed (DB may already be seeded, or connection issue)."
  echo "    Continuing — you can re-run with `bun run seed` later."
fi

# ── Run Next.js build (Vercel-friendly: NO standalone cp) ─────
echo "→ Running next build (Vercel mode — no standalone cp)"
if ! $PX next build; then
  echo "❌ next build failed — aborting."
  exit 1
fi
echo "✓ next build done"

echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Vercel build complete"
echo "═══════════════════════════════════════════════════════════"
