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
  const result = await executeCommand('groups', action, params, config, {
    timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
    maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
    verbose: globalOpts.verbose,
  });
  printResult(result, getOutputMode(globalOpts), 'groups', action);
  process.exitCode = getExitCode(result);
}

export function registerGroupsCommands(program: Command): void {
  const groups = program
    .command('groups')
    .description('Google Groups operations (Workspace)');

  // --- List ---
  groups
    .command('list')
    .description('List groups the user belongs to')
    .option('--domain <domain>', 'Filter by domain')
    .option('--user <email>', 'List groups for specific user')
    .option('--max <n>', 'Maximum results', '25')
    .option('--page-token <token>', 'Pagination token')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'list', {
        domain: opts.domain,
        userKey: opts.user,
        max: Number(opts.max),
        pageToken: opts.pageToken,
      });
    });

  // --- Members ---
  groups
    .command('members <groupKey>')
    .description('List members of a group')
    .option('--roles <roles>', 'Filter by roles (OWNER, MANAGER, MEMBER)')
    .option('--max <n>', 'Maximum results', '50')
    .option('--page-token <token>', 'Pagination token')
    .action(async (groupKey: string, opts: any, cmd: Command) => {
      await run(cmd, 'members', {
        groupKey,
        roles: opts.roles,
        max: Number(opts.max),
        pageToken: opts.pageToken,
      });
    });
}
