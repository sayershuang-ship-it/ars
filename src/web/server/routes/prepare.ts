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
  const series = 'Youtube-studio';
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
  runCli(['episode', 'validate', epId], (line) => {
    sendSse(res, { phase: 'prepare-select', raw: line });
  }).then(() => {
    sendSse(res, { phase: 'prepare-select', status: 'complete' });
    res.end();
  });
});
