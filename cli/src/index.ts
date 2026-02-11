#!/usr/bin/env node
import { Command } from 'commander';
import { registerGmailCommands } from './commands/gmail.js';
import { registerCalendarCommands } from './commands/calendar.js';
import { registerDriveCommands } from './commands/drive.js';
import { registerDocsCommands } from './commands/docs.js';
import { registerSheetsCommands } from './commands/sheets.js';
import { registerSlidesCommands } from './commands/slides.js';
import { registerContactsCommands } from './commands/contacts.js';
import { registerTasksCommands } from './commands/tasks.js';
import { registerPeopleCommands } from './commands/people.js';
import { registerGroupsCommands } from './commands/groups.js';
import { registerChatCommands } from './commands/chat.js';
import { registerClassroomCommands } from './commands/classroom.js';
import { registerAdminCommands } from './commands/admin.js';
import { registerSetupCommand } from './commands/setup.js';

const program = new Command();

program
  .name('gproxy')
  .description('Google Workspace CLI via Apps Script Proxy')
  .version('1.0.0')
  .option('--json', 'Output as JSON')
  .option('--plain', 'Output as plain text (no colors)')
  .option('--proxy-url <url>', 'Apps Script web app URL')
  .option('--secret <key>', 'JWT shared secret')
  .option('--verbose', 'Show request/response details')
  .option('--timeout <ms>', 'Request timeout in ms', '330000')
  .option('--retry <n>', 'Max retries', '3');

// Register all service commands
registerGmailCommands(program);
registerCalendarCommands(program);
registerDriveCommands(program);
registerDocsCommands(program);
registerSheetsCommands(program);
registerSlidesCommands(program);
registerContactsCommands(program);
registerTasksCommands(program);
registerPeopleCommands(program);
registerGroupsCommands(program);
registerChatCommands(program);
registerClassroomCommands(program);
registerAdminCommands(program);
registerSetupCommand(program);

program.parse();
