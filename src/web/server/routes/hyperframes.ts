import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { initSse, sendSse } from '../lib/cli-runner';
import { spawn } from 'child_process';

export const hyperframesRouter = Router();

const SERIES = 'Youtube-studio';

function hfDir(epId: string) {
  return path.join(process.cwd(), 'public', 'episodes', SERIES, epId, 'hyperframes');
}

function hfHtmlPath(epId: string) {
  return path.join(hfDir(epId), 'index.html');
}

function hfMp4Path(epId: string) {
  return path.join(process.cwd(), 'out', `${epId}-hf.mp4`);
}

function readEpisodeContext(epId: string): string {
  const preparePath = path.join(
    process.cwd(), 'output', 'publish', SERIES, epId, 'prepare-youtube.json'
  );
  if (fs.existsSync(preparePath)) {
    return fs.readFileSync(preparePath, 'utf-8');
  }
  const planPath = path.join(process.cwd(), '.ars', 'episodes', epId, 'plan.md');
  return fs.existsSync(planPath) ? fs.readFileSync(planPath, 'utf-8') : '';
}

// POST /api/episodes/:epId/hyperframes/generate
hyperframesRouter.post('/:epId/hyperframes/generate', async (req, res) => {
  const { epId } = req.params;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in .env' });
  }

  const context = readEpisodeContext(epId);
  if (!context) {
    return res.status(404).json({ error: 'Episode context not found. Run ars prepare youtube first.' });
  }

  let stepsBlock = context;
  try {
    const json = JSON.parse(context);
    stepsBlock = json.steps
      .map((s: { id: string; heading: string; durationInSeconds: number; narrationSummary: string }) =>
        `- id: ${s.id}, heading: ${s.heading}, duration: ${s.durationInSeconds}s, narration: ${s.narrationSummary || '(silent)'}`)
      .join('\n');
  } catch { /* use raw context */ }

  const prompt = `You are generating a HyperFrames HTML composition for a short documentary-style video episode.

Episode: ${epId} (series: ${SERIES})

Steps (sequential, use relative timing):
${stepsBlock}

Asset paths relative to the HTML file at public/episodes/${SERIES}/${epId}/hyperframes/index.html:
- Each step's image: ../images/<stepId>.png
- Each step's audio (TTS narration): ../audio/<stepId>.mp3

Requirements:
1. 1920×1080 stage (data-width="1920" data-height="1080")
2. Every timed element must have class="clip"
3. Each step = one full-frame image background + one audio clip + one caption div
4. Use relative timing: set data-start on second step to the first step's id, and so on, so timing chains automatically
5. Images: data-duration equal to step's duration in seconds
6. Audio: no data-duration (defaults to source length)
7. Caption divs: white text, bottom-center, font-size ~48px, fade in with GSAP (register timeline as window.__timelines["${epId}"])
8. Keep GSAP animations simple: opacity fade-in 0.4s for each caption at its data-start time
9. Include <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
10. Output ONLY the complete HTML document — no markdown fences, no explanation

The video should feel like a calm, documentary-style slide show.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = msg.content[0];
    if (content.type !== 'text') throw new Error('Unexpected Claude response type');
    const html = content.text.replace(/^```html\n?/, '').replace(/\n?```$/, '');

    fs.mkdirSync(hfDir(epId), { recursive: true });
    fs.writeFileSync(hfHtmlPath(epId), html, 'utf-8');
    res.json({ ok: true, html });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/episodes/:epId/hyperframes/html
hyperframesRouter.get('/:epId/hyperframes/html', (req, res) => {
  const p = hfHtmlPath(req.params.epId);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'No HyperFrames HTML yet. Generate first.' });
  res.json({ html: fs.readFileSync(p, 'utf-8') });
});

// PUT /api/episodes/:epId/hyperframes/html
hyperframesRouter.put('/:epId/hyperframes/html', (req, res) => {
  const { html } = req.body as { html: string };
  if (typeof html !== 'string') return res.status(400).json({ error: 'html required' });
  const p = hfHtmlPath(req.params.epId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html, 'utf-8');
  res.json({ ok: true });
});

// POST /api/episodes/:epId/hyperframes/render — SSE
hyperframesRouter.post('/:epId/hyperframes/render', (req, res) => {
  const { epId } = req.params;
  const htmlPath = hfHtmlPath(epId);

  if (!fs.existsSync(htmlPath)) {
    return res.status(404).json({ error: 'HTML not found. Generate first.' });
  }

  const outputPath = hfMp4Path(epId);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  initSse(res);
  sendSse(res, { phase: 'hf-render', status: 'started', epId });

  // Use spawn directly (not runCli) since 'hyperframes' may not be an ars subcommand
  const proc = spawn(
    'npx',
    ['hyperframes', 'render', htmlPath, '--output', outputPath],
    { cwd: process.cwd(), env: { ...process.env } }
  );

  let remainder = '';
  const emit = (chunk: Buffer) => {
    const parts = (remainder + chunk.toString()).split('\n');
    remainder = parts.pop() ?? '';
    parts.filter(Boolean).forEach((line: string) =>
      sendSse(res, { phase: 'hf-render', raw: line })
    );
  };

  proc.stdout.on('data', emit);
  proc.stderr.on('data', emit);
  proc.on('close', (code: number) => {
    if (remainder) sendSse(res, { phase: 'hf-render', raw: remainder });
    sendSse(res, {
      phase: 'hf-render',
      status: code === 0 ? 'complete' : 'error',
      code,
      outputExists: fs.existsSync(outputPath),
    });
    res.end();
  });
  proc.on('error', (err) => {
    sendSse(res, { phase: 'hf-render', status: 'error', message: String(err) });
    res.end();
  });
});

// GET /api/episodes/:epId/hyperframes/download
hyperframesRouter.get('/:epId/hyperframes/download', (req, res) => {
  const { epId } = req.params;
  const mp4 = hfMp4Path(epId);
  if (!fs.existsSync(mp4)) {
    return res.status(404).json({ error: 'Rendered file not found. Run render first.' });
  }
  res.download(mp4, `${epId}-hf.mp4`);
});
