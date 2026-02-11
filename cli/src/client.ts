import type { CommandResult, GProxyConfig } from './types.js';
import { createToken } from './jwt.js';

const DEFAULT_TIMEOUT = 330_000; // 5.5 minutes
const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY = 1000;
const MAX_DELAY = 30_000;
const JITTER_MAX = 500;

const NON_RETRYABLE_CODES = new Set([
  'AUTH_FAILED',
  'IP_BLOCKED',
  'INVALID_REQUEST',
  'NOT_FOUND',
]);

interface ExecuteOptions {
  timeout?: number;
  maxRetries?: number;
  verbose?: boolean;
}

export async function executeCommand(
  service: string,
  action: string,
  params: Record<string, any>,
  config: GProxyConfig,
  options?: ExecuteOptions
): Promise<CommandResult> {
  const timeout = options?.timeout || DEFAULT_TIMEOUT;
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const verbose = options?.verbose || false;

  let lastError: CommandResult | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(BASE_DELAY * Math.pow(2, attempt - 1), MAX_DELAY);
      const jitter = Math.random() * JITTER_MAX;
      const waitMs = delay + jitter;
      if (verbose) {
        process.stderr.write(`Retry ${attempt}/${maxRetries} in ${Math.round(waitMs)}ms...\n`);
      }
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    const jwt = createToken(config.secret);
    const body = JSON.stringify({ jwt, service, action, params });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      if (verbose) {
        process.stderr.write(`→ POST ${config.proxy_url}\n`);
        process.stderr.write(`  service=${service} action=${action}\n`);
        process.stderr.write(`  params=${JSON.stringify(params)}\n`);
      }

      const response = await fetch(config.proxy_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const result = (await response.json()) as CommandResult;

      if (verbose) {
        process.stderr.write(`← ${response.status} ${JSON.stringify(result).slice(0, 200)}\n`);
      }

      if (result.ok) {
        return result;
      }

      // Non-retryable error
      if (result.error && NON_RETRYABLE_CODES.has(result.error.code)) {
        return result;
      }

      // Retryable error — continue loop
      if (result.error?.retryable || response.status >= 500) {
        lastError = result;
        continue;
      }

      // Unknown non-retryable error
      return result;
    } catch (err: any) {
      clearTimeout(timer);

      if (verbose) {
        process.stderr.write(`← Error: ${err.message}\n`);
      }

      const isTimeout = err.name === 'AbortError';
      lastError = {
        ok: false,
        error: {
          code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: isTimeout
            ? `Request timed out after ${timeout}ms`
            : `Network error: ${err.message}`,
          retryable: true,
        },
      };

      // Retryable network/timeout errors — continue loop
      continue;
    }
  }

  // All retries exhausted
  return lastError || {
    ok: false,
    error: {
      code: 'MAX_RETRIES',
      message: `Failed after ${maxRetries + 1} attempts`,
      retryable: false,
    },
  };
}
