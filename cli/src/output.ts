import chalk from 'chalk';
import type { CommandResult, OutputMode } from './types.js';

export function formatOutput(
  result: CommandResult,
  mode: OutputMode,
  service: string,
  action: string
): string {
  if (!result.ok) {
    return ''; // errors handled separately via formatError
  }

  if (mode === 'json') {
    return JSON.stringify(result.data ?? result, null, 2);
  }

  const data = result.data;
  if (!data) return '';

  const formatted = formatHuman(data, service, action);
  if (mode === 'plain') {
    return stripAnsi(formatted);
  }
  return formatted;
}

function formatHuman(data: any, service: string, action: string): string {
  switch (service) {
    case 'gmail':
      return formatGmail(data, action);
    case 'calendar':
      return formatCalendar(data, action);
    case 'drive':
      return formatDrive(data, action);
    case 'docs':
    case 'sheets':
    case 'slides':
      return formatDocsFamily(data, service, action);
    case 'contacts':
    case 'people':
      return formatContacts(data, action);
    case 'tasks':
      return formatTasks(data, action);
    default:
      return JSON.stringify(data, null, 2);
  }
}

function formatGmail(data: any, action: string): string {
  if (action === 'list' && Array.isArray(data.threads)) {
    return formatGmailThreads(data.threads);
  }
  if (action === 'read' && data.messages) {
    return formatGmailMessages(data.messages);
  }
  if (action === 'send') {
    return chalk.green('Message sent successfully.');
  }
  return JSON.stringify(data, null, 2);
}

function formatGmailThreads(threads: any[]): string {
  if (threads.length === 0) return chalk.dim('No threads found.');
  const lines: string[] = [];
  for (const t of threads) {
    const from = chalk.bold(t.from || 'Unknown');
    const subject = t.subject || '(no subject)';
    const date = chalk.dim(t.date || '');
    const snippet = chalk.dim(t.snippet || '');
    lines.push(`${from}  ${subject}`);
    lines.push(`  ${date}  ${snippet}`);
    lines.push('');
  }
  return lines.join('\n');
}

function formatGmailMessages(messages: any[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    lines.push(chalk.bold(`From: ${m.from || 'Unknown'}`));
    lines.push(`To: ${m.to || ''}`);
    lines.push(`Date: ${m.date || ''}`);
    lines.push(`Subject: ${chalk.underline(m.subject || '(no subject)')}`);
    lines.push('');
    lines.push(m.body || '');
    lines.push(chalk.dim('─'.repeat(60)));
  }
  return lines.join('\n');
}

function formatCalendar(data: any, action: string): string {
  if (action === 'list' && Array.isArray(data.events)) {
    return formatCalendarEvents(data.events);
  }
  if (action === 'create') {
    return chalk.green(`Event created: ${data.summary || data.id || ''}`);
  }
  return JSON.stringify(data, null, 2);
}

function formatCalendarEvents(events: any[]): string {
  if (events.length === 0) return chalk.dim('No events found.');
  const lines: string[] = [];
  for (const e of events) {
    const summary = chalk.bold(e.summary || '(untitled)');
    const when = chalk.cyan(e.start || e.when || '');
    const location = e.location ? chalk.dim(` @ ${e.location}`) : '';
    lines.push(`${summary}  ${when}${location}`);
  }
  return lines.join('\n');
}

function formatDrive(data: any, action: string): string {
  if (action === 'list' && Array.isArray(data.files)) {
    return formatDriveFiles(data.files);
  }
  if (action === 'upload') {
    return chalk.green(`Uploaded: ${data.name || data.id || ''}`);
  }
  if (action === 'download') {
    return chalk.green(`Downloaded: ${data.name || ''}`);
  }
  return JSON.stringify(data, null, 2);
}

function formatDriveFiles(files: any[]): string {
  if (files.length === 0) return chalk.dim('No files found.');
  const lines: string[] = [];
  for (const f of files) {
    const name = chalk.bold(f.name || '(unnamed)');
    const type = chalk.dim(f.mimeType || f.type || '');
    const modified = chalk.dim(f.modifiedTime || f.modified || '');
    const size = f.size ? chalk.dim(formatSize(Number(f.size))) : '';
    lines.push(`${name}  ${type}  ${modified}  ${size}`);
  }
  return lines.join('\n');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDocsFamily(data: any, service: string, action: string): string {
  if (action === 'list' && Array.isArray(data.files)) {
    return formatDriveFiles(data.files);
  }
  if (action === 'create') {
    return chalk.green(`Created ${service} document: ${data.title || data.id || ''}`);
  }
  if (action === 'get' && data.content) {
    return data.content;
  }
  return JSON.stringify(data, null, 2);
}

function formatContacts(data: any, action: string): string {
  if (action === 'list' && Array.isArray(data.contacts)) {
    const lines: string[] = [];
    for (const c of data.contacts) {
      const name = chalk.bold(c.name || '(unnamed)');
      const email = c.email ? chalk.cyan(c.email) : '';
      const phone = c.phone ? chalk.dim(c.phone) : '';
      lines.push(`${name}  ${email}  ${phone}`);
    }
    return lines.length > 0 ? lines.join('\n') : chalk.dim('No contacts found.');
  }
  return JSON.stringify(data, null, 2);
}

function formatTasks(data: any, action: string): string {
  if (action === 'list' && Array.isArray(data.tasks)) {
    const lines: string[] = [];
    for (const t of data.tasks) {
      const status = t.completed ? chalk.green('✓') : chalk.dim('○');
      const title = t.title || '(untitled)';
      const due = t.due ? chalk.dim(` due ${t.due}`) : '';
      lines.push(`${status} ${title}${due}`);
    }
    return lines.length > 0 ? lines.join('\n') : chalk.dim('No tasks found.');
  }
  return JSON.stringify(data, null, 2);
}

export function formatError(error: { code: string; message: string }): string {
  return chalk.red(`Error [${error.code}]: ${error.message}`);
}

export function printResult(
  result: CommandResult,
  mode: OutputMode,
  service: string,
  action: string
): void {
  if (result.ok) {
    const output = formatOutput(result, mode, service, action);
    if (output) {
      process.stdout.write(output + '\n');
    }
  } else if (result.error) {
    process.stderr.write(formatError(result.error) + '\n');
  }
}

export function getExitCode(result: CommandResult): number {
  if (result.ok) return 0;
  if (!result.error) return 1;
  switch (result.error.code) {
    case 'AUTH_FAILED':
    case 'IP_BLOCKED':
      return 2;
    case 'NOT_FOUND':
      return 3;
    case 'QUOTA_EXCEEDED':
      return 4;
    default:
      return 1;
  }
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
