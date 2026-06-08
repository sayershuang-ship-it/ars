import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('child_process', () => ({ spawn: vi.fn() }));

import { spawn } from 'child_process';
import { runCli } from '../../../src/web/server/lib/cli-runner';

function makeMockProc() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

describe('runCli', () => {
  it('collects stdout lines and resolves with exit code 0', async () => {
    const proc = makeMockProc();
    vi.mocked(spawn).mockReturnValue(proc);

    const lines: string[] = [];
    const promise = runCli(['audio', 'ep001'], (l) => lines.push(l));

    proc.stdout.emit('data', Buffer.from('line1\nline2\n'));
    proc.emit('close', 0);

    const code = await promise;
    expect(code).toBe(0);
    expect(lines).toEqual(['line1', 'line2']);
  });

  it('also collects stderr lines', async () => {
    const proc = makeMockProc();
    vi.mocked(spawn).mockReturnValue(proc);

    const lines: string[] = [];
    const promise = runCli(['audio', 'ep001'], (l) => lines.push(l));

    proc.stderr.emit('data', Buffer.from('error line\n'));
    proc.emit('close', 1);

    const code = await promise;
    expect(code).toBe(1);
    expect(lines).toContain('error line');
  });
});
