import express from 'express';
import cors from 'cors';
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
  return app;
}

const PORT = Number(process.env.WEB_PORT ?? 3001);
const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  const app = createApp();
  app.listen(PORT, () => console.log(`ARS Web  →  http://localhost:${PORT}`));
}
