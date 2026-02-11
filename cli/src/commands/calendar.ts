import { Command } from 'commander';
import { run } from './helpers.js';

export function registerCalendarCommands(program: Command): void {
  const cal = program
    .command('calendar')
    .alias('cal')
    .description('Google Calendar operations');

  // --- Events ---
  const events = cal
    .command('events')
    .description('Calendar event operations');

  events
    .command('list')
    .description('List upcoming events')
    .option('--calendar <id>', 'Calendar ID', 'primary')
    .option('--max <n>', 'Maximum results', '25')
    .option('--time-min <datetime>', 'Start time (ISO 8601)')
    .option('--time-max <datetime>', 'End time (ISO 8601)')
    .option('--query <text>', 'Free-text search')
    .option('--order-by <field>', 'Order by (startTime or updated)', 'startTime')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'calendar', 'events.list', {
        calendarId: opts.calendar,
        max: Number(opts.max),
        timeMin: opts.timeMin,
        timeMax: opts.timeMax,
        query: opts.query,
        orderBy: opts.orderBy,
      });
    });

  events
    .command('get <eventId>')
    .description('Get event details')
    .option('--calendar <id>', 'Calendar ID', 'primary')
    .action(async (eventId: string, opts: any, cmd: Command) => {
      await run(cmd, 'calendar', 'events.get', {
        eventId,
        calendarId: opts.calendar,
      });
    });

  events
    .command('create')
    .description('Create an event')
    .requiredOption('--summary <text>', 'Event title')
    .requiredOption('--start <datetime>', 'Start time (ISO 8601)')
    .requiredOption('--end <datetime>', 'End time (ISO 8601)')
    .option('--calendar <id>', 'Calendar ID', 'primary')
    .option('--description <text>', 'Event description')
    .option('--location <text>', 'Event location')
    .option('--all-day', 'Create all-day event')
    .option('--attendees <emails>', 'Attendee emails (comma-separated)')
    .option('--timezone <tz>', 'Time zone', 'UTC')
    .option('--color <id>', 'Color ID')
    .option('--visibility <v>', 'Visibility (default, public, private)')
    .option('--send-updates <mode>', 'Send updates (all, externalOnly, none)')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'calendar', 'events.create', {
        calendarId: opts.calendar,
        summary: opts.summary,
        start: opts.start,
        end: opts.end,
        description: opts.description,
        location: opts.location,
        allDay: opts.allDay || false,
        attendees: opts.attendees ? opts.attendees.split(',') : undefined,
        timeZone: opts.timezone,
        colorId: opts.color,
        visibility: opts.visibility,
        sendUpdates: opts.sendUpdates,
      });
    });

  events
    .command('update <eventId>')
    .description('Update an event')
    .option('--calendar <id>', 'Calendar ID', 'primary')
    .option('--summary <text>', 'Event title')
    .option('--start <datetime>', 'Start time')
    .option('--end <datetime>', 'End time')
    .option('--description <text>', 'Description')
    .option('--location <text>', 'Location')
    .option('--all-day', 'All-day event')
    .option('--attendees <emails>', 'Attendees (comma-separated)')
    .option('--timezone <tz>', 'Time zone')
    .option('--color <id>', 'Color ID')
    .option('--visibility <v>', 'Visibility')
    .option('--send-updates <mode>', 'Send updates')
    .action(async (eventId: string, opts: any, cmd: Command) => {
      await run(cmd, 'calendar', 'events.update', {
        eventId,
        calendarId: opts.calendar,
        summary: opts.summary,
        start: opts.start,
        end: opts.end,
        description: opts.description,
        location: opts.location,
        allDay: opts.allDay,
        attendees: opts.attendees ? opts.attendees.split(',') : undefined,
        timeZone: opts.timezone,
        colorId: opts.color,
        visibility: opts.visibility,
        sendUpdates: opts.sendUpdates,
      });
    });

  events
    .command('delete <eventId>')
    .description('Delete an event')
    .option('--calendar <id>', 'Calendar ID', 'primary')
    .option('--send-updates <mode>', 'Send updates')
    .action(async (eventId: string, opts: any, cmd: Command) => {
      await run(cmd, 'calendar', 'events.delete', {
        eventId,
        calendarId: opts.calendar,
        sendUpdates: opts.sendUpdates,
      });
    });

  events
    .command('respond <eventId> <response>')
    .description('Respond to an event (accepted, declined, tentative)')
    .option('--calendar <id>', 'Calendar ID', 'primary')
    .option('--send-updates <mode>', 'Send updates')
    .action(async (eventId: string, response: string, opts: any, cmd: Command) => {
      await run(cmd, 'calendar', 'events.respond', {
        eventId,
        response,
        calendarId: opts.calendar,
        sendUpdates: opts.sendUpdates,
      });
    });

  events
    .command('propose <eventId>')
    .description('Propose a new time for an event')
    .requiredOption('--start <datetime>', 'Proposed start time')
    .requiredOption('--end <datetime>', 'Proposed end time')
    .option('--calendar <id>', 'Calendar ID', 'primary')
    .option('--comment <text>', 'Comment with proposal')
    .action(async (eventId: string, opts: any, cmd: Command) => {
      await run(cmd, 'calendar', 'events.propose', {
        eventId,
        calendarId: opts.calendar,
        start: opts.start,
        end: opts.end,
        comment: opts.comment,
      });
    });

  events
    .command('conflicts')
    .description('Check for conflicts in a time range')
    .requiredOption('--start <datetime>', 'Start time')
    .requiredOption('--end <datetime>', 'End time')
    .option('--calendar <id>', 'Calendar ID', 'primary')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'calendar', 'events.conflicts', {
        calendarId: opts.calendar,
        start: opts.start,
        end: opts.end,
      });
    });

  // --- Free/Busy ---
  cal
    .command('freebusy')
    .description('Check free/busy status')
    .requiredOption('--time-min <datetime>', 'Start time')
    .requiredOption('--time-max <datetime>', 'End time')
    .option('--calendars <ids>', 'Calendar IDs (comma-separated)', 'primary')
    .action(async (opts: any, cmd: Command) => {
      await run(cmd, 'calendar', 'freebusy', {
        timeMin: opts.timeMin,
        timeMax: opts.timeMax,
        calendars: opts.calendars.split(','),
      });
    });

  // --- Calendars list ---
  cal
    .command('list')
    .description('List all calendars')
    .action(async (_opts: any, cmd: Command) => {
      await run(cmd, 'calendar', 'calendars.list', {});
    });
}
