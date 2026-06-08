import { describe, it, expect, vi } from 'vitest';
import { vol } from 'memfs';

vi.mock('fs', async () => {
  const { fs } = await import('memfs');
  return { default: fs, ...fs };
});

import { readEnvKey, youtubeCredentialStatus } from '../../../src/web/server/lib/env-reader';

describe('readEnvKey', () => {
  it('parses a key from .env content', () => {
    vol.fromJSON({ '/repo/.env': 'FOO=bar\nBAZ=qux\n' });
    const val = readEnvKey('/repo/.env', 'FOO');
    expect(val).toBe('bar');
  });

  it('returns undefined for missing key', () => {
    vol.fromJSON({ '/repo/.env': 'FOO=bar\n' });
    expect(readEnvKey('/repo/.env', 'MISSING')).toBeUndefined();
  });
});

describe('youtubeCredentialStatus', () => {
  it('returns connected: true when all three keys are present', () => {
    vol.fromJSON({
      '/repo/.env':
        'YOUTUBE_CLIENT_ID=cid\nYOUTUBE_CLIENT_SECRET=sec\nYOUTUBE_REFRESH_TOKEN=tok\n',
    });
    expect(youtubeCredentialStatus('/repo/.env')).toEqual({ connected: true });
  });

  it('returns connected: false when REFRESH_TOKEN is missing', () => {
    vol.fromJSON({ '/repo/.env': 'YOUTUBE_CLIENT_ID=cid\nYOUTUBE_CLIENT_SECRET=sec\n' });
    expect(youtubeCredentialStatus('/repo/.env')).toEqual({ connected: false });
  });
});
