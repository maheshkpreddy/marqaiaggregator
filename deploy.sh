#!/usr/bin/env bash
#
# Marq AI Aggregator — GitHub push + Vercel deploy helper.
#
# Run this on your local machine where you have:
#   - Git installed with credentials configured (or a GitHub Personal Access
#     Token in your keychain / credential helper), OR `gh` CLI installed.
#   - (Optional) Vercel CLI: `npm i -g vercel` for command-line deploy.
#
# Usage:
#   bash ./deploy.sh            # just push to GitHub
#   bash ./deploy.sh --vercel   # push to GitHub AND deploy to Vercel via CLI
#
set -euo pipefail

REPO_URL="https://github.com/maheshkpreddy/marqaiaggregator.git"
BRANCH="main"

echo "═══════════════════════════════════════════════════════════"
echo "  Marq AI Aggregator — Deploy"
echo "═══════════════════════════════════════════════════════════"
echo "  Repo:   $REPO_URL"
echo "  Branch: $BRANCH"
echo ""

# 1. Verify we're in the right directory.
if [ ! -f "package.json" ] || [ ! -f "vercel.json" ]; then
  echo "❌ Run this script from the project root (where package.json lives)."
  exit 1
fi

# 2. Make sure the remote is set.
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "→ Adding GitHub remote"
  git remote add origin "$REPO_URL"
else
  CURRENT=$(git remote get-url origin)
  if [ "$CURRENT" != "$REPO_URL" ]; then
    echo "→ Updating origin from $CURRENT to $REPO_URL"
    git remote set-url origin "$REPO_URL"
  fi
fi

# 3. Stage any uncommitted changes.
if [ -n "$(git status --porcelain)" ]; then
  echo "→ Committing uncommitted changes"
  git add -A
  git commit -m "chore: deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

# 4. Push to GitHub.
echo "→ Pushing to GitHub..."
if git push -u origin "$BRANCH"; then
  echo "✓ Pushed to $REPO_URL"
else
  echo ""
  echo "❌ Push failed. Common causes:"
  echo "   1. You're not authenticated to GitHub from this shell."
  echo "      → Install GitHub CLI:  https://cli.github.com"
  echo "      → Then run:             gh auth login"
  echo "   2. The repo doesn't exist yet at $REPO_URL"
  echo "      → Create it at: https://github.com/new"
  echo "      → Name it: marqaiaggregator (matches this script)"
  echo "   3. You don't have write access to maheshkpreddy/marqaiaggregator."
  echo "      → Fork the repo and update REPO_URL in this script."
  exit 1
fi

# 5. Optional: Vercel CLI deploy.
if [ "${1:-}" = "--vercel" ]; then
  echo ""
  echo "→ Deploying to Vercel..."
  if ! command -v vercel >/dev/null 2>&1; then
    echo "❌ Vercel CLI is not installed. Install with:  npm i -g vercel"
    exit 1
  fi
  if ! vercel whoami >/dev/null 2>&1; then
    echo "→ Logging in to Vercel..."
    vercel login
  fi

  # Link the project (creates a new Vercel project if not already linked).
  vercel link --yes

  # Set DATABASE_URL (you'll need to provide this — get it from Neon/Supabase).
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "⚠️  DATABASE_URL env var is not set in your shell."
    echo "   1. Create a Postgres database on Neon (https://neon.tech) or Supabase (https://supabase.com)"
    echo "   2. Export the connection string:"
    echo "        export DATABASE_URL='postgres://user:pass@host/db?sslmode=require'"
    echo "   3. Re-run:  bash ./deploy.sh --vercel"
    exit 1
  fi

  vercel env add DATABASE_URL production <<<"$DATABASE_URL"
  vercel env add DATABASE_URL preview    <<<"$DATABASE_URL"

  echo "→ Running production deploy..."
  vercel --prod
  echo "✓ Deployed to Vercel"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Done"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  • GitHub repo:  https://github.com/maheshkpreddy/marqaiaggregator"
echo "  • To deploy on Vercel via dashboard:"
echo "      1. https://vercel.com/new"
echo "      2. Import maheshkpreddy/marqaiaggregator"
echo "      3. Add env var: DATABASE_URL=postgres://..."
echo "      4. Click Deploy"
echo ""
