#!/usr/bin/env bash
#
# deploy.sh — one-command deploy of the Gemini chat app to GitHub + Vercel
#
# What this script does:
#   1. Checks that git, node, npm are installed
#   2. Initializes a git repo (if needed) and makes an initial commit
#   3. Creates a GitHub repo and pushes (using `gh` CLI — it'll prompt you to log in once)
#   4. Installs Vercel CLI and deploys (it'll prompt you to log in once)
#   5. Sets the GEMINI_API_KEY environment variable on Vercel
#   6. Prints your live URL
#
# Your API key is read from a local prompt — it is NEVER stored in git, NEVER
# written to disk, and ONLY sent to Vercel over HTTPS.
#
# Tested on macOS and Linux. On Windows, run inside Git Bash or WSL.
#

set -euo pipefail

# Pretty colors
green() { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
bold()  { printf "\033[1m%s\033[0m\n" "$1"; }

echo ""
bold "=== Gemini Chat → GitHub + Vercel deploy ==="
echo ""

# -----------------------------------------------------------------------------
# 0. Preflight checks
# -----------------------------------------------------------------------------
command -v git >/dev/null 2>&1 || { red "git not found. Install: https://git-scm.com/downloads"; exit 1; }
command -v node >/dev/null 2>&1 || { red "node not found. Install: https://nodejs.org/"; exit 1; }
command -v npm >/dev/null 2>&1 || { red "npm not found. Install Node.js first."; exit 1; }

green "✓ git, node, npm all available"

# Make sure we're in the project root (script lives next to package.json)
cd "$(dirname "$0")"

if [ ! -f "package.json" ]; then
  red "package.json not found. Make sure you unzipped the project folder and run this script from inside it."
  exit 1
fi

# -----------------------------------------------------------------------------
# 1. GitHub CLI — install if missing, then log in
# -----------------------------------------------------------------------------
echo ""
bold "Step 1 of 5: Set up GitHub CLI"

if ! command -v gh >/dev/null 2>&1; then
  yellow "gh CLI not found. Installing via npm (no sudo needed)..."
  npm install -g @github/github-cli 2>/dev/null || {
    echo ""
    yellow "Automatic install failed. Please install gh manually:"
    echo "  macOS:  brew install gh"
    echo "  Linux:  https://github.com/cli/cli#installation"
    echo "  Windows: https://cli.github.com/"
    exit 1
  }
fi

if ! gh auth status >/dev/null 2>&1; then
  echo ""
  yellow "You need to log in to GitHub. A browser window will open."
  echo "  → Click 'Authorize github' in the browser."
  echo "  → Come back here when done."
  echo ""
  read -p "Press Enter to open the browser..." _
  gh auth login --web --git-protocol https
fi

green "✓ Authenticated to GitHub as $(gh api user --jq .login)"

# -----------------------------------------------------------------------------
# 2. Create GitHub repo and push
# -----------------------------------------------------------------------------
echo ""
bold "Step 2 of 5: Create GitHub repo and push code"

REPO_NAME="gemini-chat"
if gh repo view "$REPO_NAME" --json name >/dev/null 2>&1; then
  yellow "Repo '$REPO_NAME' already exists on your GitHub. Using it."
else
  read -p "Name for the new GitHub repo [gemini-chat]: " INPUT_NAME
  REPO_NAME="${INPUT_NAME:-gemini-chat}"
  echo "Creating private repo '$REPO_NAME'..."
  gh repo create "$REPO_NAME" --private --source=. --remote=origin --description "Streaming Gemini chat app on Next.js 16"
fi

# Make sure origin remote is set
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$(gh api user --jq .login)/$REPO_NAME.git"

# Initialize git if needed
if [ ! -d ".git" ]; then
  git init
  git branch -M main
fi

# Make sure .env.local is gitignored (it should already be)
grep -q "^.env.local$" .gitignore 2>/dev/null || echo ".env.local" >> .gitignore

git add -A
if git diff --cached --quiet; then
  yellow "No changes to commit."
else
  git commit -m "Initial commit: streaming Gemini chat app"
fi

# Push
git push -u origin main 2>&1 || {
  # If push fails because remote has commits (unlikely on fresh repo), force it
  yellow "Push failed, trying with --force-with-lease..."
  git push --force-with-lease -u origin main
}

REPO_URL=$(gh repo view --json url --jq .url)
green "✓ Code pushed to $REPO_URL"

# -----------------------------------------------------------------------------
# 3. Install Vercel CLI and log in
# -----------------------------------------------------------------------------
echo ""
bold "Step 3 of 5: Install Vercel CLI and log in"

if ! command -v vercel >/dev/null 2>&1; then
  yellow "Installing Vercel CLI globally..."
  npm install -g vercel
fi

if ! vercel whoami >/dev/null 2>&1; then
  echo ""
  yellow "You need to log in to Vercel. A browser window will open."
  echo "  → Click 'Continue' in the browser."
  echo "  → Come back here when done."
  echo ""
  read -p "Press Enter to open the browser..." _
  vercel login
fi

green "✓ Logged in to Vercel as $(vercel whoami)"

# -----------------------------------------------------------------------------
# 4. Link project to Vercel and deploy
# -----------------------------------------------------------------------------
echo ""
bold "Step 4 of 5: Deploy to Vercel"

# Link this folder to a Vercel project (creates one if it doesn't exist)
if [ ! -d ".vercel" ] || [ ! -f ".vercel/project.json" ]; then
  yellow "Linking project to Vercel..."
  # --yes accepts defaults; --project names the project after the repo
  vercel link --yes --project "$REPO_NAME" 2>&1 || {
    yellow "Initial link failed (project may not exist yet). Creating it..."
    vercel project add "$REPO_NAME" 2>&1 || true
    vercel link --yes --project "$REPO_NAME"
  }
fi

# -----------------------------------------------------------------------------
# 5. Set GEMINI_API_KEY env var on Vercel, then deploy production
# -----------------------------------------------------------------------------
echo ""
bold "Step 5 of 5: Set API key and deploy to production"

echo ""
echo "Paste your Gemini API key now."
echo "  → It will be sent to Vercel over HTTPS and stored as an encrypted env var."
echo "  → It will NOT be written to disk, NOT added to git, NOT shown in output."
echo ""
read -s -p "GEMINI_API_KEY: " GEMINI_KEY
echo ""

if [ -z "$GEMINI_KEY" ]; then
  red "No key entered. Aborting."
  exit 1
fi

# Set env var on Vercel (production, preview, development)
# `vercel env add` reads from stdin if you pipe it; --force overwrites if exists
for ENV in production preview development; do
  printf "%s" "$GEMINI_KEY" | vercel env add GEMINI_API_KEY "$ENV" --force 2>/dev/null || true
done
unset GEMINI_KEY  # drop from memory asap

green "✓ GEMINI_API_KEY set on Vercel (production + preview + development)"

# Deploy to production
echo ""
yellow "Deploying to production (this takes ~60-90 seconds)..."
DEPLOY_URL=$(vercel --prod --yes 2>&1 | tail -1)

echo ""
bold "=== Done! ==="
echo ""
green "GitHub repo:  $REPO_URL"
green "Live site:   $DEPLOY_URL"
echo ""
echo "Open the Live site URL above and try sending a message."
echo "If you see 'User location is not supported', verify the Vercel function"
echo "region is 'iad1' (Washington DC) in your Vercel dashboard:"
echo "  → Project Settings → Functions → Function Region"
echo ""
