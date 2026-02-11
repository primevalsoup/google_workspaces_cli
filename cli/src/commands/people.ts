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
  const result = await executeCommand('people', action, params, config, {
    timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
    maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
    verbose: globalOpts.verbose,
  });
  printResult(result, getOutputMode(globalOpts), 'people', action);
  process.exitCode = getExitCode(result);
}

export function registerPeopleCommands(program: Command): void {
  const people = program
    .command('people')
    .description('Directory people search (Workspace)');

  // --- Get ---
  people
    .command('get <resourceName>')
    .description('Get a person by resource name')
    .action(async (resourceName: string, _opts: any, cmd: Command) => {
      await run(cmd, 'get', { resourceName });
    });

  // --- Search ---
  people
    .command('search <query>')
    .description('Search the organization directory')
    .option('--max <n>', 'Maximum results', '10')
    .action(async (query: string, opts: any, cmd: Command) => {
      await run(cmd, 'search', {
        query,
        max: Number(opts.max),
      });
    });
}
