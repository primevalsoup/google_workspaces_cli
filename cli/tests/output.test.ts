import { describe, it, expect } from 'vitest';
import { formatOutput, formatError, getExitCode } from '../src/output.js';
import type { CommandResult } from '../src/types.js';

describe('formatOutput', () => {
  describe('JSON mode', () => {
    it('outputs valid JSON for success result with data', () => {
      const result: CommandResult = { ok: true, data: { threads: [{ id: '1' }], count: 1 } };
      const output = formatOutput(result, 'json', 'gmail', 'search');
      const parsed = JSON.parse(output);
      expect(parsed.threads).toHaveLength(1);
      expect(parsed.count).toBe(1);
    });

    it('outputs formatted JSON (pretty-printed)', () => {
      const result: CommandResult = { ok: true, data: { key: 'value' } };
      const output = formatOutput(result, 'json', 'gmail', 'search');
      expect(output).toContain('\n');
      expect(output).toContain('  ');
    });

    it('outputs entire result when data is missing', () => {
      const result: CommandResult = { ok: true };
      const output = formatOutput(result, 'json', 'gmail', 'search');
      const parsed = JSON.parse(output);
      expect(parsed.ok).toBe(true);
    });

    it('returns empty string for error results', () => {
      const result: CommandResult = {
        ok: false,
        error: { code: 'AUTH_FAILED', message: 'Bad token', retryable: false },
      };
      const output = formatOutput(result, 'json', 'gmail', 'search');
      expect(output).toBe('');
    });
  });

  describe('human mode', () => {
    it('formats gmail threads with bold and dim', () => {
      const result: CommandResult = {
        ok: true,
        data: {
          threads: [
            { from: 'Alice', subject: 'Hello', date: '2026-01-01', snippet: 'Hi there' },
          ],
        },
      };
      const output = formatOutput(result, 'human', 'gmail', 'search');
      expect(output).toContain('Alice');
      expect(output).toContain('Hello');
    });

    it('formats calendar events', () => {
      const result: CommandResult = {
        ok: true,
        data: {
          events: [
            { summary: 'Meeting', start: '2026-02-10T10:00:00Z', location: 'Room A' },
          ],
        },
      };
      const output = formatOutput(result, 'human', 'calendar', 'list');
      expect(output).toContain('Meeting');
      expect(output).toContain('Room A');
    });

    it('formats drive files', () => {
      const result: CommandResult = {
        ok: true,
        data: {
          files: [
            { name: 'report.pdf', mimeType: 'application/pdf', size: '1048576' },
          ],
        },
      };
      const output = formatOutput(result, 'human', 'drive', 'list');
      expect(output).toContain('report.pdf');
      expect(output).toContain('1.0 MB');
    });

    it('formats tasks list', () => {
      const result: CommandResult = {
        ok: true,
        data: {
          tasks: [
            { title: 'Buy groceries', completed: false, due: '2026-02-15' },
            { title: 'Done task', completed: true },
          ],
        },
      };
      const output = formatOutput(result, 'human', 'tasks', 'list');
      expect(output).toContain('Buy groceries');
      expect(output).toContain('2026-02-15');
    });

    it('formats contacts list', () => {
      const result: CommandResult = {
        ok: true,
        data: {
          contacts: [
            { name: 'John Doe', email: 'john@example.com', phone: '+1234567890' },
          ],
        },
      };
      const output = formatOutput(result, 'human', 'contacts', 'list');
      expect(output).toContain('John Doe');
      expect(output).toContain('john@example.com');
    });

    it('falls back to JSON for unknown services', () => {
      const result: CommandResult = {
        ok: true,
        data: { custom: 'data' },
      };
      const output = formatOutput(result, 'human', 'unknown', 'action');
      const parsed = JSON.parse(output);
      expect(parsed.custom).toBe('data');
    });

    it('returns empty string when data is undefined', () => {
      const result: CommandResult = { ok: true };
      const output = formatOutput(result, 'human', 'gmail', 'search');
      expect(output).toBe('');
    });
  });

  describe('plain mode', () => {
    it('strips ANSI escape codes', () => {
      const result: CommandResult = {
        ok: true,
        data: {
          threads: [
            { from: 'Alice', subject: 'Test', date: '2026-01-01', snippet: 'Hi' },
          ],
        },
      };
      const output = formatOutput(result, 'plain', 'gmail', 'search');
      // ANSI codes look like \x1b[...m
      expect(output).not.toMatch(/\x1b\[/);
      expect(output).toContain('Alice');
      expect(output).toContain('Test');
    });
  });
});

describe('formatError', () => {
  it('formats error with code and message', () => {
    const output = formatError({ code: 'AUTH_FAILED', message: 'Invalid token' });
    // Should contain both code and message (may have ANSI codes)
    expect(output).toContain('AUTH_FAILED');
    expect(output).toContain('Invalid token');
  });
});

describe('getExitCode', () => {
  it('returns 0 for success', () => {
    expect(getExitCode({ ok: true, data: {} })).toBe(0);
  });

  it('returns 1 for generic error', () => {
    expect(getExitCode({
      ok: false,
      error: { code: 'SERVICE_ERROR', message: 'fail', retryable: true },
    })).toBe(1);
  });

  it('returns 2 for AUTH_FAILED', () => {
    expect(getExitCode({
      ok: false,
      error: { code: 'AUTH_FAILED', message: 'bad token', retryable: false },
    })).toBe(2);
  });

  it('returns 2 for IP_BLOCKED', () => {
    expect(getExitCode({
      ok: false,
      error: { code: 'IP_BLOCKED', message: 'blocked', retryable: false },
    })).toBe(2);
  });

  it('returns 3 for NOT_FOUND', () => {
    expect(getExitCode({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'not found', retryable: false },
    })).toBe(3);
  });

  it('returns 4 for QUOTA_EXCEEDED', () => {
    expect(getExitCode({
      ok: false,
      error: { code: 'QUOTA_EXCEEDED', message: 'quota', retryable: true },
    })).toBe(4);
  });

  it('returns 1 when no error object', () => {
    expect(getExitCode({ ok: false })).toBe(1);
  });
});
