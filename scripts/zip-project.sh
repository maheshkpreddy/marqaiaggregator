#!/usr/bin/env bash
# Zip the Gemini chat app for download, excluding heavy/sensitive files.
set -euo pipefail

PROJECT_DIR="/home/z/my-project"
OUT_ZIP="/home/z/my-project/download/gemini-chat.zip"

cd "$PROJECT_DIR"

# Remove old zip
rm -f "$OUT_ZIP"

# Build the include list explicitly (cleaner than excluding everything)
# We want: src/, prisma/, public/, scripts/, *.json, *.ts, *.mjs, *.md,
#          *.sh, Caddyfile, vercel.json, components.json, deploy.sh, README.md
# We exclude: node_modules, .next, .vercel, .env*, dev.log, *.log, .git,
#             /download/, /skills/, db/*.db, worklog.md

zip -r "$OUT_ZIP" \
  src \
  prisma \
  public \
  scripts \
  package.json \
  package-lock.json \
  bun.lock \
  tsconfig.json \
  next.config.ts \
  tailwind.config.ts \
  postcss.config.mjs \
  eslint.config.mjs \
  components.json \
  vercel.json \
  vercel-build.sh \
  Caddyfile \
  deploy.sh \
  README.md \
  .env.example \
  .gitignore \
  -x \
    "node_modules/*" \
    ".next/*" \
    ".vercel/*" \
    ".git/*" \
    "dev.log" \
    "server.log" \
    "*.log" \
    ".env.local" \
    ".env" \
    "download/*" \
    "skills/*" \
    "db/*.db" \
    "db/*.db-journal" \
    "worklog.md" \
    "*.tsbuildinfo" \
    "next-env.d.ts" \
  >/dev/null

echo "=== Created $OUT_ZIP ==="
ls -lh "$OUT_ZIP"
echo ""
echo "=== Top-level contents ==="
unzip -l "$OUT_ZIP" | tail -30
