#!/usr/bin/env npx tsx
/**
 * Thin wrapper that runs `gproxy deploy` with forwarded args.
 * Usage: npx tsx scripts/install.ts [--dry-run] [--non-interactive] [--services gmail,drive]
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliEntry = path.resolve(__dirname, '..', 'cli', 'dist', 'index.js');

try {
  execFileSync('node', [cliEntry, 'deploy', ...process.argv.slice(2)], {
    stdio: 'inherit',
  });
} catch (err: unknown) {
  if (err && typeof err === 'object' && 'status' in err) {
    process.exit((err as { status: number }).status);
  }
  process.exit(1);
}
