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
  const result = await executeCommand('sheets', action, params, config, {
    timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
    maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
    verbose: globalOpts.verbose,
  });
  printResult(result, getOutputMode(globalOpts), 'sheets', action);
  process.exitCode = getExitCode(result);
}

function parseValues(valuesStr: string): string[][] {
  // Parse comma-separated rows, pipe-separated columns: "a|b|c,d|e|f"
  return valuesStr.split(',').map(row => row.split('|'));
}

export function registerSheetsCommands(program: Command): void {
  const sheets = program
    .command('sheets')
    .description('Google Sheets operations');

  // --- Get metadata ---
  sheets
    .command('get <spreadsheetId>')
    .description('Get spreadsheet metadata')
    .action(async (spreadsheetId: string, _opts: any, cmd: Command) => {
      await run(cmd, 'get', { spreadsheetId });
    });

  // --- Read ---
  sheets
    .command('read <spreadsheetId> <range>')
    .description('Read a range of cells')
    .option('--render <option>', 'Value render option (FORMATTED_VALUE, UNFORMATTED_VALUE, FORMULA)')
    .action(async (spreadsheetId: string, range: string, opts: any, cmd: Command) => {
      await run(cmd, 'read', {
        spreadsheetId,
        range,
        valueRenderOption: opts.render,
      });
    });

  // --- Write ---
  sheets
    .command('write <spreadsheetId> <range>')
    .description('Write values to a range')
    .requiredOption('--values <data>', 'Values: rows comma-separated, columns pipe-separated (e.g., "a|b|c,d|e|f")')
    .option('--input <option>', 'Value input option (USER_ENTERED, RAW)', 'USER_ENTERED')
    .action(async (spreadsheetId: string, range: string, opts: any, cmd: Command) => {
      await run(cmd, 'write', {
        spreadsheetId,
        range,
        values: parseValues(opts.values),
        valueInputOption: opts.input,
      });
    });

  // --- Update (alias for write) ---
  sheets
    .command('update <spreadsheetId> <range>')
    .description('Update values in a range (alias for write)')
    .requiredOption('--values <data>', 'Values: rows comma-separated, columns pipe-separated')
    .option('--input <option>', 'Value input option', 'USER_ENTERED')
    .action(async (spreadsheetId: string, range: string, opts: any, cmd: Command) => {
      await run(cmd, 'update', {
        spreadsheetId,
        range,
        values: parseValues(opts.values),
        valueInputOption: opts.input,
      });
    });

  // --- Append ---
  sheets
    .command('append <spreadsheetId> <range>')
    .description('Append rows to a range')
    .requiredOption('--values <data>', 'Values: rows comma-separated, columns pipe-separated')
    .option('--input <option>', 'Value input option', 'USER_ENTERED')
    .action(async (spreadsheetId: string, range: string, opts: any, cmd: Command) => {
      await run(cmd, 'append', {
        spreadsheetId,
        range,
        values: parseValues(opts.values),
        valueInputOption: opts.input,
      });
    });

  // --- Clear ---
  sheets
    .command('clear <spreadsheetId> <range>')
    .description('Clear a range of cells')
    .action(async (spreadsheetId: string, range: string, _opts: any, cmd: Command) => {
      await run(cmd, 'clear', { spreadsheetId, range });
    });

  // --- Create ---
  sheets
    .command('create')
    .description('Create a new spreadsheet')
    .option('--title <text>', 'Spreadsheet title', 'Untitled Spreadsheet')
    .option('--folder <id>', 'Destination folder ID')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'create', {
        title: opts.title,
        folderId: opts.folder,
      });
    });

  // --- Copy ---
  sheets
    .command('copy <spreadsheetId>')
    .description('Copy a spreadsheet')
    .option('--name <text>', 'Name for the copy')
    .option('--folder <id>', 'Destination folder ID')
    .action(async (spreadsheetId: string, opts: any, cmd: Command) => {
      await run(cmd, 'copy', {
        spreadsheetId,
        name: opts.name,
        folderId: opts.folder,
      });
    });

  // --- Export ---
  sheets
    .command('export <spreadsheetId>')
    .description('Export spreadsheet to format')
    .option('--format <fmt>', 'Export format (pdf, xlsx, csv)', 'csv')
    .option('--out <path>', 'Output file path')
    .action(async (spreadsheetId: string, opts: any, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const config = loadConfig(globalOpts);
      const result = await executeCommand('sheets', 'export', {
        spreadsheetId,
        format: opts.format,
      }, config, {
        timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
        maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
        verbose: globalOpts.verbose,
      });

      if (result.ok && result.data) {
        const { content, encoding } = result.data;
        const outPath = opts.out || `spreadsheet.${opts.format}`;

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
        printResult(result, getOutputMode(globalOpts), 'sheets', 'export');
        process.exitCode = getExitCode(result);
      }
    });

  // --- Format ---
  sheets
    .command('format <spreadsheetId>')
    .description('Apply cell formatting via batch update')
    .requiredOption('--requests <json>', 'Batch update requests as JSON')
    .action(async (spreadsheetId: string, opts: any, cmd: Command) => {
      let requests;
      try {
        requests = JSON.parse(opts.requests);
      } catch {
        process.stderr.write('Error: --requests must be valid JSON\n');
        process.exitCode = 1;
        return;
      }
      await run(cmd, 'format', { spreadsheetId, requests });
    });
}
