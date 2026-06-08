# ARS Web Dashboard — Design Spec

**Date:** 2026-06-08
**Status:** Approved
**Scope:** Local single-user web dashboard covering the full ARS video development workflow

---

## Problem

The current ARS workflow runs entirely through Claude Code CLI. Two pain points block independent use:

1. All phases (plan, audio, review, prepare, publish) require Claude Code to be running.
2. YouTube publishing requires manual OAuth setup via environment variables — there is no browser-based credential flow.

**Goal:** A local web dashboard (`localhost:3001`) where the entire video development lifecycle can be completed in the browser, with YouTube OAuth handled via a local redirect server.

---

## Approach: New Web Dashboard + CLI as Backend Engine

A new `src/web/` subtree adds a thin local server and a purpose-built frontend dashboard. The existing ARS CLI is not modified — the server wraps CLI commands as REST/SSE endpoints. The existing Studio review UI is preserved and embedded via iframe.

---

## Architecture

```
Browser (Vite SPA — src/web/dashboard/)
     ↕  REST API + SSE
Express Local Server :3001  (src/web/server/)
     ↕  spawn child process
ARS CLI (existing — no changes)
     ↕
  Remotion renderer  ·  MiniMax TTS  ·  YouTube Data API v3
```

### File Structure (new additions only)

```
src/web/
  server/
    index.ts          ← Express entry point
    routes/
      episodes.ts     ← episode CRUD + workstate
      audio.ts        ← TTS generation SSE
      prepare.ts      ← YouTube metadata candidates
      export.ts       ← render + download + publish SSE
      oauth.ts        ← YouTube OAuth flow
    lib/
      cli-runner.ts   ← spawn CLI commands, pipe to SSE
      env-writer.ts   ← write YOUTUBE_* keys to .env
  dashboard/
    index.html
    src/
      App.tsx
      pages/
        Episodes.tsx
        Plan.tsx
        Audio.tsx
        Review.tsx    ← iframe wrapper for existing Studio
        Prepare.tsx
        Export.tsx
      components/
        Sidebar.tsx
        ProgressStream.tsx   ← SSE consumer
        YoutubeConnect.tsx
```

---

## Backend API

Express server on `:3001`. All episode-scoped routes take `:epId` (e.g. `ep001`).

### Episodes

| Method | Path | CLI equivalent |
|--------|------|----------------|
| `GET` | `/api/episodes` | reads `src/episodes/` |
| `POST` | `/api/episodes` | `ars episode create <epId>` |
| `GET` | `/api/episodes/:epId` | reads ep.ts + workstate.json |

### Plan

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/api/episodes/:epId/plan` | reads `.ars/episodes/<epId>/plan.md` |
| `PUT` | `/api/episodes/:epId/plan` | writes plan.md |

### Audio

| Method | Path | CLI equivalent |
|--------|------|----------------|
| `POST` | `/api/episodes/:epId/audio` | `ars audio <epId>` — SSE stream |
| `GET` | `/api/episodes/:epId/audio/:stepId` | serves audio file |

### Prepare (YouTube metadata)

| Method | Path | Action |
|--------|------|--------|
| `POST` | `/api/episodes/:epId/prepare` | `ars prepare youtube <epId>` |
| `GET` | `/api/episodes/:epId/prepare` | reads prepare-youtube.json |
| `PUT` | `/api/episodes/:epId/prepare/select` | applies selected candidate to ep.ts |

### Export & Publish

| Method | Path | CLI equivalent |
|--------|------|----------------|
| `POST` | `/api/episodes/:epId/render` | `ars publish youtube <epId> --yes` render-only — SSE |
| `GET` | `/api/episodes/:epId/download` | serves rendered MP4 from `out/` |
| `POST` | `/api/episodes/:epId/publish` | `ars publish youtube <epId> --yes` — SSE |

### YouTube OAuth

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/oauth/youtube/status` | checks if `YOUTUBE_REFRESH_TOKEN` is set |
| `GET` | `/oauth/youtube/start` | returns Google OAuth URL |
| `GET` | `/oauth/youtube/callback` | receives code, exchanges for tokens, writes `.env` |

### SSE Event Format

Long-running jobs (audio, render, publish) emit SSE lines:

```
data: {"phase":"audio","step":"prep-altar","status":"generating"}
data: {"phase":"audio","step":"prep-altar","status":"done","durationInSeconds":9}
data: {"phase":"audio","step":"all","status":"complete"}

data: {"phase":"render","progress":42,"status":"rendering"}
data: {"phase":"render","status":"complete","outputPath":"out/ep001.mp4"}
```

---

## Frontend Dashboard

Single-page React app served by the Express server (or a separate Vite dev server during development). Sidebar navigation with 6 phases; top bar shows current episode and phase completion status.

```
┌──────────────────────────────────────────────────────┐
│  阿萬的白光照相館  │  ep001 媽祖生  [review ✓]        │
├──────────────┬───────────────────────────────────────┤
│ ▸ Episodes   │                                       │
│   Plan       │   Main content area (phase-specific)  │
│   Audio      │                                       │
│   Review     │                                       │
│   Prepare    │                                       │
│   Export     │                                       │
└──────────────┴───────────────────────────────────────┘
```

### Page Responsibilities

**Episodes** — Lists all episodes with per-phase completion indicators. "New Episode" button triggers `POST /api/episodes`.

**Plan** — Renders `plan.md` as editable textarea. Save writes to disk. Displays step count and estimated duration from the episode source.

**Audio** — Table of all steps. Each row shows step ID, narration text, audio status (pending / generating / done), and a play button for completed audio. "Generate All" and per-step "Regenerate" buttons. SSE consumer shows real-time progress.

**Review** — `<iframe src="http://localhost:5174/?ep=ep001&phase=review" />`. The existing Studio is embedded without modification. A "Open in new tab" link is also provided. The backend auto-starts `npx ars studio <epId> --phase review` when the Review page is first opened (if not already running); the iframe is shown once the Studio port responds to a health check.

**Prepare** — Displays the three YouTube metadata candidates as cards (title, description preview, tags). One-click selection applies the candidate. Shows final title/description/tags after selection.

**Export** — Two actions:

1. **Download MP4**: "Render" button triggers render with SSE progress bar. On completion, "Download" button fetches the MP4.
2. **Upload to YouTube**: Shows YouTube connection status. "Connect YouTube" triggers OAuth if not connected. Once connected, "Upload" button triggers publish with SSE progress. Shows the resulting YouTube video URL on success.

---

## YouTube OAuth — Setup & Flow

### One-Time Manual Prerequisite

The user creates an OAuth 2.0 Client ID in Google Cloud Console (application type: **Web application**) and adds `http://localhost:3001/oauth/youtube/callback` as an authorised redirect URI. `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` are added to `.env` manually. These are static values that do not change.

### Browser OAuth Flow

```
User clicks "Connect YouTube"
    ↓
Frontend: GET /oauth/youtube/start
    ↓
Backend: builds Google OAuth URL with
  redirect_uri = http://localhost:3001/oauth/youtube/callback
  scope = https://www.googleapis.com/auth/youtube.upload
    ↓
Frontend: window.open(oauthUrl)
    ↓
User grants consent in Google
    ↓
Google redirects to localhost:3001/oauth/youtube/callback?code=...
    ↓
Backend: exchanges code → refresh_token
         writes YOUTUBE_REFRESH_TOKEN to .env
    ↓
Frontend: polls GET /oauth/youtube/status until connected
    ↓
Export page: shows "Connected ✓", Upload button unlocked
```

Subsequent uploads use `YOUTUBE_REFRESH_TOKEN` to obtain fresh access tokens automatically — no re-authorisation required.

---

## Out of Scope

- Multi-user / authentication
- Cloud deployment
- Modifying existing ARS CLI behaviour
- Rewriting the Studio review UI
- Mobile layout

---

## Success Criteria

1. Opening `http://localhost:3001` shows the dashboard without Claude Code running.
2. All 6 phases are reachable and functional from the browser.
3. Audio generation shows real-time per-step progress.
4. The Review phase correctly loads the existing Studio iframe.
5. YouTube OAuth completes in the browser and writes credentials to `.env` without manual editing.
6. MP4 download works after render.
7. YouTube upload succeeds using the OAuth-obtained credentials.
