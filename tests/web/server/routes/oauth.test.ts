import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../src/web/server/lib/env-reader', () => ({
  youtubeCredentialStatus: vi.fn(),
}));

import { youtubeCredentialStatus } from '../../../../src/web/server/lib/env-reader';
import { createApp } from '../../../../src/web/server/index';
import request from 'supertest';

describe('GET /oauth/youtube/status', () => {
  it('returns { connected: true } when credentials present', async () => {
    vi.mocked(youtubeCredentialStatus).mockReturnValue({ connected: true });
    const app = createApp();
    const res = await request(app).get('/oauth/youtube/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: true });
  });

  it('returns { connected: false } when credentials missing', async () => {
    vi.mocked(youtubeCredentialStatus).mockReturnValue({ connected: false });
    const app = createApp();
    const res = await request(app).get('/oauth/youtube/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: false });
  });
});
