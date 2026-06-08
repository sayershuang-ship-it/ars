/**
 * @command web
 * @description Start the ARS local web dashboard.
 *
 * Usage:
 *   npx ars web [--port <num>] [--open]
 */
import { createApp } from '../../src/web/server/index';
import { execFileSync } from 'child_process';

const HELP = `
🌐 ARS Web Dashboard

Usage:
  npx ars web [options]

Options:
  --port <num>   Port to run on (default: 3001)
  --open         Open browser after start
  -h, --help     Show this help
`;

export async function run(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP.trim());
    return;
  }

  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 ? Number(args[portIdx + 1]) : 3001;
  const open = args.includes('--open');

  const app = createApp();
  app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n🌐 ARS Web Dashboard  →  ${url}\n`);
    if (open) {
      const bin =
        process.platform === 'darwin'
          ? 'open'
          : process.platform === 'win32'
            ? 'start'
            : 'xdg-open';
      try {
        execFileSync(bin, [url], { stdio: 'ignore' });
      } catch {
        /* ignore */
      }
    }
  });
}
