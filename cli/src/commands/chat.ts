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
  const result = await executeCommand('chat', action, params, config, {
    timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
    maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
    verbose: globalOpts.verbose,
  });
  printResult(result, getOutputMode(globalOpts), 'chat', action);
  process.exitCode = getExitCode(result);
}

export function registerChatCommands(program: Command): void {
  const chat = program
    .command('chat')
    .description('Google Chat operations (Workspace)');

  // --- Spaces ---
  const spaces = chat
    .command('spaces')
    .description('Chat space operations');

  spaces
    .command('list')
    .description('List Chat spaces')
    .option('--max <n>', 'Maximum results', '25')
    .option('--filter <query>', 'Filter spaces')
    .option('--page-token <token>', 'Pagination token')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'spaces.list', {
        max: Number(opts.max),
        filter: opts.filter,
        pageToken: opts.pageToken,
      });
    });

  spaces
    .command('find <name>')
    .description('Find a space by name')
    .action(async (name: string, _opts: any, cmd: Command) => {
      await run(cmd, 'spaces.find', { name });
    });

  spaces
    .command('create <displayName>')
    .description('Create a new space')
    .option('--type <type>', 'Space type (SPACE, GROUP_CHAT)', 'SPACE')
    .action(async (displayName: string, opts: any, cmd: Command) => {
      await run(cmd, 'spaces.create', {
        displayName,
        spaceType: opts.type,
      });
    });

  // --- Messages ---
  const messages = chat
    .command('messages')
    .description('Chat message operations');

  messages
    .command('list <spaceName>')
    .description('List messages in a space')
    .option('--max <n>', 'Maximum results', '25')
    .option('--filter <query>', 'Filter messages')
    .option('--order-by <field>', 'Sort order')
    .option('--page-token <token>', 'Pagination token')
    .action(async (spaceName: string, opts: any, cmd: Command) => {
      await run(cmd, 'messages.list', {
        spaceName,
        max: Number(opts.max),
        filter: opts.filter,
        orderBy: opts.orderBy,
        pageToken: opts.pageToken,
      });
    });

  messages
    .command('send <spaceName> <text>')
    .description('Send a message to a space')
    .option('--thread <key>', 'Thread key for threaded replies')
    .action(async (spaceName: string, text: string, opts: any, cmd: Command) => {
      await run(cmd, 'messages.send', {
        spaceName,
        text,
        threadKey: opts.thread,
      });
    });

  messages
    .command('dm <userId> <text>')
    .description('Send a direct message')
    .action(async (userId: string, text: string, _opts: any, cmd: Command) => {
      await run(cmd, 'messages.dm', { userId, text });
    });
}
