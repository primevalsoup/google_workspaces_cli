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
  const result = await executeCommand('classroom', action, params, config, {
    timeout: globalOpts.timeout ? Number(globalOpts.timeout) : undefined,
    maxRetries: globalOpts.retry ? Number(globalOpts.retry) : undefined,
    verbose: globalOpts.verbose,
  });
  printResult(result, getOutputMode(globalOpts), 'classroom', action);
  process.exitCode = getExitCode(result);
}

export function registerClassroomCommands(program: Command): void {
  const classroom = program
    .command('classroom')
    .description('Google Classroom operations (Workspace)');

  // --- Courses ---
  const courses = classroom
    .command('courses')
    .description('Course operations');

  courses
    .command('list')
    .description('List courses')
    .option('--student <id>', 'Filter by student ID')
    .option('--teacher <id>', 'Filter by teacher ID')
    .option('--states <states>', 'Course states (ACTIVE, ARCHIVED, etc.)')
    .option('--max <n>', 'Maximum results', '25')
    .option('--page-token <token>', 'Pagination token')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'courses.list', {
        studentId: opts.student,
        teacherId: opts.teacher,
        courseStates: opts.states,
        max: Number(opts.max),
        pageToken: opts.pageToken,
      });
    });

  courses
    .command('get <courseId>')
    .description('Get course details')
    .action(async (courseId: string, _opts: any, cmd: Command) => {
      await run(cmd, 'courses.get', { courseId });
    });

  courses
    .command('create <name>')
    .description('Create a course')
    .option('--section <text>', 'Course section')
    .option('--description <text>', 'Course description')
    .option('--room <text>', 'Room')
    .action(async (name: string, opts: any, cmd: Command) => {
      await run(cmd, 'courses.create', {
        name,
        section: opts.section,
        description: opts.description,
        room: opts.room,
      });
    });

  // --- Roster ---
  classroom
    .command('roster <courseId>')
    .description('List students and teachers in a course')
    .option('--role <role>', 'Filter by role (student, teacher, both)', 'both')
    .option('--max <n>', 'Maximum results', '50')
    .action(async (courseId: string, opts: any, cmd: Command) => {
      await run(cmd, 'roster.list', {
        courseId,
        role: opts.role,
        max: Number(opts.max),
      });
    });

  // --- Coursework ---
  const coursework = classroom
    .command('coursework')
    .description('Coursework operations');

  coursework
    .command('list <courseId>')
    .description('List coursework')
    .option('--states <states>', 'Filter by states (PUBLISHED, DRAFT)')
    .option('--max <n>', 'Maximum results', '25')
    .option('--page-token <token>', 'Pagination token')
    .action(async (courseId: string, opts: any, cmd: Command) => {
      await run(cmd, 'coursework.list', {
        courseId,
        courseWorkStates: opts.states,
        max: Number(opts.max),
        pageToken: opts.pageToken,
      });
    });

  coursework
    .command('create <courseId>')
    .description('Create coursework')
    .requiredOption('--title <text>', 'Assignment title')
    .option('--description <text>', 'Assignment description')
    .option('--type <type>', 'Work type (ASSIGNMENT, SHORT_ANSWER_QUESTION, MULTIPLE_CHOICE_QUESTION)', 'ASSIGNMENT')
    .option('--max-points <n>', 'Maximum points')
    .option('--state <state>', 'State (PUBLISHED, DRAFT)', 'PUBLISHED')
    .action(async (courseId: string, opts: any, cmd: Command) => {
      await run(cmd, 'coursework.create', {
        courseId,
        title: opts.title,
        description: opts.description,
        workType: opts.type,
        maxPoints: opts.maxPoints ? Number(opts.maxPoints) : undefined,
        state: opts.state,
      });
    });

  // --- Announcements ---
  const announcements = classroom
    .command('announcements')
    .description('Announcement operations');

  announcements
    .command('list <courseId>')
    .description('List announcements')
    .option('--states <states>', 'Filter by states')
    .option('--max <n>', 'Maximum results', '25')
    .option('--page-token <token>', 'Pagination token')
    .action(async (courseId: string, opts: any, cmd: Command) => {
      await run(cmd, 'announcements.list', {
        courseId,
        announcementStates: opts.states,
        max: Number(opts.max),
        pageToken: opts.pageToken,
      });
    });

  announcements
    .command('create <courseId>')
    .description('Create an announcement')
    .requiredOption('--text <text>', 'Announcement text')
    .option('--state <state>', 'State (PUBLISHED, DRAFT)', 'PUBLISHED')
    .action(async (courseId: string, opts: any, cmd: Command) => {
      await run(cmd, 'announcements.create', {
        courseId,
        text: opts.text,
        state: opts.state,
      });
    });

  // --- Submissions ---
  classroom
    .command('submissions <courseId> <courseWorkId>')
    .description('List student submissions')
    .option('--states <states>', 'Filter by states')
    .option('--max <n>', 'Maximum results', '50')
    .option('--page-token <token>', 'Pagination token')
    .action(async (courseId: string, courseWorkId: string, opts: any, cmd: Command) => {
      await run(cmd, 'submissions.list', {
        courseId,
        courseWorkId,
        states: opts.states,
        max: Number(opts.max),
        pageToken: opts.pageToken,
      });
    });
}
