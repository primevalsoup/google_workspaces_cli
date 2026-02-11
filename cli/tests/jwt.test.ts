import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { createToken } from '../src/jwt.js';

function base64urlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  return Buffer.from(base64, 'base64');
}

describe('createToken', () => {
  const secret = 'test-secret-that-is-at-least-32-bytes-long!!';

  it('produces a token with 3 dot-separated parts', () => {
    const token = createToken(secret);
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('header decodes to {"alg":"HS256","typ":"JWT"}', () => {
    const token = createToken(secret);
    const headerB64 = token.split('.')[0];
    const header = JSON.parse(base64urlDecode(headerB64).toString('utf-8'));
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
  });

  it('payload has iat, exp, and jti fields', () => {
    const token = createToken(secret);
    const payloadB64 = token.split('.')[1];
    const payload = JSON.parse(base64urlDecode(payloadB64).toString('utf-8'));
    expect(payload).toHaveProperty('iat');
    expect(payload).toHaveProperty('exp');
    expect(payload).toHaveProperty('jti');
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    expect(typeof payload.jti).toBe('string');
  });

  it('exp = iat + 300 (5-minute expiry)', () => {
    const token = createToken(secret);
    const payloadB64 = token.split('.')[1];
    const payload = JSON.parse(base64urlDecode(payloadB64).toString('utf-8'));
    expect(payload.exp).toBe(payload.iat + 300);
  });

  it('iat is close to current time', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = createToken(secret);
    const after = Math.floor(Date.now() / 1000);
    const payloadB64 = token.split('.')[1];
    const payload = JSON.parse(base64urlDecode(payloadB64).toString('utf-8'));
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after);
  });

  it('jti is unique across tokens', () => {
    const token1 = createToken(secret);
    const token2 = createToken(secret);
    const jti1 = JSON.parse(base64urlDecode(token1.split('.')[1]).toString('utf-8')).jti;
    const jti2 = JSON.parse(base64urlDecode(token2.split('.')[1]).toString('utf-8')).jti;
    expect(jti1).not.toBe(jti2);
  });

  it('signature matches manual HMAC-SHA256 computation', () => {
    const token = createToken(secret);
    const parts = token.split('.');
    const signingInput = `${parts[0]}.${parts[1]}`;

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(parts[2]).toBe(expectedSig);
  });

  it('base64url encoding contains no +, /, or = characters', () => {
    // Run multiple tokens to increase confidence
    for (let i = 0; i < 20; i++) {
      const token = createToken(secret);
      expect(token).not.toMatch(/[+/=]/);
    }
  });

  it('tokens with different secrets produce different signatures', () => {
    const token1 = createToken('secret-aaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const token2 = createToken('secret-bbbbbbbbbbbbbbbbbbbbbbbbbbb');
    const sig1 = token1.split('.')[2];
    const sig2 = token2.split('.')[2];
    expect(sig1).not.toBe(sig2);
  });

  it('produces base64url encoding compatible with Apps Script decoding', () => {
    // Verify the CLI's base64url matches the pattern used by Apps Script:
    // Apps Script: Utilities.base64Encode(bytes).replace(/+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    // CLI: Buffer.toString('base64').replace(/+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const token = createToken(secret);
    const parts = token.split('.');

    // Decode header and re-encode to verify round-trip
    const headerBytes = base64urlDecode(parts[0]);
    const reEncoded = headerBytes.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(reEncoded).toBe(parts[0]);
  });
});
