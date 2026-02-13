import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { GProxyConfig, GlobalOptions } from './types.js';
import {
  keychainAvailable, keychainGet, keychainSet,
  KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_SECRET, KEYCHAIN_ACCOUNT_URL,
} from './keychain.js';
import {
  encryptedStoreExists, encryptedStoreGet, encryptedStoreSave,
} from './encrypted-store.js';

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

function writeConfigFile(data: Record<string, string>): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2) + '\n', {
    mode: 0o600,
  });
}

export function loadConfig(options: GlobalOptions): GProxyConfig {
  const fileConfig = loadConfigFile();

  // URL priority: CLI flag > env var > keychain > encrypted store > config file
  let proxy_url =
    options.proxyUrl ||
    process.env.GPROXY_URL ||
    '';

  if (!proxy_url) {
    proxy_url =
      keychainGet(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_URL) ||
      encryptedStoreGet('proxy_url') ||
      fileConfig.proxy_url ||
      '';
  }

  // Secret priority: CLI flag > env var > keychain > encrypted store > config file
  let secret =
    options.secret ||
    process.env.GPROXY_SECRET ||
    '';

  if (!secret) {
    secret =
      keychainGet(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_SECRET) ||
      encryptedStoreGet('secret') ||
      fileConfig.secret ||
      '';
  }

  // Migrate: plaintext config file → best available secure store
  if (fileConfig.proxy_url || fileConfig.secret) {
    let migrated = false;

    if (keychainAvailable()) {
      if (fileConfig.proxy_url && !keychainGet(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_URL)) {
        if (keychainSet(fileConfig.proxy_url, KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_URL)) migrated = true;
      }
      if (fileConfig.secret && !keychainGet(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_SECRET)) {
        if (keychainSet(fileConfig.secret, KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_SECRET)) migrated = true;
      }
    } else if (!encryptedStoreExists()) {
      // No OS keychain — try encrypted file (will prompt for password or use env var)
      const entries: Record<string, string> = {};
      if (fileConfig.proxy_url) entries.proxy_url = fileConfig.proxy_url;
      if (fileConfig.secret) entries.secret = fileConfig.secret;
      if (Object.keys(entries).length > 0) {
        migrated = encryptedStoreSave(entries);
      }
    }

    if (migrated) {
      const { proxy_url: _url, secret: _sec, ...rest } = fileConfig;
      writeConfigFile(rest as Record<string, string>);
    }
  }

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

export type SaveResult = { store: 'keychain' | 'encrypted' | 'file' };

export function saveConfig(config: GProxyConfig): SaveResult {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });

  // 1. Try OS keychain
  if (keychainAvailable()) {
    const urlOk = keychainSet(config.proxy_url, KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_URL);
    const secretOk = keychainSet(config.secret, KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_SECRET);
    if (urlOk && secretOk) {
      writeConfigFile({});
      return { store: 'keychain' };
    }
  }

  // 2. Try encrypted file
  const saved = encryptedStoreSave({
    proxy_url: config.proxy_url,
    secret: config.secret,
  });
  if (saved) {
    writeConfigFile({});
    return { store: 'encrypted' };
  }

  // 3. Plaintext fallback
  writeConfigFile({ proxy_url: config.proxy_url, secret: config.secret });
  return { store: 'file' };
}
