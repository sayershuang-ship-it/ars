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
