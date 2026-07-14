# Gemini Chat — Streaming Next.js App

A clean, streaming chat UI built on **Next.js 16** and the **Google Gemini API**. Your API key stays server-side; calls run from Vercel's `iad1` (US East) region, which is on Google's supported region list.

## What's inside

- **Streaming responses** — text appears as the model generates it
- **Model selector** — switch between `gemini-flash-latest` and `gemini-pro-latest` (auto-update aliases, so the app keeps working when Google deprecates specific versions)
- **Settings dialog** — editable system instruction
- **Stop button** — abort mid-stream
- **Markdown rendering** — with code blocks and safe external links
- **Mobile-responsive** — works on phones

## Deploy in one command

### Prerequisites (install once)
- **Git**: https://git-scm.com/downloads
- **Node.js 18+**: https://nodejs.org/

### Steps

1. **Unzip** this folder somewhere on your machine.

2. **Open a terminal** in the unzipped folder:
   - macOS: right-click the folder → "New Terminal at Folder"
   - Windows: shift+right-click in the folder → "Open PowerShell window here" (or use Git Bash / WSL)
   - Linux: `cd /path/to/gemini-chat`

3. **Run the deploy script**:

   ```bash
   ./deploy.sh
   ```

   The script will:
   - Install the GitHub CLI and Vercel CLI if missing
   - Ask you to log in to GitHub (browser window opens)
   - Create a private GitHub repo called `gemini-chat`
   - Push the code
   - Ask you to log in to Vercel (browser window opens)
   - Ask you to **paste your Gemini API key** (read securely, never stored on disk, never added to git)
   - Deploy to production and print the live URL

4. **Open the printed URL** and start chatting.

## What the script does NOT do

- ❌ Does NOT commit your API key to git (it's gitignored)
- ❌ Does NOT write the key to any file on disk
- ❌ Does NOT share the key with anything except Vercel's API (over HTTPS)

## Troubleshooting

**"User location is not supported for the API use."**
Your Vercel function region is not in the US/EU. Fix:
1. Vercel dashboard → your project → Settings → Functions → Function Region
2. Set it to `iad1` (Washington DC) — the `vercel.json` in this project already pins this, but verify.
3. Redeploy.

**`gh auth login` opens browser but nothing happens**
Copy the one-time code from the terminal, paste it into the browser page that opened, then click Continue.

**`vercel login` not working**
Run `vercel login --github` (or `--email`) to pick a different auth method.

**Push rejected as "non-fast-forward"**
The script handles this automatically with `--force-with-lease`. If it still fails, delete the GitHub repo and re-run.

## Manual deploy (if the script doesn't work for you)

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Gemini chat app"
gh repo create gemini-chat --private --source=. --remote=origin --push

# 2. Go to https://vercel.com/new, import the repo, add env var:
#    GEMINI_API_KEY = <your key>
#    (set for Production, Preview, Development)
# 3. Click Deploy. Done.
```

## File structure

```
.
├── src/
│   ├── lib/gemini.ts                  # Server-side Gemini client
│   ├── app/
│   │   ├── page.tsx                   # Chat UI
│   │   ├── layout.tsx                 # Root layout
│   │   └── api/gemini/
│   │       ├── chat/route.ts          # Streaming POST endpoint
│   │       └── models/route.ts        # GET /api/gemini/models
│   └── components/ui/                 # shadcn/ui components
├── vercel.json                        # Pins region to iad1
├── deploy.sh                          # One-command deploy script
└── package.json
```
