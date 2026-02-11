import fs from 'node:fs';
import path from 'node:path';
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
  const result = await executeCommand('drive', action, params, config, {
    timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
    maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
    verbose: globalOpts.verbose,
  });
  printResult(result, getOutputMode(globalOpts), 'drive', action);
  process.exitCode = getExitCode(result);
}

const FIFTY_MB = 50 * 1024 * 1024;

export function registerDriveCommands(program: Command): void {
  const drive = program
    .command('drive')
    .description('Google Drive operations');

  // --- List ---
  drive
    .command('list')
    .description('List files')
    .option('--query <q>', 'Drive search query')
    .option('--folder <id>', 'List files in folder')
    .option('--type <mimeType>', 'Filter by MIME type')
    .option('--max <n>', 'Maximum results', '25')
    .option('--order-by <field>', 'Sort order (e.g., modifiedDate desc)')
    .option('--page-token <token>', 'Pagination token')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'list', {
        query: opts.query,
        folderId: opts.folder,
        mimeType: opts.type,
        max: Number(opts.max),
        orderBy: opts.orderBy,
        pageToken: opts.pageToken,
      });
    });

  // --- Search ---
  drive
    .command('search <query>')
    .description('Search files by query string')
    .option('--max <n>', 'Maximum results', '25')
    .option('--order-by <field>', 'Sort order')
    .option('--page-token <token>', 'Pagination token')
    .action(async (query: string, opts: any, cmd: Command) => {
      await run(cmd, 'search', {
        query,
        max: Number(opts.max),
        orderBy: opts.orderBy,
        pageToken: opts.pageToken,
      });
    });

  // --- Get ---
  drive
    .command('get <fileId>')
    .description('Get file metadata')
    .action(async (fileId: string, _opts: any, cmd: Command) => {
      await run(cmd, 'get', { fileId });
    });

  // --- Download ---
  drive
    .command('download <fileId>')
    .description('Download file content')
    .option('--out <path>', 'Output file path (default: stdout)')
    .option('--export-type <mimeType>', 'Export MIME type for Google files')
    .action(async (fileId: string, opts: any, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const config = loadConfig(globalOpts);
      const result = await executeCommand('drive', 'download', {
        fileId,
        exportMimeType: opts.exportType,
      }, config, {
        timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
        maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
        verbose: globalOpts.verbose,
      });

      if (result.ok && result.data) {
        const { content, encoding, name } = result.data;
        const outPath = opts.out || name || 'download';

        if (encoding === 'base64') {
          const buffer = Buffer.from(content, 'base64');
          if (opts.out) {
            fs.writeFileSync(outPath, buffer);
            process.stderr.write(`Downloaded to ${outPath} (${buffer.length} bytes)\n`);
          } else {
            process.stdout.write(buffer);
          }
        } else {
          if (opts.out) {
            fs.writeFileSync(outPath, content, 'utf-8');
            process.stderr.write(`Downloaded to ${outPath}\n`);
          } else {
            process.stdout.write(content);
          }
        }
        process.exitCode = 0;
      } else {
        printResult(result, getOutputMode(globalOpts), 'drive', 'download');
        process.exitCode = getExitCode(result);
      }
    });

  // --- Upload ---
  drive
    .command('upload <filePath>')
    .description('Upload a file to Drive')
    .option('--name <name>', 'File name in Drive (default: local filename)')
    .option('--mime-type <type>', 'MIME type')
    .option('--folder <id>', 'Destination folder ID')
    .option('--description <text>', 'File description')
    .option('--convert', 'Convert to Google format')
    .action(async (filePath: string, opts: any, cmd: Command) => {
      if (!fs.existsSync(filePath)) {
        process.stderr.write(`Error: File not found: ${filePath}\n`);
        process.exitCode = 1;
        return;
      }

      const stats = fs.statSync(filePath);
      if (stats.size > FIFTY_MB) {
        process.stderr.write(
          `Warning: File is ${(stats.size / (1024 * 1024)).toFixed(1)} MB. ` +
          `Large files may fail due to Apps Script limits.\n`
        );
      }

      const content = fs.readFileSync(filePath);
      const base64 = content.toString('base64');
      const name = opts.name || path.basename(filePath);

      await run(cmd, 'upload', {
        name,
        content: base64,
        encoding: 'base64',
        mimeType: opts.mimeType,
        folderId: opts.folder,
        description: opts.description,
        convert: opts.convert || false,
      });
    });

  // --- Copy ---
  drive
    .command('copy <fileId>')
    .description('Copy a file')
    .option('--name <name>', 'New file name')
    .option('--folder <id>', 'Destination folder ID')
    .action(async (fileId: string, opts: any, cmd: Command) => {
      await run(cmd, 'copy', {
        fileId,
        name: opts.name,
        folderId: opts.folder,
      });
    });

  // --- Delete ---
  drive
    .command('delete <fileId>')
    .description('Move file to trash')
    .action(async (fileId: string, _opts: any, cmd: Command) => {
      await run(cmd, 'delete', { fileId });
    });

  // --- Export ---
  drive
    .command('export <fileId>')
    .description('Export Google Doc/Sheet/Slide to format')
    .requiredOption('--format <fmt>', 'Export format (pdf, docx, xlsx, pptx, csv, txt)')
    .option('--out <path>', 'Output file path')
    .action(async (fileId: string, opts: any, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const config = loadConfig(globalOpts);
      const result = await executeCommand('drive', 'export', {
        fileId,
        format: opts.format,
      }, config, {
        timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
        maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
        verbose: globalOpts.verbose,
      });

      if (result.ok && result.data) {
        const { content, encoding } = result.data;
        const outPath = opts.out || `export.${opts.format}`;

        if (encoding === 'base64') {
          const buffer = Buffer.from(content, 'base64');
          if (opts.out) {
            fs.writeFileSync(outPath, buffer);
            process.stderr.write(`Exported to ${outPath} (${buffer.length} bytes)\n`);
          } else {
            process.stdout.write(buffer);
          }
        } else {
          if (opts.out) {
            fs.writeFileSync(outPath, content, 'utf-8');
            process.stderr.write(`Exported to ${outPath}\n`);
          } else {
            process.stdout.write(content);
          }
        }
        process.exitCode = 0;
      } else {
        printResult(result, getOutputMode(globalOpts), 'drive', 'export');
        process.exitCode = getExitCode(result);
      }
    });

  // --- Permissions ---
  const perms = drive
    .command('permissions')
    .description('File permission operations');

  perms
    .command('list <fileId>')
    .description('List file permissions')
    .action(async (fileId: string, _opts: any, cmd: Command) => {
      await run(cmd, 'permissions.list', { fileId });
    });

  perms
    .command('create <fileId>')
    .description('Share a file')
    .requiredOption('--role <role>', 'Permission role (reader, writer, commenter, owner)')
    .requiredOption('--type <type>', 'Permission type (user, group, domain, anyone)')
    .option('--email <address>', 'Email address (for user/group type)')
    .option('--domain <domain>', 'Domain (for domain type)')
    .option('--no-notify', 'Do not send notification email')
    .action(async (fileId: string, opts: any, cmd: Command) => {
      await run(cmd, 'permissions.create', {
        fileId,
        role: opts.role,
        type: opts.type,
        emailAddress: opts.email,
        domain: opts.domain,
        sendNotificationEmails: opts.notify !== false ? true : false,
      });
    });

  perms
    .command('delete <fileId> <permissionId>')
    .description('Remove a file permission')
    .action(async (fileId: string, permissionId: string, _opts: any, cmd: Command) => {
      await run(cmd, 'permissions.delete', { fileId, permissionId });
    });

  // --- Mkdir ---
  drive
    .command('mkdir <name>')
    .description('Create a folder')
    .option('--parent <id>', 'Parent folder ID')
    .action(async (name: string, opts: any, cmd: Command) => {
      await run(cmd, 'mkdir', { name, parentId: opts.parent });
    });

  // --- Shared drives ---
  drive
    .command('drives')
    .description('List shared drives')
    .option('--max <n>', 'Maximum results', '25')
    .option('--page-token <token>', 'Pagination token')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'drives.list', {
        max: Number(opts.max),
        pageToken: opts.pageToken,
      });
    });

  // --- Comments ---
  drive
    .command('comments <fileId>')
    .description('List comments on a file')
    .option('--max <n>', 'Maximum results', '25')
    .action(async (fileId: string, opts: any, cmd: Command) => {
      await run(cmd, 'comments.list', {
        fileId,
        max: Number(opts.max),
      });
    });
}
