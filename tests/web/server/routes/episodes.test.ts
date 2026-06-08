import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';

vi.mock('fs', async () => {
  const { fs } = await import('memfs');
  return { default: fs, ...fs };
});
vi.mock('fs/promises', async () => {
  const { fs } = await import('memfs');
  return fs.promises;
});

import request from 'supertest';
import { createApp } from '../../../../src/web/server/index';

describe('GET /api/episodes', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('returns list of episode directories', async () => {
    vol.fromJSON({
      '/repo/src/episodes/Youtube-studio/ep001.ts': '',
      '/repo/src/episodes/Youtube-studio/ep002.ts': '',
    });
    vi.spyOn(process, 'cwd').mockReturnValue('/repo');
    const app = createApp();
    const res = await request(app).get('/api/episodes');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toMatchObject({
      series: 'Youtube-studio',
      epId: 'ep001',
      filePath: 'src/episodes/Youtube-studio/ep001.ts',
    });
  });

  it('excludes template directory', async () => {
    vol.fromJSON({
      '/repo/src/episodes/template/ep001.ts': '',
      '/repo/src/episodes/Youtube-studio/ep001.ts': '',
    });
    vi.spyOn(process, 'cwd').mockReturnValue('/repo');
    const app = createApp();
    const res = await request(app).get('/api/episodes');
    expect(res.body.length).toBe(1);
    expect(res.body[0].series).toBe('Youtube-studio');
  });

  it('excludes subtitles and series-config files', async () => {
    vol.fromJSON({
      '/repo/src/episodes/Youtube-studio/ep001.ts': '',
      '/repo/src/episodes/Youtube-studio/ep001.subtitles.ts': '',
      '/repo/src/episodes/Youtube-studio/series-config.ts': '',
    });
    vi.spyOn(process, 'cwd').mockReturnValue('/repo');
    const app = createApp();
    const res = await request(app).get('/api/episodes');
    expect(res.body.length).toBe(1);
    expect(res.body[0].epId).toBe('ep001');
  });

  it('returns empty list when no episodes exist', async () => {
    vol.fromJSON({});
    vi.spyOn(process, 'cwd').mockReturnValue('/repo');
    const app = createApp();
    const res = await request(app).get('/api/episodes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
