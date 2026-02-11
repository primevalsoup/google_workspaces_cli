import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GPROXY_URL;
    delete process.env.GPROXY_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads config from CLI flags (highest priority)', () => {
    process.env.GPROXY_URL = 'https://env-url.example.com/exec';
    process.env.GPROXY_SECRET = 'env-secret';

    const config = loadConfig({
      proxyUrl: 'https://flag-url.example.com/exec',
      secret: 'flag-secret',
    });

    expect(config.proxy_url).toBe('https://flag-url.example.com/exec');
    expect(config.secret).toBe('flag-secret');
  });

  it('falls back to environment variables when no flags', () => {
    process.env.GPROXY_URL = 'https://env-url.example.com/exec';
    process.env.GPROXY_SECRET = 'env-secret';

    const config = loadConfig({});

    expect(config.proxy_url).toBe('https://env-url.example.com/exec');
    expect(config.secret).toBe('env-secret');
  });

  it('throws when proxy URL is missing', () => {
    process.env.GPROXY_SECRET = 'some-secret';

    expect(() => loadConfig({})).toThrow('No proxy URL configured');
  });

  it('throws when secret is missing', () => {
    process.env.GPROXY_URL = 'https://example.com/exec';

    expect(() => loadConfig({})).toThrow('No shared secret configured');
  });

  it('throws when URL does not start with https://', () => {
    expect(() =>
      loadConfig({
        proxyUrl: 'http://example.com/exec',
        secret: 'test-secret',
      })
    ).toThrow('Proxy URL must start with https://');
  });

  it('accepts valid https:// URL', () => {
    const config = loadConfig({
      proxyUrl: 'https://script.google.com/macros/s/abc123/exec',
      secret: 'my-secret',
    });

    expect(config.proxy_url).toBe('https://script.google.com/macros/s/abc123/exec');
  });

  it('flags take priority over env vars', () => {
    process.env.GPROXY_URL = 'https://env.example.com/exec';
    process.env.GPROXY_SECRET = 'env-secret';

    const config = loadConfig({
      proxyUrl: 'https://flag.example.com/exec',
      // secret not provided as flag — should fall back to env
    });

    expect(config.proxy_url).toBe('https://flag.example.com/exec');
    expect(config.secret).toBe('env-secret');
  });

  it('error message for missing URL suggests gproxy setup', () => {
    process.env.GPROXY_SECRET = 'some-secret';

    try {
      loadConfig({});
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e.message).toContain('gproxy setup');
    }
  });

  it('error message for missing secret suggests gproxy setup', () => {
    process.env.GPROXY_URL = 'https://example.com/exec';

    try {
      loadConfig({});
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e.message).toContain('gproxy setup');
    }
  });

  it('error message for bad URL includes the offending URL', () => {
    try {
      loadConfig({
        proxyUrl: 'ftp://example.com/exec',
        secret: 'test',
      });
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e.message).toContain('ftp://example.com/exec');
    }
  });
});
