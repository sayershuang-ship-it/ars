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

describe('Plan routes', () => {
  beforeEach(() => {
    vol.reset();
    vi.spyOn(process, 'cwd').mockReturnValue('/repo');
  });

  it('GET /api/episodes/:epId/plan returns plan.md content', async () => {
    vol.fromJSON({ '/repo/.ars/episodes/ep001/plan.md': '# plan' });
    const app = createApp();
    const res = await request(app).get('/api/episodes/ep001/plan');
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('# plan');
  });

  it('PUT /api/episodes/:epId/plan writes new content', async () => {
    vol.fromJSON({ '/repo/.ars/episodes/ep001/plan.md': '# old' });
    const app = createApp();
    const res = await request(app)
      .put('/api/episodes/ep001/plan')
      .send({ content: '# new' });
    expect(res.status).toBe(200);
    const after = vol.readFileSync('/repo/.ars/episodes/ep001/plan.md', 'utf-8');
    expect(after).toBe('# new');
  });
});
