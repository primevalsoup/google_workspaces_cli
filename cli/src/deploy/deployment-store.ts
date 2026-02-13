import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { DeploymentMetadata } from './types.js';

const STORE_DIR = path.join(os.homedir(), '.gproxy');
const STORE_FILE = path.join(STORE_DIR, 'deployments.json');

export function loadDeployments(): DeploymentMetadata[] {
  if (!fs.existsSync(STORE_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveDeployment(meta: DeploymentMetadata): void {
  const deployments = loadDeployments();

  // Replace existing entry with same scriptId, or append
  const idx = deployments.findIndex(d => d.scriptId === meta.scriptId);
  if (idx >= 0) {
    deployments[idx] = meta;
  } else {
    deployments.push(meta);
  }

  fs.mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(STORE_FILE, JSON.stringify(deployments, null, 2) + '\n', {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

export function findDeploymentByName(name: string): DeploymentMetadata | undefined {
  return loadDeployments().find(d => d.projectName === name);
}

export function removeDeployment(scriptId: string): void {
  const deployments = loadDeployments().filter(d => d.scriptId !== scriptId);
  fs.mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(STORE_FILE, JSON.stringify(deployments, null, 2) + '\n', {
    encoding: 'utf-8',
    mode: 0o600,
  });
}
