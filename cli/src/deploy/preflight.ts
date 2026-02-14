import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { openUrl } from '../open-url.js';

interface PreflightResult {
  ok: boolean;
  claspPath: string;
  errors: string[];
}

function findClasp(): string | null {
  try {
    const result = execFileSync('which', ['clasp'], {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

function getClaspVersion(claspPath: string): string | null {
  try {
    const result = execFileSync(claspPath, ['--version'], {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    return result;
  } catch {
    return null;
  }
}

function isLoggedIn(claspPath: string): boolean {
  try {
    execFileSync(claspPath, ['list'], {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch (err: unknown) {
    const combined = extractOutput(err);
    if (combined.includes('not logged in') || combined.includes('credentials')) {
      return false;
    }
    // Other errors (network, etc.) — assume logged in, let later steps fail
    return true;
  }
}

/**
 * Check if the Apps Script API is enabled by attempting `clasp create`
 * in a temp directory. If it fails with the API-not-enabled error, we
 * know it's disabled. We clean up regardless.
 */
function isAppsScriptApiEnabled(claspPath: string): boolean {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gproxy-apicheck-'));
  try {
    execFileSync(claspPath, ['create', '--title', 'gproxy__api_check_ok_to_delete', '--rootDir', tmpDir], {
      encoding: 'utf-8',
      timeout: 15000,
      cwd: tmpDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Succeeded — API is enabled. Clean up the created project is not possible
    // via clasp, but the temp dir will be removed. The orphan project is harmless.
    return true;
  } catch (err: unknown) {
    const combined = extractOutput(err);
    if (combined.includes('not enabled') || combined.includes('apps script api')) {
      return false;
    }
    // Other errors — assume enabled, let the real create step handle it
    return true;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}


function extractOutput(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return [e.stdout, e.stderr, e.message].filter(Boolean).join('\n').toLowerCase();
  }
  return err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
}

export async function runPreflight(): Promise<PreflightResult> {
  const errors: string[] = [];

  // 1. Check clasp installed
  process.stderr.write(chalk.dim('  Checking clasp installation...\n'));
  let claspPath = findClasp();

  if (!claspPath) {
    try {
      execFileSync('npx', ['--yes', '@google/clasp', '--version'], {
        encoding: 'utf-8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      claspPath = 'npx';
    } catch {
      // Not available
    }
  }

  if (!claspPath) {
    errors.push(
      'clasp is not installed. Install it with:\n' +
      chalk.cyan('  npm install -g @google/clasp'),
    );
    return { ok: false, claspPath: '', errors };
  }

  if (claspPath !== 'npx') {
    const version = getClaspVersion(claspPath);
    if (version) {
      process.stderr.write(chalk.dim(`  clasp ${version}\n`));
    }
  } else {
    process.stderr.write(chalk.dim('  clasp (via npx)\n'));
  }

  // 2. Check login status
  process.stderr.write(chalk.dim('  Checking clasp login...\n'));
  const realClasp = claspPath === 'npx' ? 'clasp' : claspPath;

  if (!isLoggedIn(realClasp)) {
    errors.push(
      'Not logged into clasp. Run:\n' +
      chalk.cyan('  clasp login'),
    );
    return { ok: false, claspPath, errors };
  }
  process.stderr.write(chalk.dim('  Logged in\n'));

  // 3. Check Apps Script API
  process.stderr.write(chalk.dim('  Checking Apps Script API...\n'));

  if (!isAppsScriptApiEnabled(realClasp)) {
    const settingsUrl = 'https://script.google.com/home/usersettings';
    process.stderr.write(chalk.yellow('\n  The Apps Script API is not enabled for your account.\n'));
    openUrl(settingsUrl);

    await confirm({
      message: 'I\'ve enabled the Apps Script API — continue?',
    });

    process.stderr.write(chalk.dim('  Re-checking...\n'));
    if (!isAppsScriptApiEnabled(realClasp)) {
      errors.push(
        'Apps Script API is still not enabled. Please enable it at:\n' +
        chalk.cyan(`  ${settingsUrl}\n`) +
        '\nThen re-run this command.',
      );
      return { ok: false, claspPath, errors };
    }
  }

  process.stderr.write(chalk.dim('  Apps Script API enabled\n'));

  return { ok: true, claspPath, errors };
}
