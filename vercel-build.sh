#!/usr/bin/env bash
# Vercel build script for Marq AI Aggregator.
#
# Vercel's serverless functions run on a read-only filesystem, so the local
# SQLite file won't work in production. This script:
#   1. Swaps in the Postgres Prisma schema (prisma/schema.postgres.prisma)
#   2. Runs `prisma generate` so the client targets Postgres
#   3. Runs `prisma db push` to create tables in your Postgres database
#   4. Seeds the default providers + welcome session
#   5. Hands off to `next build` (Vercel's default Build Command)
#
# Required Vercel env vars:
#   DATABASE_URL       — postgres:// connection string (Neon, Supabase, etc.)
#   ZAI_API_KEY        — optional, only used by demo-mode fallback
#
# Set this file as the "Build Command" in Vercel:
#   Project Settings → Build & Development Settings → Build Command:
#     bash ./vercel-build.sh

set -euo pipefail

echo "═══════════════════════════════════════════════════════════"
echo "  Marq AI Aggregator — Vercel build"
echo "═══════════════════════════════════════════════════════════"

# ── Sanity check ──────────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL env var is not set."
  echo "   Add a postgres:// connection string in Vercel → Settings → Environment Variables."
  exit 1
fi

if [[ "${DATABASE_URL}" != postgres* ]]; then
  echo "❌ DATABASE_URL must be a postgres:// connection string on Vercel."
  echo "   Got: ${DATABASE_URL:0:30}…"
  exit 1
fi

echo "✓ DATABASE_URL is a Postgres connection string"

# ── Swap in the Postgres Prisma schema ────────────────────────
echo "→ Switching Prisma schema to PostgreSQL variant"
cp prisma/schema.prisma prisma/schema.sqlite.prisma.bak
cp prisma/schema.postgres.prisma prisma/schema.prisma

# ── Generate Prisma client for Postgres ───────────────────────
echo "→ Running prisma generate"
bunx prisma generate

# ── Push schema to Postgres ───────────────────────────────────
echo "→ Running prisma db push (creates tables if missing)"
bunx prisma db push --accept-data-loss || {
  echo "⚠️  prisma db push failed — tables may already exist with data. Continuing."
}

# ── Seed default providers + welcome session ──────────────────
echo "→ Seeding default providers (OpenAI, Gemini, Claude)"
bun run scripts/seed.ts || {
  echo "⚠️  Seed step failed (may already be seeded). Continuing."
}

# ── Run Next.js build ─────────────────────────────────────────
echo "→ Running next build"
bun run build

# ── Restore the SQLite schema for local dev continuity ────────
echo "→ Restoring local SQLite schema"
mv prisma/schema.sqlite.prisma.bak prisma/schema.prisma

echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Build complete"
echo "═══════════════════════════════════════════════════════════"
