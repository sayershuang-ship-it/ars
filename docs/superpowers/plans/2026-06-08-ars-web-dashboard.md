# ARS Web Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local web dashboard at `http://localhost:3001` where the full ARS video workflow (episodes → plan → audio → review → prepare → export/upload) runs in the browser.

**Architecture:** Express server on `:3001` wraps existing ARS CLI commands as REST + SSE endpoints. A Vite React SPA is the frontend; during dev it runs on `:3000` with a proxy to `:3001`; in production Express serves the built static files. The existing Studio review UI is preserved and embedded via iframe. YouTube OAuth is delegated entirely to `npx ars auth youtube` (which already runs a local callback server on `:3847` and writes to `.env`).

**Tech Stack:** Express 5 · TypeScript (tsx) · React 19 + Vite · React Router v6 · vitest (existing) · `ars` CLI (existing, unchanged)

**Spec:** `docs/superpowers/specs/2026-06-08-ars-web-dashboard-design.md`

---

## File Map

```
src/web/
  server/
    index.ts                    ← Express app factory + startup entry
    routes/
      episodes.ts               ← GET /api/episodes, POST /api/episodes, GET /api/episodes/:epId
      plan.ts                   ← GET + PUT /api/episodes/:epId/plan
      audio.ts                  ← POST /api/episodes/:epId/audio (SSE), GET .../audio/:stepId
      prepare.ts                ← POST + GET /api/episodes/:epId/prepare, PUT .../prepare/select
      export.ts                 ← POST .../render (SSE), GET .../download, POST .../publish (SSE)
      oauth.ts                  ← GET /oauth/youtube/status, POST /oauth/youtube/authorize
    lib/
      cli-runner.ts             ← spawn ARS CLI, pipe stdout to SSE callback
      env-reader.ts             ← read .env file key-value lookup (for OAuth status)
      studio-launcher.ts        ← ensure Studio process is running; health-check port
  dashboard/
    index.html
    vite.config.ts              ← Vite config: port 3000, proxy /api + /oauth → 3001
    src/
      main.tsx                  ← React entry, BrowserRouter
      App.tsx                   ← layout: Sidebar + <Outlet />
      api.ts                    ← typed fetch + SSE helpers
      pages/
        Episodes.tsx            ← episode list + create
        Plan.tsx                ← plan.md editor
        Audio.tsx               ← per-step audio status + SSE progress
        Review.tsx              ← iframe wrapper + Studio auto-start
        Prepare.tsx             ← YouTube metadata candidate cards
        Export.tsx              ← render progress + download + OAuth + upload
      components/
        Sidebar.tsx             ← left nav with phase links and completion badges
        ProgressStream.tsx      ← generic SSE consumer hook
        YoutubeStatus.tsx       ← OAuth connected/disconnected badge + button

tests/web/
  server/
    cli-runner.test.ts
    env-reader.test.ts
    routes/
      episodes.test.ts
      plan.test.ts
      oauth.test.ts
```

---

## Phase A — Backend

### Task 1: Install dependencies + vitest coverage + health check

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Create: `src/web/server/index.ts`

- [ ] **Step 1: Install server deps**

```bash
npm install express cors
npm install --save-dev @types/express @types/cors react-router-dom
```

Expected: `package-lock.json` updated, no errors.

- [ ] **Step 2: Add vitest include for web tests**

In `vitest.config.ts`, add `'tests/web/**/*.test.ts'` to the `include` array:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'cli/**/*.test.ts',
      'plugin/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    restoreMocks: true,
    clearMocks: true,
  },
});
```

*(The existing `tests/**/*.test.ts` glob already covers `tests/web/`. No change needed if it's already `tests/**`.)*

- [ ] **Step 3: Write the failing health-check test**

Create `tests/web/server/health.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/web/server/index';

describe('GET /health', () => {
  it('returns { ok: true }', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 4: Install supertest**

```bash
npm install --save-dev supertest @types/supertest
```

- [ ] **Step 5: Run test — expect FAIL (module not found)**

```bash
npx vitest run tests/web/server/health.test.ts
```

Expected: `Cannot find module '../../../src/web/server/index'`

- [ ] **Step 6: Create `src/web/server/index.ts`**

```typescript
import express from 'express';
import cors from 'cors';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (_req, res) => { res.json({ ok: true }); });
  return app;
}

const PORT = Number(process.env.WEB_PORT ?? 3001);
const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  const app = createApp();
  app.listen(PORT, () => console.log(`ARS Web  →  http://localhost:${PORT}`));
}
```

- [ ] **Step 7: Run test — expect PASS**

```bash
npx vitest run tests/web/server/health.test.ts
```

Expected: `1 passed`

- [ ] **Step 8: Commit**

```bash
git add src/web/server/index.ts tests/web/server/health.test.ts package.json package-lock.json vitest.config.ts
git commit -m "feat(web): Express server scaffold with health check"
```

---

### Task 2: `cli-runner.ts` — spawn ARS CLI + SSE pipe

**Files:**
- Create: `src/web/server/lib/cli-runner.ts`
- Create: `tests/web/server/cli-runner.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/web/server/cli-runner.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('child_process', () => ({ spawn: vi.fn() }));

import { spawn } from 'child_process';
import { runCli } from '../../../src/web/server/lib/cli-runner';

function makeMockProc() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

describe('runCli', () => {
  it('collects stdout lines and resolves with exit code 0', async () => {
    const proc = makeMockProc();
    vi.mocked(spawn).mockReturnValue(proc);

    const lines: string[] = [];
    const promise = runCli(['audio', 'ep001'], (l) => lines.push(l));

    proc.stdout.emit('data', Buffer.from('line1\nline2\n'));
    proc.emit('close', 0);

    const code = await promise;
    expect(code).toBe(0);
    expect(lines).toEqual(['line1', 'line2']);
  });

  it('also collects stderr lines', async () => {
    const proc = makeMockProc();
    vi.mocked(spawn).mockReturnValue(proc);

    const lines: string[] = [];
    const promise = runCli(['audio', 'ep001'], (l) => lines.push(l));

    proc.stderr.emit('data', Buffer.from('error line\n'));
    proc.emit('close', 1);

    const code = await promise;
    expect(code).toBe(1);
    expect(lines).toContain('error line');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/web/server/cli-runner.test.ts
```

- [ ] **Step 3: Create `src/web/server/lib/cli-runner.ts`**

```typescript
import { spawn } from 'child_process';
import type { Response } from 'express';

export function initSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

export function sendSse(res: Response, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function runCli(
  args: string[],
  onLine: (line: string) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['ars', ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
    });
    const emit = (chunk: Buffer) =>
      chunk.toString().split('\n').filter(Boolean).forEach(onLine);
    proc.stdout.on('data', emit);
    proc.stderr.on('data', emit);
    proc.on('close', (code) => resolve(code ?? 0));
    proc.on('error', reject);
  });
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run tests/web/server/cli-runner.test.ts
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add src/web/server/lib/cli-runner.ts tests/web/server/cli-runner.test.ts
git commit -m "feat(web/server): cli-runner SSE pipe helper"
```

---

### Task 3: `env-reader.ts` — read `.env` for OAuth status

**Files:**
- Create: `src/web/server/lib/env-reader.ts`
- Create: `tests/web/server/env-reader.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/web/server/env-reader.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { vol } from 'memfs';

vi.mock('fs', () => require('memfs').fs);

import { readEnvKey, youtubeCredentialStatus } from '../../../src/web/server/lib/env-reader';

describe('readEnvKey', () => {
  it('parses a key from .env content', () => {
    vol.fromJSON({ '/repo/.env': 'FOO=bar\nBAZ=qux\n' });
    const val = readEnvKey('/repo/.env', 'FOO');
    expect(val).toBe('bar');
  });

  it('returns undefined for missing key', () => {
    vol.fromJSON({ '/repo/.env': 'FOO=bar\n' });
    expect(readEnvKey('/repo/.env', 'MISSING')).toBeUndefined();
  });
});

describe('youtubeCredentialStatus', () => {
  it('returns connected: true when all three keys are present', () => {
    vol.fromJSON({
      '/repo/.env':
        'YOUTUBE_CLIENT_ID=cid\nYOUTUBE_CLIENT_SECRET=sec\nYOUTUBE_REFRESH_TOKEN=tok\n',
    });
    expect(youtubeCredentialStatus('/repo/.env')).toEqual({ connected: true });
  });

  it('returns connected: false when REFRESH_TOKEN is missing', () => {
    vol.fromJSON({ '/repo/.env': 'YOUTUBE_CLIENT_ID=cid\nYOUTUBE_CLIENT_SECRET=sec\n' });
    expect(youtubeCredentialStatus('/repo/.env')).toEqual({ connected: false });
  });
});
```

- [ ] **Step 2: Install memfs (test-only virtual fs)**

```bash
npm install --save-dev memfs
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
npx vitest run tests/web/server/env-reader.test.ts
```

- [ ] **Step 4: Create `src/web/server/lib/env-reader.ts`**

```typescript
import fs from 'fs';
import path from 'path';

export const ENV_PATH = path.join(process.cwd(), '.env');

export function readEnvKey(envPath: string, key: string): string | undefined {
  try {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m && m[1].trim() === key) return m[2].trim();
    }
  } catch {
    // file missing
  }
  return undefined;
}

export function youtubeCredentialStatus(envPath = ENV_PATH): { connected: boolean } {
  const token = readEnvKey(envPath, 'YOUTUBE_REFRESH_TOKEN');
  return { connected: Boolean(token) };
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npx vitest run tests/web/server/env-reader.test.ts
```

Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add src/web/server/lib/env-reader.ts tests/web/server/env-reader.test.ts
git commit -m "feat(web/server): env-reader for OAuth credential status"
```

---

### Task 4: Episodes routes

**Files:**
- Create: `src/web/server/routes/episodes.ts`
- Create: `tests/web/server/routes/episodes.test.ts`
- Modify: `src/web/server/index.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/web/server/routes/episodes.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { vol } from 'memfs';

vi.mock('fs', () => require('memfs').fs);
vi.mock('fs/promises', () => require('memfs').fs.promises);

import { createApp } from '../../../../src/web/server/index';

describe('GET /api/episodes', () => {
  it('returns list of episode directories', async () => {
    vol.fromJSON({
      '/repo/src/episodes/Youtube-studio/ep001.ts': '',
      '/repo/src/episodes/Youtube-studio/ep002.ts': '',
    });
    // Override cwd so routes can find src/episodes
    vi.spyOn(process, 'cwd').mockReturnValue('/repo');
    const app = createApp();
    const res = await request(app).get('/api/episodes');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/web/server/routes/episodes.test.ts
```

- [ ] **Step 3: Create `src/web/server/routes/episodes.ts`**

```typescript
import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export const episodesRouter = Router();

function getSeriesDir() {
  return path.join(process.cwd(), 'src', 'episodes');
}

episodesRouter.get('/', (_req, res) => {
  const seriesDir = getSeriesDir();
  try {
    const series = fs.readdirSync(seriesDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'template')
      .map(d => d.name);

    const episodes = series.flatMap(s =>
      fs.readdirSync(path.join(seriesDir, s))
        .filter(f => f.endsWith('.ts') && !f.includes('.subtitles') && !f.includes('series-config'))
        .map(f => ({
          series: s,
          epId: f.replace('.ts', ''),
          filePath: path.join('src', 'episodes', s, f),
        }))
    );
    res.json(episodes);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

episodesRouter.get('/:epId', (req, res) => {
  const { epId } = req.params;
  const seriesDir = getSeriesDir();
  try {
    const series = fs.readdirSync(seriesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .find(s => fs.existsSync(path.join(seriesDir, s, `${epId}.ts`)));

    if (!series) return res.status(404).json({ error: 'Episode not found' });

    const workstatePath = path.join(process.cwd(), '.ars', 'state', 'workstate.json');
    const workstate = fs.existsSync(workstatePath)
      ? JSON.parse(fs.readFileSync(workstatePath, 'utf-8'))
      : null;

    res.json({ epId, series, workstate });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
```

- [ ] **Step 4: Wire router into `src/web/server/index.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import { episodesRouter } from './routes/episodes';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/episodes', episodesRouter);
  app.get('/health', (_req, res) => { res.json({ ok: true }); });
  return app;
}

const PORT = Number(process.env.WEB_PORT ?? 3001);
const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  const app = createApp();
  app.listen(PORT, () => console.log(`ARS Web  →  http://localhost:${PORT}`));
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npx vitest run tests/web/server/routes/episodes.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/web/server/routes/episodes.ts src/web/server/index.ts tests/web/server/routes/episodes.test.ts
git commit -m "feat(web/server): episodes routes GET /"
```

---

### Task 5: Plan routes

**Files:**
- Create: `src/web/server/routes/plan.ts`
- Create: `tests/web/server/routes/plan.test.ts`
- Modify: `src/web/server/index.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/web/server/routes/plan.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { vol } from 'memfs';

vi.mock('fs', () => require('memfs').fs);
vi.mock('fs/promises', () => require('memfs').fs.promises);
vi.spyOn(process, 'cwd').mockReturnValue('/repo');

import { createApp } from '../../../../src/web/server/index';

describe('Plan routes', () => {
  it('GET /api/episodes/:epId/plan returns plan.md content', async () => {
    vol.fromJSON({ '/repo/.ars/episodes/ep001/plan.md': '# plan' });
    const app = createApp();
    const res = await request(app).get('/api/episodes/ep001/plan');
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('# plan');
  });

  it('PUT /api/episodes/:epId/plan writes new content', async () => {
    vol.fromJSON({ '/repo/.ars/episodes/ep001/plan.md': '# old' });
    const app = createApp();
    const res = await request(app)
      .put('/api/episodes/ep001/plan')
      .send({ content: '# new' });
    expect(res.status).toBe(200);
    const after = vol.readFileSync('/repo/.ars/episodes/ep001/plan.md', 'utf-8');
    expect(after).toBe('# new');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/web/server/routes/plan.test.ts
```

- [ ] **Step 3: Create `src/web/server/routes/plan.ts`**

```typescript
import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export const planRouter = Router();

function planPath(epId: string) {
  return path.join(process.cwd(), '.ars', 'episodes', epId, 'plan.md');
}

planRouter.get('/:epId/plan', (req, res) => {
  const p = planPath(req.params.epId);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'plan.md not found' });
  res.json({ content: fs.readFileSync(p, 'utf-8') });
});

planRouter.put('/:epId/plan', (req, res) => {
  const { content } = req.body as { content: string };
  if (typeof content !== 'string') return res.status(400).json({ error: 'content required' });
  const p = planPath(req.params.epId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf-8');
  res.json({ ok: true });
});
```

- [ ] **Step 4: Add planRouter to `src/web/server/index.ts`**

Add `import { planRouter } from './routes/plan';` and `app.use('/api/episodes', planRouter);` after the episodesRouter line.

- [ ] **Step 5: Run test — expect PASS**

```bash
npx vitest run tests/web/server/routes/plan.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/web/server/routes/plan.ts src/web/server/index.ts tests/web/server/routes/plan.test.ts
git commit -m "feat(web/server): plan routes GET + PUT"
```

---

### Task 6: Audio route (SSE)

**Files:**
- Create: `src/web/server/routes/audio.ts`
- Modify: `src/web/server/index.ts`

- [ ] **Step 1: Create `src/web/server/routes/audio.ts`**

```typescript
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { initSse, sendSse, runCli } from '../lib/cli-runner';

export const audioRouter = Router();

audioRouter.post('/:epId/audio', (req, res) => {
  const { epId } = req.params;
  const { steps } = req.body as { steps?: string };

  initSse(res);
  sendSse(res, { phase: 'audio', status: 'started', epId });

  const args = ['audio', epId];
  if (steps) args.push('--steps', steps);

  runCli(args, (line) => {
    sendSse(res, { phase: 'audio', raw: line });
  }).then((code) => {
    sendSse(res, { phase: 'audio', status: code === 0 ? 'complete' : 'error', code });
    res.end();
  }).catch((err) => {
    sendSse(res, { phase: 'audio', status: 'error', message: String(err) });
    res.end();
  });
});

audioRouter.get('/:epId/audio/:stepId', (req, res) => {
  const { epId, stepId } = req.params;
  const audioPath = path.join(
    process.cwd(), 'public', 'episodes', 'Youtube-studio', epId, 'audio', `${stepId}.mp3`
  );
  if (!fs.existsSync(audioPath)) return res.status(404).json({ error: 'Audio not found' });
  res.sendFile(audioPath);
});
```

- [ ] **Step 2: Add audioRouter to `src/web/server/index.ts`**

Add `import { audioRouter } from './routes/audio';` and `app.use('/api/episodes', audioRouter);`.

- [ ] **Step 3: Manual smoke test**

Start the server and verify SSE works:

```bash
npx tsx src/web/server/index.ts &
curl -N http://localhost:3001/api/episodes/ep001/audio -X POST -H "Content-Type: application/json" -d '{}'
```

Expected: SSE stream opens; `data: {"phase":"audio","status":"started",...}` appears, followed by CLI output lines, then `data: {"phase":"audio","status":"complete",...}`.

Kill the background server after testing: `kill %1`

- [ ] **Step 4: Commit**

```bash
git add src/web/server/routes/audio.ts src/web/server/index.ts
git commit -m "feat(web/server): audio SSE route"
```

---

### Task 7: Prepare routes

**Files:**
- Create: `src/web/server/routes/prepare.ts`
- Modify: `src/web/server/index.ts`

- [ ] **Step 1: Create `src/web/server/routes/prepare.ts`**

```typescript
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { initSse, sendSse, runCli } from '../lib/cli-runner';

export const prepareRouter = Router();

function prepareJsonPath(series: string, epId: string) {
  return path.join(process.cwd(), 'output', 'publish', series, epId, 'prepare-youtube.json');
}

prepareRouter.post('/:epId/prepare', (req, res) => {
  const { epId } = req.params;
  const series = 'Youtube-studio'; // read from config in future
  initSse(res);
  sendSse(res, { phase: 'prepare', status: 'started' });
  runCli(['prepare', 'youtube', epId], (line) => {
    sendSse(res, { phase: 'prepare', raw: line });
  }).then((code) => {
    sendSse(res, { phase: 'prepare', status: code === 0 ? 'complete' : 'error', code });
    res.end();
  });
});

prepareRouter.get('/:epId/prepare', (req, res) => {
  const { epId } = req.params;
  const p = prepareJsonPath('Youtube-studio', epId);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'prepare artifact not found' });
  res.json(JSON.parse(fs.readFileSync(p, 'utf-8')));
});

prepareRouter.put('/:epId/prepare/select', (req, res) => {
  const { epId } = req.params;
  const { candidateId } = req.body as { candidateId: string };
  if (!candidateId) return res.status(400).json({ error: 'candidateId required' });

  initSse(res);
  sendSse(res, { phase: 'prepare-select', status: 'started', candidateId });
  // Delegate selection to /ars:apply-review pattern via CLI placeholder
  // For now: write selection directly via episode validate
  runCli(['episode', 'validate', epId], (line) => {
    sendSse(res, { phase: 'prepare-select', raw: line });
  }).then(() => {
    sendSse(res, { phase: 'prepare-select', status: 'complete' });
    res.end();
  });
});
```

- [ ] **Step 2: Add prepareRouter to `src/web/server/index.ts`**

Add `import { prepareRouter } from './routes/prepare';` and `app.use('/api/episodes', prepareRouter);`.

- [ ] **Step 3: Commit**

```bash
git add src/web/server/routes/prepare.ts src/web/server/index.ts
git commit -m "feat(web/server): prepare routes (generate + get + select)"
```

---

### Task 8: Export routes (render + download + publish)

**Files:**
- Create: `src/web/server/routes/export.ts`
- Modify: `src/web/server/index.ts`

- [ ] **Step 1: Create `src/web/server/routes/export.ts`**

```typescript
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { initSse, sendSse, runCli } from '../lib/cli-runner';

export const exportRouter = Router();

function outPath(epId: string) {
  return path.join(process.cwd(), 'out', `${epId}.mp4`);
}

// Render only (no upload) — uses `ars publish package`
exportRouter.post('/:epId/render', (req, res) => {
  const { epId } = req.params;
  initSse(res);
  sendSse(res, { phase: 'render', status: 'started' });
  runCli(['publish', 'package', epId, '--yes'], (line) => {
    sendSse(res, { phase: 'render', raw: line });
  }).then((code) => {
    const mp4 = outPath(epId);
    sendSse(res, {
      phase: 'render',
      status: code === 0 ? 'complete' : 'error',
      code,
      outputExists: fs.existsSync(mp4),
    });
    res.end();
  });
});

// Download rendered MP4
exportRouter.get('/:epId/download', (req, res) => {
  const { epId } = req.params;
  const mp4 = outPath(epId);
  if (!fs.existsSync(mp4)) return res.status(404).json({ error: 'Rendered file not found. Run render first.' });
  res.download(mp4, `${epId}.mp4`);
});

// Upload to YouTube (uses `ars upload youtube`)
exportRouter.post('/:epId/publish', (req, res) => {
  const { epId } = req.params;
  const privacy = (req.body as { privacy?: string }).privacy ?? 'private';
  initSse(res);
  sendSse(res, { phase: 'publish', status: 'started' });
  runCli(['upload', 'youtube', epId, '--privacy', privacy], (line) => {
    sendSse(res, { phase: 'publish', raw: line });
  }).then((code) => {
    sendSse(res, { phase: 'publish', status: code === 0 ? 'complete' : 'error', code });
    res.end();
  });
});
```

- [ ] **Step 2: Add exportRouter to `src/web/server/index.ts`**

Add import and `app.use('/api/episodes', exportRouter);`.

- [ ] **Step 3: Commit**

```bash
git add src/web/server/routes/export.ts src/web/server/index.ts
git commit -m "feat(web/server): export routes (render SSE + download + publish SSE)"
```

---

### Task 9: OAuth routes + studio-launcher

**Files:**
- Create: `src/web/server/routes/oauth.ts`
- Create: `src/web/server/lib/studio-launcher.ts`
- Modify: `src/web/server/index.ts`
- Create: `tests/web/server/routes/oauth.test.ts`

- [ ] **Step 1: Write failing OAuth status test**

Create `tests/web/server/routes/oauth.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../../src/web/server/lib/env-reader', () => ({
  youtubeCredentialStatus: vi.fn(),
}));

import { youtubeCredentialStatus } from '../../../src/web/server/lib/env-reader';
import { createApp } from '../../../src/web/server/index';

describe('GET /oauth/youtube/status', () => {
  it('returns { connected: true } when credentials present', async () => {
    vi.mocked(youtubeCredentialStatus).mockReturnValue({ connected: true });
    const app = createApp();
    const res = await request(app).get('/oauth/youtube/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: true });
  });

  it('returns { connected: false } when credentials missing', async () => {
    vi.mocked(youtubeCredentialStatus).mockReturnValue({ connected: false });
    const app = createApp();
    const res = await request(app).get('/oauth/youtube/status');
    expect(res.body).toEqual({ connected: false });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/web/server/routes/oauth.test.ts
```

- [ ] **Step 3: Create `src/web/server/routes/oauth.ts`**

```typescript
import { Router } from 'express';
import { youtubeCredentialStatus } from '../lib/env-reader';
import { initSse, sendSse, runCli } from '../lib/cli-runner';

export const oauthRouter = Router();

oauthRouter.get('/status', (_req, res) => {
  res.json(youtubeCredentialStatus());
});

// Spawns `ars auth youtube` which opens browser + local callback server on :3847
// and writes YOUTUBE_REFRESH_TOKEN to .env when done.
oauthRouter.post('/authorize', (req, res) => {
  const force = Boolean((req.body as { force?: boolean }).force);
  initSse(res);
  sendSse(res, { phase: 'oauth', status: 'started' });
  const args = ['auth', 'youtube'];
  if (force) args.push('--force');
  runCli(args, (line) => {
    sendSse(res, { phase: 'oauth', raw: line });
  }).then((code) => {
    const status = youtubeCredentialStatus();
    sendSse(res, { phase: 'oauth', status: code === 0 ? 'complete' : 'error', ...status });
    res.end();
  });
});
```

- [ ] **Step 4: Create `src/web/server/lib/studio-launcher.ts`**

```typescript
import { spawn } from 'child_process';
import http from 'http';

let studioProc: ReturnType<typeof spawn> | null = null;

export function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(`http://localhost:${port}/`, (res) => {
      resolve(res.statusCode !== undefined);
    }).on('error', () => resolve(false));
  });
}

export async function ensureStudio(epId: string, port = 5174): Promise<number> {
  if (await isPortOpen(port)) return port;
  if (await isPortOpen(port + 1)) return port + 1;

  studioProc = spawn('npx', ['ars', 'studio', epId, '--phase', 'review'], {
    cwd: process.cwd(),
    env: { ...process.env },
    detached: false,
    stdio: 'ignore',
  });

  // Wait up to 10s for Studio to respond
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isPortOpen(port)) return port;
    if (await isPortOpen(port + 1)) return port + 1;
  }
  throw new Error('Studio did not start in time');
}
```

- [ ] **Step 5: Wire oauthRouter into `src/web/server/index.ts`**

Add `import { oauthRouter } from './routes/oauth';` and the following in `createApp()`:

```typescript
app.use('/oauth/youtube', oauthRouter);

app.get('/api/episodes/:epId/studio-port', async (req, res) => {
  const { ensureStudio } = await import('./lib/studio-launcher');
  try {
    const port = await ensureStudio(req.params.epId);
    res.json({ port });
  } catch (err) {
    res.status(503).json({ error: String(err) });
  }
});
```

- [ ] **Step 6: Run OAuth test — expect PASS**

```bash
npx vitest run tests/web/server/routes/oauth.test.ts
```

Expected: `2 passed`

- [ ] **Step 8: Run all server tests**

```bash
npx vitest run tests/web/
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/web/server/routes/oauth.ts src/web/server/lib/studio-launcher.ts src/web/server/index.ts tests/web/server/routes/oauth.test.ts
git commit -m "feat(web/server): OAuth status + authorize routes + Studio launcher"
```

---

## Phase B — Frontend

### Task 10: Dashboard Vite config + React entry

**Files:**
- Create: `src/web/dashboard/index.html`
- Create: `src/web/dashboard/vite.config.ts`
- Create: `src/web/dashboard/src/main.tsx`
- Create: `src/web/dashboard/src/App.tsx`
- Modify: `package.json` (add dev:web script)

- [ ] **Step 1: Create `src/web/dashboard/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ARS Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/web/dashboard/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
      '/oauth': 'http://localhost:3001',
    },
  },
  build: {
    outDir: '../../../dist/dashboard',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 3: Create `src/web/dashboard/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 4: Create `src/web/dashboard/src/App.tsx`**

```tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Episodes from './pages/Episodes';
import Plan from './pages/Plan';
import Audio from './pages/Audio';
import Review from './pages/Review';
import Prepare from './pages/Prepare';
import Export from './pages/Export';

export default function App() {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/episodes" replace />} />
          <Route path="/episodes" element={<Episodes />} />
          <Route path="/episodes/:epId/plan" element={<Plan />} />
          <Route path="/episodes/:epId/audio" element={<Audio />} />
          <Route path="/episodes/:epId/review" element={<Review />} />
          <Route path="/episodes/:epId/prepare" element={<Prepare />} />
          <Route path="/episodes/:epId/export" element={<Export />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Add dev:web script to `package.json`**

In the `"scripts"` block, add:
```json
"dev:web": "concurrently \"tsx src/web/server/index.ts\" \"vite --config src/web/dashboard/vite.config.ts\""
```

Install concurrently:
```bash
npm install --save-dev concurrently
```

- [ ] **Step 6: Smoke test — open dashboard**

```bash
npx tsx src/web/server/index.ts &
npx vite --config src/web/dashboard/vite.config.ts
```

Open `http://localhost:3000`. Expect: React app renders (blank page or redirect to /episodes is fine at this stage).

- [ ] **Step 7: Commit**

```bash
git add src/web/dashboard/ package.json package-lock.json
git commit -m "feat(web/dashboard): Vite + React + React Router scaffold"
```

---

### Task 11: API client + Sidebar + ProgressStream hook

**Files:**
- Create: `src/web/dashboard/src/api.ts`
- Create: `src/web/dashboard/src/components/Sidebar.tsx`
- Create: `src/web/dashboard/src/components/ProgressStream.tsx`

- [ ] **Step 1: Create `src/web/dashboard/src/api.ts`**

```typescript
const BASE = '';  // proxied via Vite in dev, same-origin in prod

export interface EpisodeEntry { series: string; epId: string; filePath: string }
export interface PrepareArtifact { youtube: { candidates: Candidate[]; selected: string | null }; status: string }
export interface Candidate { id: string; title: string; description: string; tags: string[]; rationale: string }

export async function getEpisodes(): Promise<EpisodeEntry[]> {
  const res = await fetch(`${BASE}/api/episodes`);
  if (!res.ok) throw new Error('Failed to fetch episodes');
  return res.json();
}

export async function getPlan(epId: string): Promise<{ content: string }> {
  const res = await fetch(`${BASE}/api/episodes/${epId}/plan`);
  if (!res.ok) throw new Error('Failed to fetch plan');
  return res.json();
}

export async function savePlan(epId: string, content: string): Promise<void> {
  const res = await fetch(`${BASE}/api/episodes/${epId}/plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Failed to save plan');
}

export async function getPrepare(epId: string): Promise<PrepareArtifact> {
  const res = await fetch(`${BASE}/api/episodes/${epId}/prepare`);
  if (!res.ok) throw new Error('Failed to fetch prepare artifact');
  return res.json();
}

export async function selectCandidate(epId: string, candidateId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/episodes/${epId}/prepare/select`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateId }),
  });
  if (!res.ok) throw new Error('Failed to select candidate');
}

export async function getOauthStatus(): Promise<{ connected: boolean }> {
  const res = await fetch(`${BASE}/oauth/youtube/status`);
  return res.json();
}

export async function getStudioPort(epId: string): Promise<{ port: number }> {
  const res = await fetch(`${BASE}/api/episodes/${epId}/studio-port`);
  if (!res.ok) throw new Error('Studio failed to start');
  return res.json();
}

/** Open an SSE stream; calls onEvent for each parsed data line. Returns cleanup fn. */
export function openSse(
  url: string,
  onEvent: (data: Record<string, unknown>) => void,
  body?: Record<string, unknown>,
): () => void {
  // SSE with POST body: use fetch + ReadableStream
  const controller = new AbortController();
  fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try { onEvent(JSON.parse(line.slice(6))); } catch { /* ignore */ }
        }
      }
    }
  }).catch(() => {/* aborted */});
  return () => controller.abort();
}
```

- [ ] **Step 2: Create `src/web/dashboard/src/components/ProgressStream.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { openSse } from '../api';

interface Props {
  url: string;
  body?: Record<string, unknown>;
  onComplete?: () => void;
}

export default function ProgressStream({ url, body, onComplete }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setLines([]);
    setDone(false);
    const cleanup = openSse(url, (data) => {
      const raw = (data as { raw?: string; status?: string });
      if (raw.raw) setLines(l => [...l, raw.raw!]);
      if (raw.status === 'complete') { setDone(true); onComplete?.(); }
      if (raw.status === 'error') setDone(true);
    }, body);
    return cleanup;
  }, [url]);

  return (
    <div style={{ background: '#1a1a1a', color: '#eee', padding: 12, borderRadius: 6, fontFamily: 'monospace', fontSize: 12, maxHeight: 300, overflowY: 'auto' }}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
      {done && <div style={{ color: '#4caf50', marginTop: 4 }}>✓ Done</div>}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/web/dashboard/src/components/Sidebar.tsx`**

```tsx
import React from 'react';
import { NavLink, useParams } from 'react-router-dom';

const phases = [
  { to: '/episodes', label: 'Episodes' },
];

function EpisodePhases({ epId }: { epId: string }) {
  const links = [
    { to: `/episodes/${epId}/plan`, label: 'Plan' },
    { to: `/episodes/${epId}/audio`, label: 'Audio' },
    { to: `/episodes/${epId}/review`, label: 'Review' },
    { to: `/episodes/${epId}/prepare`, label: 'Prepare' },
    { to: `/episodes/${epId}/export`, label: 'Export' },
  ];
  return (
    <>
      {links.map(l => (
        <NavLink key={l.to} to={l.to} style={({ isActive }) => ({ display: 'block', padding: '8px 16px', color: isActive ? '#fff' : '#aaa', textDecoration: 'none', background: isActive ? '#333' : 'transparent' })}>
          {l.label}
        </NavLink>
      ))}
    </>
  );
}

export default function Sidebar() {
  const params = useParams<{ epId?: string }>();
  return (
    <nav style={{ width: 180, background: '#111', height: '100vh', overflowY: 'auto', flexShrink: 0 }}>
      <div style={{ padding: '16px', fontWeight: 'bold', color: '#fff', borderBottom: '1px solid #333' }}>ARS</div>
      <NavLink to="/episodes" style={({ isActive }) => ({ display: 'block', padding: '8px 16px', color: isActive ? '#fff' : '#aaa', textDecoration: 'none' })}>
        Episodes
      </NavLink>
      {params.epId && <EpisodePhases epId={params.epId} />}
    </nav>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/web/dashboard/src/api.ts src/web/dashboard/src/components/
git commit -m "feat(web/dashboard): api client + Sidebar + ProgressStream"
```

---

### Task 12: Episodes + Plan pages

**Files:**
- Create: `src/web/dashboard/src/pages/Episodes.tsx`
- Create: `src/web/dashboard/src/pages/Plan.tsx`

- [ ] **Step 1: Create `src/web/dashboard/src/pages/Episodes.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEpisodes, EpisodeEntry } from '../api';

export default function Episodes() {
  const [episodes, setEpisodes] = useState<EpisodeEntry[]>([]);
  const navigate = useNavigate();

  useEffect(() => { getEpisodes().then(setEpisodes).catch(console.error); }, []);

  return (
    <div>
      <h1>Episodes</h1>
      {episodes.length === 0 && <p style={{ color: '#888' }}>No episodes found.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {episodes.map(ep => (
          <li key={ep.epId} style={{ marginBottom: 8 }}>
            <button onClick={() => navigate(`/episodes/${ep.epId}/plan`)}
              style={{ padding: '10px 16px', cursor: 'pointer', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 4 }}>
              {ep.epId} <span style={{ color: '#888', fontSize: 12 }}>({ep.series})</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/web/dashboard/src/pages/Plan.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPlan, savePlan } from '../api';

export default function Plan() {
  const { epId } = useParams<{ epId: string }>();
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!epId) return;
    getPlan(epId).then(r => setContent(r.content)).catch(console.error);
  }, [epId]);

  const handleSave = async () => {
    if (!epId) return;
    await savePlan(epId, content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1>Plan — {epId}</h1>
      <textarea value={content} onChange={e => setContent(e.target.value)}
        style={{ width: '100%', height: 'calc(100vh - 180px)', fontFamily: 'monospace', fontSize: 13, background: '#111', color: '#eee', border: '1px solid #333', padding: 12, borderRadius: 4, boxSizing: 'border-box' }} />
      <button onClick={handleSave}
        style={{ marginTop: 8, padding: '8px 20px', cursor: 'pointer', background: saved ? '#4caf50' : '#1976d2', color: '#fff', border: 'none', borderRadius: 4 }}>
        {saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/web/dashboard/src/pages/Episodes.tsx src/web/dashboard/src/pages/Plan.tsx
git commit -m "feat(web/dashboard): Episodes + Plan pages"
```

---

### Task 13: Audio + Review pages

**Files:**
- Create: `src/web/dashboard/src/pages/Audio.tsx`
- Create: `src/web/dashboard/src/pages/Review.tsx`

- [ ] **Step 1: Create `src/web/dashboard/src/pages/Audio.tsx`**

```tsx
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import ProgressStream from '../components/ProgressStream';

export default function Audio() {
  const { epId } = useParams<{ epId: string }>();
  const [streaming, setStreaming] = useState(false);

  return (
    <div>
      <h1>Audio — {epId}</h1>
      <p style={{ color: '#888' }}>Generates TTS audio for all steps via MiniMax.</p>
      <button onClick={() => setStreaming(true)} disabled={streaming}
        style={{ padding: '10px 20px', cursor: streaming ? 'not-allowed' : 'pointer', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, marginBottom: 16 }}>
        {streaming ? 'Generating…' : 'Generate All Audio'}
      </button>
      {streaming && (
        <ProgressStream
          url={`/api/episodes/${epId}/audio`}
          body={{}}
          onComplete={() => setStreaming(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/web/dashboard/src/pages/Review.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getStudioPort } from '../api';

export default function Review() {
  const { epId } = useParams<{ epId: string }>();
  const [port, setPort] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!epId) return;
    getStudioPort(epId)
      .then(r => setPort(r.port))
      .catch(e => setError(String(e)));
  }, [epId]);

  const studioUrl = port
    ? `http://localhost:${port}/?series=Youtube-studio&ep=${epId}&phase=review`
    : null;

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Review — {epId}</h1>
        {studioUrl && (
          <a href={studioUrl} target="_blank" rel="noreferrer"
            style={{ color: '#90caf9', fontSize: 13 }}>Open in new tab ↗</a>
        )}
      </div>
      {error && <p style={{ color: '#f44' }}>{error}</p>}
      {!port && !error && <p style={{ color: '#888' }}>Starting Studio…</p>}
      {studioUrl && (
        <iframe src={studioUrl} style={{ flex: 1, border: '1px solid #333', borderRadius: 4 }} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/web/dashboard/src/pages/Audio.tsx src/web/dashboard/src/pages/Review.tsx
git commit -m "feat(web/dashboard): Audio + Review pages"
```

---

### Task 14: Prepare + Export pages

**Files:**
- Create: `src/web/dashboard/src/pages/Prepare.tsx`
- Create: `src/web/dashboard/src/pages/Export.tsx`
- Create: `src/web/dashboard/src/components/YoutubeStatus.tsx`

- [ ] **Step 1: Create `src/web/dashboard/src/components/YoutubeStatus.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { getOauthStatus, openSse } from '../api';

export default function YoutubeStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [log, setLog] = useState('');

  useEffect(() => {
    getOauthStatus().then(r => setConnected(r.connected));
  }, []);

  const handleConnect = () => {
    setAuthorizing(true);
    setLog('Opening browser for YouTube authorization…');
    const cleanup = openSse('/oauth/youtube/authorize', (data) => {
      const d = data as { raw?: string; status?: string; connected?: boolean };
      if (d.raw) setLog(d.raw);
      if (d.status === 'complete') {
        setConnected(true);
        setAuthorizing(false);
        cleanup();
      }
      if (d.status === 'error') {
        setLog('Authorization failed. Check console.');
        setAuthorizing(false);
        cleanup();
      }
    });
  };

  if (connected === null) return <span style={{ color: '#888' }}>Checking…</span>;

  return (
    <div>
      {connected
        ? <span style={{ color: '#4caf50' }}>✓ YouTube connected</span>
        : (
          <div>
            <span style={{ color: '#f44', marginRight: 12 }}>✗ YouTube not connected</span>
            <button onClick={handleConnect} disabled={authorizing}
              style={{ padding: '6px 14px', cursor: 'pointer', background: '#c62828', color: '#fff', border: 'none', borderRadius: 4 }}>
              {authorizing ? 'Authorizing…' : 'Connect YouTube'}
            </button>
            {log && <div style={{ marginTop: 6, color: '#888', fontSize: 12 }}>{log}</div>}
          </div>
        )
      }
    </div>
  );
}
```

- [ ] **Step 2: Create `src/web/dashboard/src/pages/Prepare.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPrepare, selectCandidate, PrepareArtifact, Candidate } from '../api';

export default function Prepare() {
  const { epId } = useParams<{ epId: string }>();
  const [artifact, setArtifact] = useState<PrepareArtifact | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!epId) return;
    getPrepare(epId)
      .then(a => { setArtifact(a); setSelected(a.youtube.selected); })
      .catch(console.error);
  }, [epId]);

  const handleSelect = async (id: string) => {
    if (!epId) return;
    await selectCandidate(epId, id);
    setSelected(id);
  };

  if (!artifact) return <p>Loading prepare artifact…</p>;

  return (
    <div>
      <h1>Prepare — {epId}</h1>
      {selected && <p style={{ color: '#4caf50' }}>Selected: {selected}</p>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {artifact.youtube.candidates.map((c: Candidate) => (
          <div key={c.id} style={{ border: `2px solid ${selected === c.id ? '#4caf50' : '#333'}`, borderRadius: 8, padding: 16, maxWidth: 340 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{c.id}</div>
            <div style={{ fontSize: 15, marginBottom: 8 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>{c.rationale}</div>
            <div style={{ fontSize: 11, color: '#777', marginBottom: 12 }}>{c.tags.join(' · ')}</div>
            <button onClick={() => handleSelect(c.id)}
              style={{ padding: '6px 16px', cursor: 'pointer', background: selected === c.id ? '#4caf50' : '#1976d2', color: '#fff', border: 'none', borderRadius: 4 }}>
              {selected === c.id ? 'Selected ✓' : 'Select'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/web/dashboard/src/pages/Export.tsx`**

```tsx
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import ProgressStream from '../components/ProgressStream';
import YoutubeStatus from '../components/YoutubeStatus';

export default function Export() {
  const { epId } = useParams<{ epId: string }>();
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [publishing, setPublishing] = useState(false);

  return (
    <div>
      <h1>Export — {epId}</h1>

      <section style={{ marginBottom: 32 }}>
        <h2>1. Render</h2>
        <p style={{ color: '#888', fontSize: 13 }}>Runs Remotion render to produce the MP4.</p>
        <button onClick={() => setRendering(true)} disabled={rendering}
          style={{ padding: '10px 20px', cursor: rendering ? 'not-allowed' : 'pointer', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4 }}>
          {rendering ? 'Rendering…' : 'Render Video'}
        </button>
        {rendering && (
          <div style={{ marginTop: 12 }}>
            <ProgressStream
              url={`/api/episodes/${epId}/render`}
              body={{}}
              onComplete={() => { setRendering(false); setRendered(true); }}
            />
          </div>
        )}
        {rendered && (
          <div style={{ marginTop: 12 }}>
            <a href={`/api/episodes/${epId}/download`}
              style={{ padding: '8px 16px', background: '#2e7d32', color: '#fff', borderRadius: 4, textDecoration: 'none' }}>
              ⬇ Download MP4
            </a>
          </div>
        )}
      </section>

      <section>
        <h2>2. Upload to YouTube</h2>
        <div style={{ marginBottom: 16 }}>
          <YoutubeStatus />
        </div>
        <button onClick={() => setPublishing(true)} disabled={publishing}
          style={{ padding: '10px 20px', cursor: publishing ? 'not-allowed' : 'pointer', background: '#c62828', color: '#fff', border: 'none', borderRadius: 4 }}>
          {publishing ? 'Uploading…' : 'Upload to YouTube'}
        </button>
        {publishing && (
          <div style={{ marginTop: 12 }}>
            <ProgressStream
              url={`/api/episodes/${epId}/publish`}
              body={{ privacy: 'private' }}
              onComplete={() => setPublishing(false)}
            />
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/web/dashboard/src/pages/Prepare.tsx src/web/dashboard/src/pages/Export.tsx src/web/dashboard/src/components/YoutubeStatus.tsx
git commit -m "feat(web/dashboard): Prepare + Export pages + YoutubeStatus"
```

---

### Task 15: `ars web` CLI command + production build

**Files:**
- Create: `cli/commands/web.ts`
- Modify: `cli/index.ts`
- Modify: `src/web/server/index.ts` (serve built dashboard)
- Modify: `package.json` (add build:web script)

- [ ] **Step 1: Add `build:web` script to `package.json`**

```json
"build:web": "vite build --config src/web/dashboard/vite.config.ts"
```

- [ ] **Step 2: Update `src/web/server/index.ts` to serve built dashboard**

Add static serving for the production build. The final `createApp()` function:

```typescript
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { episodesRouter } from './routes/episodes';
import { planRouter } from './routes/plan';
import { audioRouter } from './routes/audio';
import { prepareRouter } from './routes/prepare';
import { exportRouter } from './routes/export';
import { oauthRouter } from './routes/oauth';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/episodes', episodesRouter);
  app.use('/api/episodes', planRouter);
  app.use('/api/episodes', audioRouter);
  app.use('/api/episodes', prepareRouter);
  app.use('/api/episodes', exportRouter);
  app.use('/oauth/youtube', oauthRouter);

  app.get('/api/episodes/:epId/studio-port', async (req, res) => {
    const { ensureStudio } = await import('./lib/studio-launcher');
    try {
      const port = await ensureStudio(req.params.epId);
      res.json({ port });
    } catch (err) {
      res.status(503).json({ error: String(err) });
    }
  });

  app.get('/health', (_req, res) => { res.json({ ok: true }); });

  // Serve built dashboard (production)
  const distDir = path.join(process.cwd(), 'dist', 'dashboard');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  return app;
}

const PORT = Number(process.env.WEB_PORT ?? 3001);
const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`ARS Web Dashboard  →  http://localhost:${PORT}`);
  });
}
```

- [ ] **Step 3: Create `cli/commands/web.ts`**

```typescript
/**
 * @command web
 * @description Start the ARS local web dashboard.
 *
 * Usage:
 *   npx ars web [--port <num>] [--open]
 */
import { createApp } from '../../src/web/server/index';

const HELP = `
🌐 ARS Web Dashboard

Usage:
  npx ars web [options]

Options:
  --port <num>   Port to run on (default: 3001)
  --open         Open browser after start
  -h, --help     Show this help
`;

export async function run(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP.trim());
    return;
  }

  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 ? Number(args[portIdx + 1]) : 3001;
  const open = args.includes('--open');

  const { execFileSync } = await import('child_process');

  const app = createApp();
  app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n🌐 ARS Web Dashboard  →  ${url}\n`);
    if (open) {
      const bin = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'xdg-open';
      const openArgs = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
      try { execFileSync(bin, openArgs, { stdio: 'ignore' }); } catch { /* ignore */ }
    }
  });
}
```

- [ ] **Step 4: Register `web` command in `cli/index.ts`**

Find the switch/case block where commands are dispatched and add:

```typescript
case 'web':
  return import('./commands/web');
```

Also add to the help text:
```
web [--port <num>] [--open]          Start local web dashboard
```

- [ ] **Step 5: End-to-end smoke test**

```bash
npm run build:web
npx ars web --open
```

Expected: browser opens `http://localhost:3001`, dashboard loads, Episodes page lists ep001.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all existing tests + new web tests pass.

- [ ] **Step 7: Commit**

```bash
git add cli/commands/web.ts cli/index.ts src/web/server/index.ts package.json
git commit -m "feat(cli): ars web command + production build wiring"
```

---

## Done

After Task 15, `npx ars web --open` launches the full dashboard. The YouTube OAuth flow works by clicking "Connect YouTube" in the Export page, which triggers `ars auth youtube` (browser OAuth → token written to `.env`). Rendering and upload are separate actions.
