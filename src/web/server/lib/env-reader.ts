import fs from 'fs';
import path from 'path';

export const ENV_PATH = path.join(process.cwd(), '.env');

export function readEnvKey(envPath: string, key: string): string | undefined {
  try {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m && m[1].trim() === key) return m[2].trim();
    }
  } catch {
    // file missing
  }
  return undefined;
}

export function youtubeCredentialStatus(envPath = ENV_PATH): { connected: boolean } {
  const token = readEnvKey(envPath, 'YOUTUBE_REFRESH_TOKEN');
  return { connected: Boolean(token) };
}
