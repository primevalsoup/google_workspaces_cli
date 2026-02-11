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
  const result = await executeCommand('tasks', action, params, config, {
    timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
    maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
    verbose: globalOpts.verbose,
  });
  printResult(result, getOutputMode(globalOpts), 'tasks', action);
  process.exitCode = getExitCode(result);
}

export function registerTasksCommands(program: Command): void {
  const tasks = program
    .command('tasks')
    .description('Google Tasks operations');

  // --- Task lists ---
  tasks
    .command('lists')
    .description('List all task lists')
    .option('--max <n>', 'Maximum results', '25')
    .option('--page-token <token>', 'Pagination token')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'tasklists.list', {
        max: Number(opts.max),
        pageToken: opts.pageToken,
      });
    });

  // --- List tasks ---
  tasks
    .command('list')
    .description('List tasks in a task list')
    .option('--tasklist <id>', 'Task list ID', '@default')
    .option('--max <n>', 'Maximum results', '50')
    .option('--show-completed', 'Include completed tasks')
    .option('--show-hidden', 'Include hidden tasks')
    .option('--due-min <date>', 'Minimum due date (RFC 3339)')
    .option('--due-max <date>', 'Maximum due date (RFC 3339)')
    .option('--page-token <token>', 'Pagination token')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'list', {
        tasklistId: opts.tasklist,
        max: Number(opts.max),
        showCompleted: opts.showCompleted || false,
        showHidden: opts.showHidden || false,
        dueMin: opts.dueMin,
        dueMax: opts.dueMax,
        pageToken: opts.pageToken,
      });
    });

  // --- Get ---
  tasks
    .command('get <taskId>')
    .description('Get task details')
    .option('--tasklist <id>', 'Task list ID', '@default')
    .action(async (taskId: string, opts: any, cmd: Command) => {
      await run(cmd, 'get', {
        taskId,
        tasklistId: opts.tasklist,
      });
    });

  // --- Create ---
  tasks
    .command('create <title>')
    .description('Create a new task')
    .option('--tasklist <id>', 'Task list ID', '@default')
    .option('--notes <text>', 'Task notes/description')
    .option('--due <date>', 'Due date (RFC 3339)')
    .option('--parent <id>', 'Parent task ID (for subtasks)')
    .action(async (title: string, opts: any, cmd: Command) => {
      await run(cmd, 'create', {
        title,
        tasklistId: opts.tasklist,
        notes: opts.notes,
        due: opts.due,
        parent: opts.parent,
      });
    });

  // --- Update ---
  tasks
    .command('update <taskId>')
    .description('Update a task')
    .option('--tasklist <id>', 'Task list ID', '@default')
    .option('--title <text>', 'New title')
    .option('--notes <text>', 'New notes')
    .option('--due <date>', 'New due date')
    .action(async (taskId: string, opts: any, cmd: Command) => {
      await run(cmd, 'update', {
        taskId,
        tasklistId: opts.tasklist,
        title: opts.title,
        notes: opts.notes,
        due: opts.due,
      });
    });

  // --- Done ---
  tasks
    .command('done <taskId>')
    .description('Mark a task as completed')
    .option('--tasklist <id>', 'Task list ID', '@default')
    .action(async (taskId: string, opts: any, cmd: Command) => {
      await run(cmd, 'done', {
        taskId,
        tasklistId: opts.tasklist,
      });
    });

  // --- Undo ---
  tasks
    .command('undo <taskId>')
    .description('Mark a completed task as incomplete')
    .option('--tasklist <id>', 'Task list ID', '@default')
    .action(async (taskId: string, opts: any, cmd: Command) => {
      await run(cmd, 'undo', {
        taskId,
        tasklistId: opts.tasklist,
      });
    });

  // --- Delete ---
  tasks
    .command('delete <taskId>')
    .description('Delete a task')
    .option('--tasklist <id>', 'Task list ID', '@default')
    .action(async (taskId: string, opts: any, cmd: Command) => {
      await run(cmd, 'delete', {
        taskId,
        tasklistId: opts.tasklist,
      });
    });

  // --- Clear ---
  tasks
    .command('clear')
    .description('Clear all completed tasks from a task list')
    .option('--tasklist <id>', 'Task list ID', '@default')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'clear', {
        tasklistId: opts.tasklist,
      });
    });
}
