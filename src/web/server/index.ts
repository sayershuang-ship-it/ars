import express from 'express';
import cors from 'cors';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: /^https?:\/\/localhost(:\d+)?$/ }));
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
