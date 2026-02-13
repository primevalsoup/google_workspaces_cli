import type { ServiceDefinition } from './types.js';

export const SERVICE_DEFINITIONS: ServiceDefinition[] = [
  {
    key: 'gmail',
    displayName: 'Gmail',
    handlerFunction: 'handleGmail',
    files: ['Gmail.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
    ],
    advancedService: { userSymbol: 'Gmail', serviceId: 'gmail', version: 'v1' },
    workspaceOnly: false,
    description: 'Search, read, send, labels, drafts, attachments, settings',
  },
  {
    key: 'calendar',
    displayName: 'Calendar',
    handlerFunction: 'handleCalendar',
    files: ['Calendar.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/calendar',
    ],
    advancedService: { userSymbol: 'Calendar', serviceId: 'calendar', version: 'v3' },
    workspaceOnly: false,
    description: 'Events, freebusy, calendars',
  },
  {
    key: 'drive',
    displayName: 'Drive',
    handlerFunction: 'handleDrive',
    files: ['Drive.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/drive',
    ],
    advancedService: { userSymbol: 'Drive', serviceId: 'drive', version: 'v3' },
    workspaceOnly: false,
    description: 'List, search, upload, download, permissions, export',
  },
  {
    key: 'docs',
    displayName: 'Docs',
    handlerFunction: 'handleDocs',
    files: ['Docs.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/documents',
    ],
    advancedService: { userSymbol: 'Docs', serviceId: 'docs', version: 'v1' },
    workspaceOnly: false,
    description: 'Get, read text, create, copy, export',
  },
  {
    key: 'sheets',
    displayName: 'Sheets',
    handlerFunction: 'handleSheets',
    files: ['Sheets.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/spreadsheets',
    ],
    advancedService: { userSymbol: 'Sheets', serviceId: 'sheets', version: 'v4' },
    workspaceOnly: false,
    description: 'Read, write, append, clear, format, export',
  },
  {
    key: 'slides',
    displayName: 'Slides',
    handlerFunction: 'handleSlides',
    files: ['Slides.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/presentations',
    ],
    advancedService: { userSymbol: 'Slides', serviceId: 'slides', version: 'v1' },
    workspaceOnly: false,
    description: 'Get, create, copy, export',
  },
  {
    key: 'contacts',
    displayName: 'Contacts',
    handlerFunction: 'handleContacts',
    files: ['Contacts.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/contacts',
      'https://www.googleapis.com/auth/contacts.readonly',
    ],
    advancedService: { userSymbol: 'People', serviceId: 'peopleapi', version: 'v1' },
    workspaceOnly: false,
    description: 'List, search, create, update, delete contacts',
  },
  {
    key: 'people',
    displayName: 'People',
    handlerFunction: 'handlePeople',
    files: ['People.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/contacts',
      'https://www.googleapis.com/auth/contacts.readonly',
    ],
    advancedService: { userSymbol: 'People', serviceId: 'peopleapi', version: 'v1' },
    workspaceOnly: false,
    description: 'Directory search, profile lookup',
  },
  {
    key: 'tasks',
    displayName: 'Tasks',
    handlerFunction: 'handleTasks',
    files: ['Tasks.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/tasks',
    ],
    advancedService: { userSymbol: 'Tasks', serviceId: 'tasks', version: 'v1' },
    workspaceOnly: false,
    description: 'Task lists, create, update, complete, delete',
  },
  {
    key: 'groups',
    displayName: 'Groups',
    handlerFunction: 'handleGroups',
    files: ['Groups.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.group',
    ],
    advancedService: { userSymbol: 'AdminDirectory', serviceId: 'admin', version: 'directory_v1' },
    workspaceOnly: true,
    description: 'List groups, manage members (Workspace only)',
  },
  {
    key: 'chat',
    displayName: 'Chat',
    handlerFunction: 'handleChat',
    files: ['Chat.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/chat.bot',
    ],
    advancedService: { userSymbol: 'Chat', serviceId: 'chat', version: 'v1' },
    workspaceOnly: true,
    description: 'Spaces, messages, DMs (Workspace only)',
  },
  {
    key: 'classroom',
    displayName: 'Classroom',
    handlerFunction: 'handleClassroom',
    files: ['Classroom.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/classroom.courses',
      'https://www.googleapis.com/auth/classroom.rosters',
    ],
    advancedService: { userSymbol: 'Classroom', serviceId: 'classroom', version: 'v1' },
    workspaceOnly: true,
    description: 'Courses, roster, coursework (Workspace only)',
  },
  {
    key: 'admin',
    displayName: 'Admin',
    handlerFunction: 'handleAdmin',
    files: ['Admin.gs'],
    oauthScopes: [
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.group',
    ],
    advancedService: { userSymbol: 'AdminDirectory', serviceId: 'admin', version: 'directory_v1' },
    workspaceOnly: true,
    description: 'User/group management (Workspace only)',
  },
];

export const CORE_FILES = [
  'Code.gs',
  'Auth.gs',
  'Config.gs',
  'Logger.gs',
  'Utils.gs',
  'SecurityFilter.gs',
  'Admin.gs',
];

export const BASE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/script.external_request',
];

export function getServiceByKey(key: string): ServiceDefinition | undefined {
  return SERVICE_DEFINITIONS.find(s => s.key === key);
}

export function getSelectableServices(): ServiceDefinition[] {
  // admin is the Workspace Admin SDK service, not the proxy admin — it's user-selectable
  return SERVICE_DEFINITIONS;
}
