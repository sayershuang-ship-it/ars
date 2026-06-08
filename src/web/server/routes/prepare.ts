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
  initSse(res);
  sendSse(res, { phase: 'prepare', status: 'started' });
  runCli(['prepare', 'youtube', epId], (line) => {
    sendSse(res, { phase: 'prepare', raw: line });
  }).then((code) => {
    sendSse(res, { phase: 'prepare', status: code === 0 ? 'complete' : 'error', code });
    res.end();
  }).catch((err) => {
    sendSse(res, { phase: 'prepare', status: 'error', message: String(err) });
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

  const jsonPath = prepareJsonPath('Youtube-studio', epId);
  if (!fs.existsSync(jsonPath)) return res.status(404).json({ error: 'prepare artifact not found' });

  let artifact: Record<string, unknown>;
  try {
    artifact = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch {
    return res.status(500).json({ error: 'failed to read prepare artifact' });
  }

  const youtube = artifact.youtube as Record<string, unknown>;
  const candidates = (youtube?.candidates ?? []) as Array<Record<string, unknown>>;
  const chosen = candidates.find((c) => c.id === candidateId);
  if (!chosen) return res.status(400).json({ error: `candidate '${candidateId}' not found` });

  youtube.selected = candidateId;
  youtube.title = chosen.title;
  youtube.description = chosen.description;
  youtube.tags = chosen.tags;
  artifact.status = 'ready';

  try {
    fs.writeFileSync(jsonPath, JSON.stringify(artifact, null, 2), 'utf-8');
  } catch {
    return res.status(500).json({ error: 'failed to write prepare artifact' });
  }

  initSse(res);
  sendSse(res, { phase: 'prepare-select', status: 'started', candidateId });
  runCli(['episode', 'validate', epId], (line) => {
    sendSse(res, { phase: 'prepare-select', raw: line });
  }).then((code) => {
    sendSse(res, { phase: 'prepare-select', status: code === 0 ? 'complete' : 'error', code, candidateId });
    res.end();
  }).catch((err) => {
    sendSse(res, { phase: 'prepare-select', status: 'error', message: String(err) });
    res.end();
  });
});
