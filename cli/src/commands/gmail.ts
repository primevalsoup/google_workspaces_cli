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
  const result = await executeCommand('gmail', action, params, config, {
    timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
    maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
    verbose: globalOpts.verbose,
  });
  printResult(result, getOutputMode(globalOpts), 'gmail', action);
  process.exitCode = getExitCode(result);
}

export function registerGmailCommands(program: Command): void {
  const gmail = program
    .command('gmail')
    .description('Gmail operations');

  // --- Search ---
  gmail
    .command('search <query>')
    .description('Search Gmail threads')
    .option('--max <n>', 'Maximum results', '20')
    .option('--include-body', 'Include message body in results')
    .action(async (query: string, opts: any, cmd: Command) => {
      await run(cmd, 'search', {
        query,
        max: Number(opts.max),
        includeBody: opts.includeBody || false,
      });
    });

  gmail
    .command('message-search <query>')
    .description('Search Gmail messages')
    .option('--max <n>', 'Maximum results', '20')
    .option('--include-body', 'Include message body')
    .action(async (query: string, opts: any, cmd: Command) => {
      await run(cmd, 'messageSearch', {
        query,
        max: Number(opts.max),
        includeBody: opts.includeBody || false,
      });
    });

  // --- Get / Read ---
  gmail
    .command('get <threadId>')
    .description('Get a thread by ID')
    .action(async (threadId: string, _opts: any, cmd: Command) => {
      await run(cmd, 'get', { threadId });
    });

  gmail
    .command('read <threadId>')
    .description('Read a thread (alias for get)')
    .action(async (threadId: string, _opts: any, cmd: Command) => {
      await run(cmd, 'read', { threadId });
    });

  // --- Send ---
  gmail
    .command('send <to>')
    .description('Send an email')
    .requiredOption('--subject <text>', 'Email subject')
    .option('--body <text>', 'Plain text body')
    .option('--html <text>', 'HTML body')
    .option('--cc <addresses>', 'CC recipients (comma-separated)')
    .option('--bcc <addresses>', 'BCC recipients (comma-separated)')
    .option('--reply-to <threadId>', 'Reply to thread')
    .action(async (to: string, opts: any, cmd: Command) => {
      await run(cmd, 'send', {
        to,
        subject: opts.subject,
        body: opts.body,
        bodyHtml: opts.html,
        cc: opts.cc,
        bcc: opts.bcc,
        replyToThreadId: opts.replyTo,
      });
    });

  // --- Labels ---
  const labels = gmail
    .command('labels')
    .description('Label operations');

  labels
    .command('list')
    .description('List all labels')
    .action(async (_opts: any, cmd: Command) => {
      await run(cmd, 'labels.list', {});
    });

  labels
    .command('create <name>')
    .description('Create a label')
    .action(async (name: string, _opts: any, cmd: Command) => {
      await run(cmd, 'labels.create', { name });
    });

  labels
    .command('delete <name>')
    .description('Delete a label')
    .action(async (name: string, _opts: any, cmd: Command) => {
      await run(cmd, 'labels.delete', { name });
    });

  // --- Thread modify ---
  gmail
    .command('modify <threadId>')
    .description('Add/remove labels from a thread')
    .option('--add-labels <labels>', 'Labels to add (comma-separated)')
    .option('--remove-labels <labels>', 'Labels to remove (comma-separated)')
    .action(async (threadId: string, opts: any, cmd: Command) => {
      await run(cmd, 'thread.modify', {
        threadId,
        addLabels: opts.addLabels ? opts.addLabels.split(',') : [],
        removeLabels: opts.removeLabels ? opts.removeLabels.split(',') : [],
      });
    });

  // --- Drafts ---
  const drafts = gmail
    .command('drafts')
    .description('Draft operations');

  drafts
    .command('list')
    .description('List drafts')
    .option('--max <n>', 'Maximum results', '20')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'drafts.list', { max: Number(opts.max) });
    });

  drafts
    .command('create')
    .description('Create a draft')
    .requiredOption('--to <address>', 'Recipient')
    .requiredOption('--subject <text>', 'Subject')
    .option('--body <text>', 'Plain text body')
    .option('--html <text>', 'HTML body')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'drafts.create', {
        to: opts.to,
        subject: opts.subject,
        body: opts.body,
        bodyHtml: opts.html,
      });
    });

  drafts
    .command('update <draftId>')
    .description('Update a draft')
    .option('--to <address>', 'Recipient')
    .option('--subject <text>', 'Subject')
    .option('--body <text>', 'Plain text body')
    .action(async (draftId: string, opts: any, cmd: Command) => {
      await run(cmd, 'drafts.update', {
        draftId,
        to: opts.to,
        subject: opts.subject,
        body: opts.body,
      });
    });

  drafts
    .command('send <draftId>')
    .description('Send a draft')
    .action(async (draftId: string, _opts: any, cmd: Command) => {
      await run(cmd, 'drafts.send', { draftId });
    });

  // --- Attachments ---
  gmail
    .command('attachment <messageId> <attachmentId>')
    .description('Download an attachment (base64)')
    .action(async (messageId: string, attachmentId: string, _opts: any, cmd: Command) => {
      await run(cmd, 'attachments.download', { messageId, attachmentId });
    });

  // --- Settings ---
  const settings = gmail
    .command('settings')
    .description('Gmail settings');

  settings
    .command('vacation')
    .description('Get or set vacation responder')
    .option('--enable', 'Enable vacation responder')
    .option('--disable', 'Disable vacation responder')
    .option('--subject <text>', 'Vacation subject')
    .option('--message <text>', 'Vacation message')
    .option('--start <date>', 'Start date (YYYY-MM-DD)')
    .option('--end <date>', 'End date (YYYY-MM-DD)')
    .action(async (opts: any, cmd: Command) => {
      if (opts.enable || opts.disable || opts.subject || opts.message) {
        await run(cmd, 'settings.vacation', {
          action: 'set',
          enabled: opts.enable ? true : opts.disable ? false : undefined,
          subject: opts.subject,
          message: opts.message,
          startDate: opts.start,
          endDate: opts.end,
        });
      } else {
        await run(cmd, 'settings.vacation', { action: 'get' });
      }
    });

  const filters = settings
    .command('filters')
    .description('Gmail filters');

  filters
    .command('list')
    .description('List all filters')
    .action(async (_opts: any, cmd: Command) => {
      await run(cmd, 'settings.filters.list', {});
    });

  filters
    .command('create')
    .description('Create a filter')
    .requiredOption('--from <address>', 'From address criteria')
    .option('--label <name>', 'Apply label')
    .option('--archive', 'Archive matching messages')
    .option('--star', 'Star matching messages')
    .option('--mark-read', 'Mark matching messages as read')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'settings.filters.create', {
        from: opts.from,
        label: opts.label,
        archive: opts.archive || false,
        star: opts.star || false,
        markRead: opts.markRead || false,
      });
    });

  filters
    .command('delete <filterId>')
    .description('Delete a filter')
    .action(async (filterId: string, _opts: any, cmd: Command) => {
      await run(cmd, 'settings.filters.delete', { filterId });
    });

  settings
    .command('forwarding')
    .description('Get or set forwarding')
    .option('--address <email>', 'Forwarding address')
    .option('--enable', 'Enable forwarding')
    .option('--disable', 'Disable forwarding')
    .action(async (opts: any, cmd: Command) => {
      if (opts.address || opts.enable || opts.disable) {
        await run(cmd, 'settings.forwarding', {
          action: 'set',
          address: opts.address,
          enabled: opts.enable ? true : opts.disable ? false : undefined,
        });
      } else {
        await run(cmd, 'settings.forwarding', { action: 'get' });
      }
    });

  settings
    .command('send-as')
    .description('List send-as aliases')
    .action(async (_opts: any, cmd: Command) => {
      await run(cmd, 'settings.sendAs', {});
    });

  const delegates = settings
    .command('delegates')
    .description('Manage delegates');

  delegates
    .command('list')
    .description('List delegates')
    .action(async (_opts: any, cmd: Command) => {
      await run(cmd, 'settings.delegates', { action: 'list' });
    });

  delegates
    .command('add <email>')
    .description('Add a delegate')
    .action(async (email: string, _opts: any, cmd: Command) => {
      await run(cmd, 'settings.delegates', { action: 'add', email });
    });

  delegates
    .command('remove <email>')
    .description('Remove a delegate')
    .action(async (email: string, _opts: any, cmd: Command) => {
      await run(cmd, 'settings.delegates', { action: 'remove', email });
    });
}
