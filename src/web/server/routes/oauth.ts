import { Router } from 'express';
import { youtubeCredentialStatus } from '../lib/env-reader';
import { initSse, sendSse, runCli } from '../lib/cli-runner';

export const oauthRouter = Router();

oauthRouter.get('/status', (_req, res) => {
  res.json(youtubeCredentialStatus());
});

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
  }).catch((err) => {
    sendSse(res, { phase: 'oauth', status: 'error', message: String(err) });
    res.end();
  });
});
