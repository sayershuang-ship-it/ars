import { spawn } from 'child_process';
import http from 'http';

let studioProc: ReturnType<typeof spawn> | null = null;

export function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(`http://localhost:${port}/`, (res) => {
      resolve(res.statusCode !== undefined);
    }).on('error', () => resolve(false));
  });
}

export async function ensureStudio(epId: string, port = 5174): Promise<number> {
  if (await isPortOpen(port)) return port;
  if (await isPortOpen(port + 1)) return port + 1;

  studioProc = spawn('npx', ['ars', 'studio', epId, '--phase', 'review'], {
    cwd: process.cwd(),
    env: { ...process.env },
    detached: false,
    stdio: 'ignore',
  });

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isPortOpen(port)) return port;
    if (await isPortOpen(port + 1)) return port + 1;
  }
  throw new Error('Studio did not start in time');
}
