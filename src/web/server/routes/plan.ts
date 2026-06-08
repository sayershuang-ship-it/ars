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
