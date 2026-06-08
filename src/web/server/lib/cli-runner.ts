import { spawn } from 'child_process';
import type { Response } from 'express';

export function initSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

export function sendSse(res: Response, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function runCli(
  args: string[],
  onLine: (line: string) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['ars', ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
    });
    let remainder = '';
    const emit = (chunk: Buffer) => {
      const parts = (remainder + chunk.toString()).split('\n');
      remainder = parts.pop() ?? '';
      parts.filter(Boolean).forEach(onLine);
    };
    proc.stdout.on('data', emit);
    proc.stderr.on('data', emit);
    proc.on('close', (code) => {
      if (remainder) onLine(remainder);
      resolve(code ?? 0);
    });
    proc.on('error', reject);
  });
}
