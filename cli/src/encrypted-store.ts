/**
 * Encrypted file credential store — fallback for headless Linux / CI
 * where no OS keyring is available.
 *
 * File format (~/.gproxy/credentials.enc):
 * {
 *   "salt": "<hex>",       // 32 bytes, random per file
 *   "iv": "<hex>",         // 16 bytes, random per encryption
 *   "tag": "<hex>",        // 16 bytes, GCM auth tag
 *   "data": "<hex>"        // AES-256-GCM ciphertext of JSON payload
 * }
 *
 * Key derivation: scrypt(password, salt, N=16384, r=8, p=1, keyLen=32)
 * Password source: GPROXY_KEYRING_PASSWORD env var > interactive prompt
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createInterface } from 'node:readline';

const STORE_DIR = path.join(os.homedir(), '.gproxy');
const STORE_FILE = path.join(STORE_DIR, 'credentials.enc');

interface EncryptedBlob {
  salt: string;
  iv: string;
  tag: string;
  data: string;
}

interface CredentialData {
  [key: string]: string;
}

function getPassword(): string | null {
  const envPassword = process.env.GPROXY_KEYRING_PASSWORD;
  if (envPassword) return envPassword;

  // Interactive prompt only if stdin is a TTY
  if (!process.stdin.isTTY) return null;

  // Synchronous password prompt via readline
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  let password: string | null = null;
  // Use a synchronous approach: write prompt, read from fd 0
  try {
    process.stderr.write('Keyring password: ');
    const buf = Buffer.alloc(1024);
    const fd = fs.openSync('/dev/tty', 'r');
    let input = '';
    let bytesRead = 0;
    // Read one byte at a time until newline
    do {
      bytesRead = fs.readSync(fd, buf, 0, 1, null);
      if (bytesRead > 0) {
        const ch = buf.toString('utf-8', 0, 1);
        if (ch === '\n' || ch === '\r') break;
        input += ch;
      }
    } while (bytesRead > 0);
    fs.closeSync(fd);
    process.stderr.write('\n');
    password = input || null;
  } catch {
    // Can't read from terminal
  }
  rl.close();
  return password;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
}

function encrypt(plaintext: string, password: string): EncryptedBlob {
  const salt = crypto.randomBytes(32);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  };
}

function decrypt(blob: EncryptedBlob, password: string): string | null {
  try {
    const salt = Buffer.from(blob.salt, 'hex');
    const iv = Buffer.from(blob.iv, 'hex');
    const tag = Buffer.from(blob.tag, 'hex');
    const data = Buffer.from(blob.data, 'hex');

    const key = deriveKey(password, salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);
    return decrypted.toString('utf-8');
  } catch {
    return null;
  }
}

function loadBlob(): EncryptedBlob | null {
  try {
    const content = fs.readFileSync(STORE_FILE, 'utf-8');
    const blob = JSON.parse(content) as EncryptedBlob;
    if (blob.salt && blob.iv && blob.tag && blob.data) return blob;
    return null;
  } catch {
    return null;
  }
}

function saveBlob(blob: EncryptedBlob): void {
  fs.mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(STORE_FILE, JSON.stringify(blob, null, 2) + '\n', {
    mode: 0o600,
  });
}

// Cache password within a single process run
let cachedPassword: string | null | undefined;

function resolvePassword(): string | null {
  if (cachedPassword !== undefined) return cachedPassword;
  cachedPassword = getPassword();
  return cachedPassword;
}

/**
 * Check if the encrypted store has data.
 */
export function encryptedStoreExists(): boolean {
  return loadBlob() !== null;
}

/**
 * Read a credential from the encrypted store.
 */
export function encryptedStoreGet(key: string): string | null {
  const blob = loadBlob();
  if (!blob) return null;

  const password = resolvePassword();
  if (!password) return null;

  const plaintext = decrypt(blob, password);
  if (!plaintext) return null;

  try {
    const data = JSON.parse(plaintext) as CredentialData;
    return data[key] ?? null;
  } catch {
    return null;
  }
}

/**
 * Write a credential to the encrypted store (merges with existing data).
 */
export function encryptedStoreSet(key: string, value: string): boolean {
  const password = resolvePassword();
  if (!password) return false;

  // Load existing data if any
  let data: CredentialData = {};
  const blob = loadBlob();
  if (blob) {
    const plaintext = decrypt(blob, password);
    if (plaintext) {
      try { data = JSON.parse(plaintext); } catch { /* start fresh */ }
    }
  }

  data[key] = value;
  const newBlob = encrypt(JSON.stringify(data), password);
  saveBlob(newBlob);
  return true;
}

/**
 * Write multiple credentials at once.
 */
export function encryptedStoreSave(entries: Record<string, string>): boolean {
  const password = resolvePassword();
  if (!password) return false;

  // Load existing data if any
  let data: CredentialData = {};
  const blob = loadBlob();
  if (blob) {
    const plaintext = decrypt(blob, password);
    if (plaintext) {
      try { data = JSON.parse(plaintext); } catch { /* start fresh */ }
    }
  }

  Object.assign(data, entries);
  const newBlob = encrypt(JSON.stringify(data), password);
  saveBlob(newBlob);
  return true;
}
