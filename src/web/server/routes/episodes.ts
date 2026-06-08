import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export const episodesRouter = Router();

function getSeriesDir() {
  return path.join(process.cwd(), 'src', 'episodes');
}

episodesRouter.get('/', (_req, res) => {
  const seriesDir = getSeriesDir();
  try {
    if (!fs.existsSync(seriesDir)) {
      return res.json([]);
    }
    const series = fs.readdirSync(seriesDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'template')
      .map(d => d.name);

    const episodes = series.flatMap(s =>
      fs.readdirSync(path.join(seriesDir, s))
        .filter(f => f.endsWith('.ts') && !f.includes('.subtitles') && !f.includes('series-config'))
        .map(f => ({
          series: s,
          epId: f.replace('.ts', ''),
          filePath: path.join('src', 'episodes', s, f),
        }))
    );
    res.json(episodes);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

episodesRouter.get('/:epId', (req, res) => {
  const { epId } = req.params;
  const seriesDir = getSeriesDir();
  try {
    const series = fs.readdirSync(seriesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .find(s => fs.existsSync(path.join(seriesDir, s, `${epId}.ts`)));

    if (!series) return res.status(404).json({ error: 'Episode not found' });

    const workstatePath = path.join(process.cwd(), '.ars', 'state', 'workstate.json');
    const workstate = fs.existsSync(workstatePath)
      ? JSON.parse(fs.readFileSync(workstatePath, 'utf-8'))
      : null;

    res.json({ epId, series, workstate });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
