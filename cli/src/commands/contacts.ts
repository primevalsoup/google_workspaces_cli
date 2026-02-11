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
  const result = await executeCommand('contacts', action, params, config, {
    timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
    maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
    verbose: globalOpts.verbose,
  });
  printResult(result, getOutputMode(globalOpts), 'contacts', action);
  process.exitCode = getExitCode(result);
}

export function registerContactsCommands(program: Command): void {
  const contacts = program
    .command('contacts')
    .description('Google Contacts operations');

  // --- List ---
  contacts
    .command('list')
    .description('List contacts')
    .option('--max <n>', 'Maximum results', '25')
    .option('--sort <order>', 'Sort order (LAST_MODIFIED_DESCENDING, FIRST_NAME_ASCENDING, LAST_NAME_ASCENDING)', 'LAST_MODIFIED_DESCENDING')
    .option('--page-token <token>', 'Pagination token')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'list', {
        max: Number(opts.max),
        sortOrder: opts.sort,
        pageToken: opts.pageToken,
      });
    });

  // --- Search ---
  contacts
    .command('search <query>')
    .description('Search contacts')
    .option('--max <n>', 'Maximum results', '25')
    .action(async (query: string, opts: any, cmd: Command) => {
      await run(cmd, 'search', {
        query,
        max: Number(opts.max),
      });
    });

  // --- Get ---
  contacts
    .command('get <resourceName>')
    .description('Get a contact by resource name (e.g., people/c12345)')
    .action(async (resourceName: string, _opts: any, cmd: Command) => {
      await run(cmd, 'get', { resourceName });
    });

  // --- Create ---
  contacts
    .command('create')
    .description('Create a new contact')
    .option('--given-name <name>', 'First name')
    .option('--family-name <name>', 'Last name')
    .option('--email <address>', 'Email address')
    .option('--email-type <type>', 'Email type (home, work, other)', 'home')
    .option('--phone <number>', 'Phone number')
    .option('--phone-type <type>', 'Phone type (mobile, home, work)', 'mobile')
    .option('--organization <name>', 'Organization name')
    .option('--job-title <title>', 'Job title')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'create', {
        givenName: opts.givenName,
        familyName: opts.familyName,
        email: opts.email,
        emailType: opts.emailType,
        phone: opts.phone,
        phoneType: opts.phoneType,
        organization: opts.organization,
        jobTitle: opts.jobTitle,
      });
    });

  // --- Update ---
  contacts
    .command('update <resourceName>')
    .description('Update an existing contact')
    .option('--given-name <name>', 'First name')
    .option('--family-name <name>', 'Last name')
    .option('--email <address>', 'Email address')
    .option('--email-type <type>', 'Email type')
    .option('--phone <number>', 'Phone number')
    .option('--phone-type <type>', 'Phone type')
    .option('--organization <name>', 'Organization')
    .option('--job-title <title>', 'Job title')
    .action(async (resourceName: string, opts: any, cmd: Command) => {
      await run(cmd, 'update', {
        resourceName,
        givenName: opts.givenName,
        familyName: opts.familyName,
        email: opts.email,
        emailType: opts.emailType,
        phone: opts.phone,
        phoneType: opts.phoneType,
        organization: opts.organization,
        jobTitle: opts.jobTitle,
      });
    });

  // --- Delete ---
  contacts
    .command('delete <resourceName>')
    .description('Delete a contact')
    .action(async (resourceName: string, _opts: any, cmd: Command) => {
      await run(cmd, 'delete', { resourceName });
    });

  // --- Other contacts ---
  const other = contacts
    .command('other')
    .description('Other contacts (auto-saved from interactions)');

  other
    .command('list')
    .description('List other contacts')
    .option('--max <n>', 'Maximum results', '25')
    .option('--page-token <token>', 'Pagination token')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'other.list', {
        max: Number(opts.max),
        pageToken: opts.pageToken,
      });
    });

  other
    .command('search <query>')
    .description('Search other contacts')
    .option('--max <n>', 'Maximum results', '25')
    .action(async (query: string, opts: any, cmd: Command) => {
      await run(cmd, 'other.search', {
        query,
        max: Number(opts.max),
      });
    });
}
