import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { GProxyConfig, GlobalOptions } from './types.js';

const CONFIG_DIR = path.join(os.homedir(), '.gproxy');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfigFile(): Partial<GProxyConfig> {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as Partial<GProxyConfig>;
  } catch {
    return {};
  }
}

export function loadConfig(options: GlobalOptions): GProxyConfig {
  const fileConfig = loadConfigFile();

  const proxy_url =
    options.proxyUrl ||
    process.env.GPROXY_URL ||
    fileConfig.proxy_url ||
    '';

  const secret =
    options.secret ||
    process.env.GPROXY_SECRET ||
    fileConfig.secret ||
    '';

  if (!proxy_url) {
    throw new Error(
      'No proxy URL configured. Set --proxy-url, GPROXY_URL env var, or run: gproxy setup'
    );
  }

  if (!secret) {
    throw new Error(
      'No shared secret configured. Set --secret, GPROXY_SECRET env var, or run: gproxy setup'
    );
  }

  if (!proxy_url.startsWith('https://')) {
    throw new Error(
      `Proxy URL must start with https:// (got: ${proxy_url})`
    );
  }

  return { proxy_url, secret };
}

export function saveConfig(config: GProxyConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', {
    mode: 0o600,
  });
}
