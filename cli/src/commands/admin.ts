import { Command } from 'commander';
import { executeCommand } from '../client.js';
import { loadConfig } from '../config.js';
import { printResult, getExitCode } from '../output.js';
import type { GlobalOptions, OutputMode } from '../types.js';

function getOutputMode(opts: GlobalOptions): OutputMode {
  if (opts.json) return 'json';
  if (opts.plain) return 'plain';
  return 'human';
}

function getGlobalOpts(cmd: Command): GlobalOptions {
  let root = cmd;
  while (root.parent) root = root.parent;
  return root.opts() as GlobalOptions;
}

async function run(
  cmd: Command,
  action: string,
  params: Record<string, any>
): Promise<void> {
  const globalOpts = getGlobalOpts(cmd);
  const config = loadConfig(globalOpts);
  const result = await executeCommand('admin', action, params, config, {
    timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
    maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
    verbose: globalOpts.verbose,
  });
  printResult(result, getOutputMode(globalOpts), 'admin', action);
  process.exitCode = getExitCode(result);
}

export function registerAdminCommands(program: Command): void {
  const admin = program
    .command('admin')
    .description('Proxy administration');

  // --- Health ---
  admin
    .command('health')
    .description('Check proxy health status')
    .action(async (_opts: any, cmd: Command) => {
      await run(cmd, 'health', {});
    });

  // --- Config ---
  const config = admin
    .command('config')
    .description('Proxy configuration management');

  config
    .command('get')
    .description('Get all proxy configuration values')
    .action(async (_opts: any, cmd: Command) => {
      await run(cmd, 'config.get', {});
    });

  config
    .command('set <key> <value>')
    .description('Set a proxy configuration value')
    .action(async (key: string, value: string, _opts: any, cmd: Command) => {
      await run(cmd, 'config.set', { key, value });
    });

  // --- Logs ---
  const log = admin
    .command('log')
    .description('Log management');

  log
    .command('status')
    .description('Get log sheet status')
    .action(async (_opts: any, cmd: Command) => {
      await run(cmd, 'log.status', {});
    });

  log
    .command('clear')
    .description('Clear all log entries')
    .action(async (_opts: any, cmd: Command) => {
      await run(cmd, 'log.clear', {});
    });

  // --- IP allowlist ---
  const ip = admin
    .command('ip')
    .description('IP allowlist management');

  ip
    .command('list')
    .description('List allowed IP addresses')
    .action(async (_opts: any, cmd: Command) => {
      await run(cmd, 'ip.list', {});
    });

  ip
    .command('add <address>')
    .description('Add an IP address to the allowlist')
    .action(async (address: string, _opts: any, cmd: Command) => {
      await run(cmd, 'ip.add', { ip: address });
    });

  ip
    .command('remove <address>')
    .description('Remove an IP address from the allowlist')
    .action(async (address: string, _opts: any, cmd: Command) => {
      await run(cmd, 'ip.remove', { ip: address });
    });
}
