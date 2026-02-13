import { execFileSync } from 'node:child_process';

export const KEYCHAIN_SERVICE = 'gproxy';
export const KEYCHAIN_ACCOUNT_SECRET = 'jwt-secret';
export const KEYCHAIN_ACCOUNT_URL = 'proxy-url';

type Backend = 'macos' | 'linux' | 'none';

let detectedBackend: Backend | undefined;

function detectBackend(): Backend {
  if (detectedBackend !== undefined) return detectedBackend;

  if (process.platform === 'darwin') {
    detectedBackend = 'macos';
  } else if (process.platform === 'linux') {
    try {
      execFileSync('which', ['secret-tool'], {
        encoding: 'utf-8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      detectedBackend = 'linux';
    } catch {
      detectedBackend = 'none';
    }
  } else {
    detectedBackend = 'none';
  }

  return detectedBackend;
}

export function keychainAvailable(): boolean {
  return detectBackend() !== 'none';
}

// ── macOS: `security` command ────────────────────────────────────

function macosGet(service: string, account: string): string | null {
  try {
    const result = execFileSync('security', [
      'find-generic-password',
      '-s', service,
      '-a', account,
      '-w',
    ], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

function macosSet(value: string, service: string, account: string): boolean {
  try {
    execFileSync('security', [
      'add-generic-password',
      '-U',
      '-s', service,
      '-a', account,
      '-w', value,
    ], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

function macosDelete(service: string, account: string): boolean {
  try {
    execFileSync('security', [
      'delete-generic-password',
      '-s', service,
      '-a', account,
    ], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

// ── Linux: `secret-tool` (GNOME Keyring / KDE Wallet via D-Bus) ─

function linuxGet(service: string, account: string): string | null {
  try {
    const result = execFileSync('secret-tool', [
      'lookup', 'service', service, 'account', account,
    ], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

function linuxSet(value: string, service: string, account: string): boolean {
  try {
    execFileSync('secret-tool', [
      'store',
      '--label', `gproxy ${account}`,
      'service', service,
      'account', account,
    ], {
      encoding: 'utf-8',
      timeout: 5000,
      input: value,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

function linuxDelete(service: string, account: string): boolean {
  try {
    execFileSync('secret-tool', [
      'clear', 'service', service, 'account', account,
    ], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

// ── Public API (dispatches to platform backend) ──────────────────

export function keychainGet(service: string, account: string): string | null {
  const backend = detectBackend();
  if (backend === 'macos') return macosGet(service, account);
  if (backend === 'linux') return linuxGet(service, account);
  return null;
}

export function keychainSet(value: string, service: string, account: string): boolean {
  const backend = detectBackend();
  if (backend === 'macos') return macosSet(value, service, account);
  if (backend === 'linux') return linuxSet(value, service, account);
  return false;
}

export function keychainDelete(service: string, account: string): boolean {
  const backend = detectBackend();
  if (backend === 'macos') return macosDelete(service, account);
  if (backend === 'linux') return linuxDelete(service, account);
  return false;
}
