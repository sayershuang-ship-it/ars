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
  app.disable('x-powered-by');
  app.use(cors({ origin: /^https?:\/\/localhost(:\d+)?$/ }));
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
    // SPA fallback: serve index.html for client-side routing
    app.use((_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  return app;
}

const PORT = Number(process.env.WEB_PORT ?? 3001);
const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  const app = createApp();
  app.listen(PORT, () => console.log(`ARS Web  →  http://localhost:${PORT}`));
}
