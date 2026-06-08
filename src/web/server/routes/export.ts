import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { initSse, sendSse, runCli } from '../lib/cli-runner';

export const exportRouter = Router();

function outPath(epId: string) {
  return path.join(process.cwd(), 'out', `${epId}.mp4`);
}

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

exportRouter.get('/:epId/download', (req, res) => {
  const { epId } = req.params;
  const mp4 = outPath(epId);
  if (!fs.existsSync(mp4)) return res.status(404).json({ error: 'Rendered file not found. Run render first.' });
  res.download(mp4, `${epId}.mp4`);
});

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
