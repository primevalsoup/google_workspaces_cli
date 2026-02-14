import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ClaspResult } from './types.js';
import { openUrl } from '../open-url.js';

export class AppsScriptApiDisabledError extends Error {
  constructor() {
    super('Apps Script API is not enabled');
    this.name = 'AppsScriptApiDisabledError';
  }
}

function runClasp(
  args: string[],
  cwd: string,
  timeoutMs = 60000,
): ClaspResult {
  try {
    const stdout = execFileSync('clasp', args, {
      cwd,
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, stdout: stdout.trim(), stderr: '' };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'stdout' in err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      return {
        success: false,
        stdout: (e.stdout || '').toString().trim(),
        stderr: (e.stderr || e.message || '').toString().trim(),
      };
    }
    return {
      success: false,
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
    };
  }
}

export function claspCreate(
  projectName: string,
  cwd: string,
): { scriptId: string } {
  const result = runClasp(
    ['create', '--title', projectName, '--rootDir', cwd],
    cwd,
    30000,
  );

  if (!result.success) {
    const msg = result.stderr || result.stdout;
    if (msg.includes('User has not enabled') || msg.includes('Apps Script API')) {
      throw new AppsScriptApiDisabledError();
    }
    throw new Error(`clasp create failed: ${msg}`);
  }

  // Read the generated .clasp.json to get scriptId
  const claspJsonPath = path.join(cwd, '.clasp.json');
  if (!fs.existsSync(claspJsonPath)) {
    throw new Error('clasp create did not generate .clasp.json');
  }

  const claspJson = JSON.parse(fs.readFileSync(claspJsonPath, 'utf-8'));
  if (!claspJson.scriptId) {
    throw new Error('No scriptId found in .clasp.json');
  }

  return { scriptId: claspJson.scriptId };
}

export function claspPush(cwd: string): void {
  const result = runClasp(['push', '--force'], cwd, 120000);

  if (!result.success) {
    throw new Error(`clasp push failed: ${result.stderr || result.stdout}`);
  }
}

export function claspDeploy(
  cwd: string,
  description: string,
): { deploymentId: string; webAppUrl: string } {
  const result = runClasp(['deploy', '-d', description], cwd, 60000);

  if (!result.success) {
    throw new Error(`clasp deploy failed: ${result.stderr || result.stdout}`);
  }

  // Parse deployment ID from output
  // Output format: "Created version N.\n- <deploymentId> @N."
  const output = result.stdout + '\n' + result.stderr;
  const match = output.match(/-\s+([\w-]+)\s+@/);

  if (!match) {
    // Try alternate format
    const altMatch = output.match(/Deployment\s+ID:\s+([\w-]+)/i) ||
                     output.match(/(AKfycb[\w-]+)/);
    if (altMatch) {
      const deploymentId = altMatch[1];
      return {
        deploymentId,
        webAppUrl: `https://script.google.com/macros/s/${deploymentId}/exec`,
      };
    }
    throw new Error(`Could not parse deployment ID from clasp output:\n${output}`);
  }

  const deploymentId = match[1];
  return {
    deploymentId,
    webAppUrl: `https://script.google.com/macros/s/${deploymentId}/exec`,
  };
}

export function claspOpen(cwd: string): void {
  const claspJsonPath = path.join(cwd, '.clasp.json');
  if (fs.existsSync(claspJsonPath)) {
    const { scriptId } = JSON.parse(fs.readFileSync(claspJsonPath, 'utf-8'));
    if (scriptId) {
      openUrl(`https://script.google.com/d/${scriptId}/edit`);
    }
  }
}

export function claspRun(
  functionName: string,
  cwd: string,
): ClaspResult {
  return runClasp(['run', functionName], cwd, 30000);
}

export interface ClaspProject {
  name: string;
  scriptId: string;
}

export function claspList(): ClaspProject[] {
  try {
    const stdout = execFileSync('clasp', ['list'], {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const projects: ClaspProject[] = [];
    const lineRe = /^(.+?)\s+-\s+https:\/\/script\.google\.com\/d\/([^/]+)\/edit/;

    for (const line of stdout.split('\n')) {
      const m = line.match(lineRe);
      if (m) {
        projects.push({ name: m[1].trim(), scriptId: m[2] });
      }
    }

    return projects;
  } catch {
    return [];
  }
}

export function writeClaspJson(cwd: string, scriptId: string): void {
  fs.writeFileSync(
    path.join(cwd, '.clasp.json'),
    JSON.stringify({ scriptId, rootDir: '.' }, null, 2) + '\n',
    'utf-8',
  );
}
