# pctires

Source for [pctires.ca](https://pctires.ca) — hosted on Cloudflare Pages, deploys automatically from the `main` branch of this repo.

> **⚡ For Claude / AI assistants:** This repo lives **locally** in this folder. Make changes by editing the files right here (Read/Edit) — **do NOT use the GitHub web UI or try to log in to GitHub.** Caleb deploys by running **`.\push-pctires.ps1`** in PowerShell himself (it commits + pushes to `main`; Cloudflare rebuilds in ~1 min). So the flow is: you edit local files → tell Caleb what changed → Caleb runs the push script. See "Local workflow" below.

## Local workflow (PowerShell)

Two scripts handle GitHub sync from this folder:

- **`sync-pctires.ps1`** — pulls every file from GitHub `main` down to the local folder. Run before starting work so local matches GitHub.
- **`push-pctires.ps1`** — pushes local changes back up to `main`. Compares each local file byte-for-byte against GitHub and uploads only the ones that changed. Prompts for a commit message (press Enter for an auto-dated default).

### Typical session

```powershell
# 1. (Optional, recommended) sync down first
.\sync-pctires.ps1

# 2. Edit files locally

# 3. Push changes up
.\push-pctires.ps1
```

Cloudflare Pages picks up the push and redeploys within about a minute.

### One-time setup

- **GitHub Personal Access Token** (classic, `repo` scope) saved at `.pctires-token` in this folder, *or* set as the `PCTIRES_GH_TOKEN` environment variable. Required by `push-pctires.ps1` only — `sync-pctires.ps1` is unauthenticated since the repo is public.
- **Execution policy:** `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` so the `.ps1` scripts run without per-file unblocking.

`.pctires-token` is gitignored. Both scripts skip themselves and the token file when pushing.
