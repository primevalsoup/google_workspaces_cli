import fs from 'node:fs';
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
  const result = await executeCommand('slides', action, params, config, {
    timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
    maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
    verbose: globalOpts.verbose,
  });
  printResult(result, getOutputMode(globalOpts), 'slides', action);
  process.exitCode = getExitCode(result);
}

export function registerSlidesCommands(program: Command): void {
  const slides = program
    .command('slides')
    .description('Google Slides operations');

  // --- Get metadata ---
  slides
    .command('get <presentationId>')
    .description('Get presentation metadata')
    .action(async (presentationId: string, _opts: any, cmd: Command) => {
      await run(cmd, 'get', { presentationId });
    });

  // --- Create ---
  slides
    .command('create')
    .description('Create a new presentation')
    .option('--title <text>', 'Presentation title', 'Untitled Presentation')
    .option('--folder <id>', 'Destination folder ID')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'create', {
        title: opts.title,
        folderId: opts.folder,
      });
    });

  // --- Copy ---
  slides
    .command('copy <presentationId>')
    .description('Copy a presentation')
    .option('--name <text>', 'Name for the copy')
    .option('--folder <id>', 'Destination folder ID')
    .action(async (presentationId: string, opts: any, cmd: Command) => {
      await run(cmd, 'copy', {
        presentationId,
        name: opts.name,
        folderId: opts.folder,
      });
    });

  // --- Export ---
  slides
    .command('export <presentationId>')
    .description('Export presentation to format')
    .option('--format <fmt>', 'Export format (pdf, pptx)', 'pdf')
    .option('--out <path>', 'Output file path')
    .action(async (presentationId: string, opts: any, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const config = loadConfig(globalOpts);
      const result = await executeCommand('slides', 'export', {
        presentationId,
        format: opts.format,
      }, config, {
        timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
        maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
        verbose: globalOpts.verbose,
      });

      if (result.ok && result.data) {
        const { content, encoding } = result.data;
        const outPath = opts.out || `presentation.${opts.format}`;

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
        printResult(result, getOutputMode(globalOpts), 'slides', 'export');
        process.exitCode = getExitCode(result);
      }
    });
}
