/**
 * Calendar.gs — Calendar service handler
 * Uses CalendarApp + Calendar Advanced Service
 */

/**
 * Handle Calendar service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handleCalendar(action, params) {
  switch (action) {
    case 'events.list': return calendarEventsList(params);
    case 'events.get': return calendarEventsGet(params);
    case 'events.create': return calendarEventsCreate(params);
    case 'events.update': return calendarEventsUpdate(params);
    case 'events.delete': return calendarEventsDelete(params);
    case 'events.respond': return calendarEventsRespond(params);
    case 'events.propose': return calendarEventsPropose(params);
    case 'events.conflicts': return calendarEventsConflicts(params);
    case 'freebusy': return calendarFreebusy(params);
    case 'calendars.list': return calendarCalendarsList();
    default:
      return errorResponse('NOT_FOUND', 'Unknown Calendar action: ' + action, false);
  }
}

function calendarEventsList(params) {
  var calendarId = params.calendarId || 'primary';
  var options = {
    maxResults: validatePositiveInt(params.max, 25, 250),
    singleEvents: true,
    orderBy: params.orderBy || 'startTime'
  };
  if (params.timeMin) options.timeMin = params.timeMin;
  if (params.timeMax) options.timeMax = params.timeMax;
  if (params.query) options.q = params.query;
  if (params.pageToken) options.pageToken = params.pageToken;

  var result = Calendar.Events.list(calendarId, options);
  var events = (result.items || []).map(formatCalendarEvent_);
  return successResponse({
    events: events,
    count: events.length,
    nextPageToken: result.nextPageToken || null
  });
}

function calendarEventsGet(params) {
  var err = validateParams(params, ['eventId']);
  if (err) return err;
  var calendarId = params.calendarId || 'primary';
  var event = Calendar.Events.get(calendarId, params.eventId);
  return successResponse(formatCalendarEvent_(event));
}

function calendarEventsCreate(params) {
  var err = validateParams(params, ['summary', 'start', 'end']);
  if (err) return err;
  var calendarId = params.calendarId || 'primary';

  var event = {
    summary: params.summary,
    description: params.description || '',
    location: params.location || ''
  };

  // Handle all-day vs timed events
  if (params.allDay) {
    event.start = { date: params.start };
    event.end = { date: params.end };
  } else {
    event.start = { dateTime: params.start, timeZone: params.timeZone || 'UTC' };
    event.end = { dateTime: params.end, timeZone: params.timeZone || 'UTC' };
  }

  if (params.attendees) {
    event.attendees = params.attendees.map(function(email) {
      return typeof email === 'string' ? { email: email } : email;
    });
  }
  if (params.recurrence) event.recurrence = params.recurrence;
  if (params.reminders) {
    event.reminders = { useDefault: false, overrides: params.reminders };
  }
  if (params.colorId) event.colorId = params.colorId;
  if (params.visibility) event.visibility = params.visibility;

  var options = {};
  if (params.sendUpdates) options.sendUpdates = params.sendUpdates;

  var created = Calendar.Events.insert(event, calendarId, options);
  return successResponse(formatCalendarEvent_(created));
}

function calendarEventsUpdate(params) {
  var err = validateParams(params, ['eventId']);
  if (err) return err;
  var calendarId = params.calendarId || 'primary';

  var event = Calendar.Events.get(calendarId, params.eventId);
  if (params.summary !== undefined) event.summary = params.summary;
  if (params.description !== undefined) event.description = params.description;
  if (params.location !== undefined) event.location = params.location;
  if (params.start !== undefined) {
    event.start = params.allDay ? { date: params.start } : { dateTime: params.start, timeZone: params.timeZone || event.start.timeZone || 'UTC' };
  }
  if (params.end !== undefined) {
    event.end = params.allDay ? { date: params.end } : { dateTime: params.end, timeZone: params.timeZone || event.end.timeZone || 'UTC' };
  }
  if (params.attendees !== undefined) {
    event.attendees = params.attendees.map(function(email) {
      return typeof email === 'string' ? { email: email } : email;
    });
  }
  if (params.colorId !== undefined) event.colorId = params.colorId;
  if (params.visibility !== undefined) event.visibility = params.visibility;

  var options = {};
  if (params.sendUpdates) options.sendUpdates = params.sendUpdates;

  var updated = Calendar.Events.update(event, calendarId, params.eventId, options);
  return successResponse(formatCalendarEvent_(updated));
}

function calendarEventsDelete(params) {
  var err = validateParams(params, ['eventId']);
  if (err) return err;
  var calendarId = params.calendarId || 'primary';
  var options = {};
  if (params.sendUpdates) options.sendUpdates = params.sendUpdates;
  Calendar.Events.remove(calendarId, params.eventId, options);
  return successResponse({ deleted: params.eventId });
}

function calendarEventsRespond(params) {
  var err = validateParams(params, ['eventId', 'response']);
  if (err) return err;
  var calendarId = params.calendarId || 'primary';
  var validResponses = ['accepted', 'declined', 'tentative'];
  if (validResponses.indexOf(params.response) === -1) {
    return errorResponse('INVALID_REQUEST', 'Response must be: accepted, declined, or tentative', false);
  }

  var event = Calendar.Events.get(calendarId, params.eventId);
  var myEmail = Session.getActiveUser().getEmail();
  var attendees = event.attendees || [];
  var found = false;
  for (var i = 0; i < attendees.length; i++) {
    if (attendees[i].email === myEmail || attendees[i].self) {
      attendees[i].responseStatus = params.response;
      found = true;
      break;
    }
  }
  if (!found) {
    attendees.push({ email: myEmail, responseStatus: params.response });
  }
  event.attendees = attendees;
  Calendar.Events.patch(event, calendarId, params.eventId, { sendUpdates: params.sendUpdates || 'none' });
  return successResponse({ eventId: params.eventId, response: params.response });
}

function calendarEventsPropose(params) {
  var err = validateParams(params, ['eventId', 'start', 'end']);
  if (err) return err;
  // Propose new time via comment (Calendar API doesn't have native propose-time)
  var calendarId = params.calendarId || 'primary';
  var event = Calendar.Events.get(calendarId, params.eventId);
  var message = 'Proposed new time: ' + params.start + ' to ' + params.end;
  if (params.comment) message += ' — ' + params.comment;

  // Use the event's response to indicate tentative + add note
  return calendarEventsRespond({
    eventId: params.eventId,
    calendarId: calendarId,
    response: 'tentative',
    sendUpdates: 'all'
  });
}

function calendarEventsConflicts(params) {
  var err = validateParams(params, ['start', 'end']);
  if (err) return err;
  var calendarId = params.calendarId || 'primary';

  var events = Calendar.Events.list(calendarId, {
    timeMin: params.start,
    timeMax: params.end,
    singleEvents: true,
    orderBy: 'startTime'
  });

  var conflicts = (events.items || []).map(formatCalendarEvent_);
  return successResponse({ conflicts: conflicts, count: conflicts.length });
}

function calendarFreebusy(params) {
  var err = validateParams(params, ['timeMin', 'timeMax']);
  if (err) return err;

  var calendars = params.calendars || ['primary'];
  var items = calendars.map(function(id) { return { id: id }; });

  var request = {
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    items: items
  };

  var result = Calendar.Freebusy.query(request);
  var calendarsResult = {};
  for (var calId in result.calendars) {
    calendarsResult[calId] = {
      busy: result.calendars[calId].busy || [],
      errors: result.calendars[calId].errors || []
    };
  }
  return successResponse({ calendars: calendarsResult });
}

function calendarCalendarsList() {
  var calendars = Calendar.CalendarList.list();
  var results = (calendars.items || []).map(function(cal) {
    return {
      id: cal.id,
      summary: cal.summary,
      description: cal.description || '',
      primary: cal.primary || false,
      accessRole: cal.accessRole,
      backgroundColor: cal.backgroundColor,
      timeZone: cal.timeZone
    };
  });
  return successResponse({ calendars: results });
}

// --- Helper ---

function formatCalendarEvent_(event) {
  return {
    eventId: event.id,
    summary: event.summary || '(No title)',
    description: event.description || '',
    location: event.location || '',
    start: event.start ? (event.start.dateTime || event.start.date) : null,
    end: event.end ? (event.end.dateTime || event.end.date) : null,
    allDay: !!(event.start && event.start.date),
    status: event.status,
    creator: event.creator ? event.creator.email : '',
    organizer: event.organizer ? event.organizer.email : '',
    attendees: (event.attendees || []).map(function(a) {
      return { email: a.email, responseStatus: a.responseStatus, displayName: a.displayName || '' };
    }),
    htmlLink: event.htmlLink || '',
    hangoutLink: event.hangoutLink || '',
    recurringEventId: event.recurringEventId || null,
    colorId: event.colorId || null,
    visibility: event.visibility || 'default',
    created: event.created,
    updated: event.updated
  };
}
