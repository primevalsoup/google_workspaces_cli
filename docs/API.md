# API Reference

Complete reference for all GProxy services, actions, and parameters.

## Request Format

All requests are POST to the proxy URL with JSON body:

```json
{
  "jwt": "<HS256 token>",
  "service": "<service name>",
  "action": "<action name>",
  "params": { ... },
  "clientIp": "<optional client IP>"
}
```

## Response Format

**Success:** `{"ok": true, "data": { ... }, "requestId": "..."}`

**Error:** `{"ok": false, "error": {"code": "...", "message": "...", "retryable": true|false}, "requestId": "..."}`

---

## Gmail

### `gmail` / `search`

Search Gmail threads.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | No | `is:inbox` | Gmail search query |
| `max` | number | No | 20 | Max threads (1-100) |
| `includeBody` | boolean | No | false | Include full message body |

**Response:** `{ threads: [...], count: number }`

### `gmail` / `messageSearch`

Search Gmail messages (individual messages, not threads).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | No | `is:inbox` | Gmail search query |
| `max` | number | No | 20 | Max threads to scan (1-100) |
| `includeBody` | boolean | No | false | Include body and bodyHtml |

**Response:** `{ messages: [...], count: number }`

### `gmail` / `get` (alias: `read`)

Get a thread with all messages.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `threadId` | string | **Yes** | Gmail thread ID |

**Response:** `{ threadId, subject, messageCount, isUnread, labels, messages: [...] }`

### `gmail` / `send`

Send an email.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | string | **Yes** | Recipient email |
| `subject` | string | **Yes** | Email subject |
| `body` | string | No | Plain text body |
| `bodyHtml` | string | No | HTML body |
| `cc` | string | No | CC recipients |
| `bcc` | string | No | BCC recipients |
| `replyTo` | string | No | Reply-to address |
| `from` | string | No | From address (send-as) |
| `replyToThreadId` | string | No | Thread ID for replies |
| `attachments` | array | No | `[{name, content (base64), mimeType}]` |

**Response:** `{ action: "sent" }` or `{ threadId, action: "replied" }`

### `gmail` / `labels.list`

List user labels.

**Response:** `{ labels: [{name, unreadCount}] }`

### `gmail` / `labels.create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | **Yes** | Label name |

### `gmail` / `labels.delete`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | **Yes** | Label name |

### `gmail` / `thread.modify`

Modify a thread (labels, read/unread, star, trash, archive, important).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `threadId` | string | **Yes** | Thread ID |
| `addLabels` | string[] | No | Labels to add |
| `removeLabels` | string[] | No | Labels to remove |
| `markRead` | boolean | No | Mark as read |
| `markUnread` | boolean | No | Mark as unread |
| `star` | boolean | No | Star messages |
| `unstar` | boolean | No | Unstar messages |
| `moveToTrash` | boolean | No | Move to trash |
| `moveToArchive` | boolean | No | Archive |
| `moveToInbox` | boolean | No | Move to inbox |
| `markImportant` | boolean | No | Mark important |
| `markUnimportant` | boolean | No | Mark not important |

### `gmail` / `drafts.list`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `max` | number | No | 20 | Max drafts (1-100) |

**Response:** `{ drafts: [{draftId, messageId, subject, to, date}], count }`

### `gmail` / `drafts.create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | string | **Yes** | Recipient |
| `subject` | string | **Yes** | Subject |
| `body` | string | No | Body text |
| `bodyHtml` | string | No | HTML body |
| `cc` | string | No | CC |
| `bcc` | string | No | BCC |
| `replyToMessageId` | string | No | Message ID for reply draft |

### `gmail` / `drafts.update`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `draftId` | string | **Yes** | Draft ID |
| `to` | string | No | Updated recipient |
| `subject` | string | No | Updated subject |
| `body` | string | No | Updated body |

### `gmail` / `drafts.send`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `draftId` | string | **Yes** | Draft ID to send |

### `gmail` / `attachments.download`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `messageId` | string | **Yes** | Message ID |
| `attachmentIndex` | number | No | Specific attachment index (omit for all) |

**Response:** `{ name, contentType, size, content (base64) }` or `{ attachments: [...] }`

### `gmail` / `settings.vacation`

Get or set vacation responder.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `set` | boolean | No | `true` to update settings |
| `enabled` | boolean | No | Enable auto-reply |
| `subject` | string | No | Response subject |
| `body` | string | No | Response body (plain text) |
| `bodyHtml` | string | No | Response body (HTML) |
| `startTime` | string | No | Start date (ISO) |
| `endTime` | string | No | End date (ISO) |
| `restrictToContacts` | boolean | No | Only reply to contacts |
| `restrictToDomain` | boolean | No | Only reply to domain |

### `gmail` / `settings.filters.list`

List Gmail filters.

**Response:** `{ filters: [...] }`

### `gmail` / `settings.filters.create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `criteria` | object | **Yes** | Filter criteria |
| `action` | object | **Yes** | Filter action |

### `gmail` / `settings.filters.delete`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filterId` | string | **Yes** | Filter ID |

### `gmail` / `settings.forwarding`

Get or set forwarding addresses.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `set` | boolean | No | `true` to add address |
| `email` | string | Conditional | Email address (required if `set: true`) |

### `gmail` / `settings.sendAs`

List send-as aliases.

**Response:** `{ sendAs: [...] }`

### `gmail` / `settings.delegates`

List, add, or remove delegates.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `add` | string | No | Email to add as delegate |
| `remove` | string | No | Email to remove as delegate |

---

## Calendar

### `calendar` / `events.list`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `calendarId` | string | No | `primary` | Calendar ID |
| `max` | number | No | 25 | Max events (1-250) |
| `timeMin` | string | No | — | Start time (ISO 8601) |
| `timeMax` | string | No | — | End time (ISO 8601) |
| `query` | string | No | — | Text search |
| `orderBy` | string | No | `startTime` | Sort order |
| `pageToken` | string | No | — | Pagination token |

**Response:** `{ events: [...], count, nextPageToken }`

### `calendar` / `events.get`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | **Yes** | Event ID |
| `calendarId` | string | No | `primary` |

### `calendar` / `events.create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `summary` | string | **Yes** | Event title |
| `start` | string | **Yes** | Start time (ISO 8601 or date `YYYY-MM-DD`) |
| `end` | string | **Yes** | End time |
| `calendarId` | string | No | `primary` |
| `description` | string | No | Event description |
| `location` | string | No | Location |
| `allDay` | boolean | No | All-day event |
| `attendees` | string[] | No | Attendee emails |
| `recurrence` | string[] | No | RRULE strings |
| `reminders` | array | No | `[{method, minutes}]` |
| `colorId` | string | No | Color ID |
| `visibility` | string | No | `default`, `public`, `private` |
| `sendUpdates` | string | No | `all`, `externalOnly`, `none` |
| `timeZone` | string | No | `UTC` |

### `calendar` / `events.update`

Same parameters as `events.create` plus:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | **Yes** | Event ID to update |

Only provided fields are updated.

### `calendar` / `events.delete`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | **Yes** | Event ID |
| `calendarId` | string | No | `primary` |
| `sendUpdates` | string | No | Notification preference |

### `calendar` / `events.respond`

Respond to an event invitation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | **Yes** | Event ID |
| `response` | string | **Yes** | `accepted`, `declined`, or `tentative` |
| `calendarId` | string | No | `primary` |
| `sendUpdates` | string | No | Notification preference |

### `calendar` / `events.propose`

Propose a new time for an event (responds as tentative).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | **Yes** | Event ID |
| `start` | string | **Yes** | Proposed start time |
| `end` | string | **Yes** | Proposed end time |
| `calendarId` | string | No | `primary` |
| `comment` | string | No | Additional comment |

### `calendar` / `events.conflicts`

Find conflicting events in a time range.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start` | string | **Yes** | Range start (ISO 8601) |
| `end` | string | **Yes** | Range end |
| `calendarId` | string | No | `primary` |

**Response:** `{ conflicts: [...], count }`

### `calendar` / `freebusy`

Query free/busy information.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `timeMin` | string | **Yes** | Start time (ISO 8601) |
| `timeMax` | string | **Yes** | End time |
| `calendars` | string[] | No | `["primary"]` |

**Response:** `{ calendars: { "primary": { busy: [...], errors: [...] } } }`

### `calendar` / `calendars.list`

List all calendars.

**Response:** `{ calendars: [{id, summary, description, primary, accessRole, backgroundColor, timeZone}] }`

---

## Drive

### `drive` / `list`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `max` | number | No | 25 | Max files (1-100) |
| `folderId` | string | No | — | List files in folder |
| `mimeType` | string | No | — | Filter by MIME type |
| `query` | string | No | — | Drive query string |
| `orderBy` | string | No | — | Sort order |
| `pageToken` | string | No | — | Pagination token |

**Response:** `{ files: [...], count, nextPageToken }`

### `drive` / `search`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | **Yes** | Drive search query |
| `max` | number | No | 25 |
| `orderBy` | string | No | `modifiedDate desc` |
| `pageToken` | string | No | Pagination |

### `drive` / `get`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | **Yes** | File ID |

**Response:** `{ fileId, name, mimeType, size, createdDate, modifiedDate, owners, webViewLink, parents, shared }`

### `drive` / `download`

Download file content. Google Workspace files are auto-exported.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | **Yes** | File ID |
| `exportMimeType` | string | No | Override export format for Workspace files |

**Response:** `{ name, mimeType, content, encoding }` (encoding is `utf-8` for text, `base64` for binary)

### `drive` / `upload`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | **Yes** | File name |
| `content` | string | **Yes** | File content |
| `mimeType` | string | No | `application/octet-stream` |
| `encoding` | string | No | `base64` for binary content |
| `folderId` | string | No | Destination folder ID |
| `description` | string | No | File description |
| `convert` | boolean | No | Convert to Google format |

### `drive` / `copy`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | **Yes** | File ID to copy |
| `name` | string | No | New file name |
| `folderId` | string | No | Destination folder |

### `drive` / `delete`

Moves file to trash.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | **Yes** | File ID |

### `drive` / `export`

Export a Google Workspace file to a different format.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | **Yes** | File ID |
| `format` | string | **Yes** | Target format: `pdf`, `docx`, `xlsx`, `pptx`, `csv`, `txt`, `html`, `png`, `svg` |

### `drive` / `permissions.list`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | **Yes** | File ID |

### `drive` / `permissions.create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | **Yes** | File ID |
| `role` | string | **Yes** | `reader`, `writer`, `commenter`, `owner` |
| `type` | string | **Yes** | `user`, `group`, `domain`, `anyone` |
| `emailAddress` | string | No | Email (for user/group type) |
| `domain` | string | No | Domain (for domain type) |
| `sendNotificationEmails` | boolean | No | Send notification |

### `drive` / `permissions.delete`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | **Yes** | File ID |
| `permissionId` | string | **Yes** | Permission ID |

### `drive` / `mkdir`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | **Yes** | Folder name |
| `parentId` | string | No | Parent folder ID |

### `drive` / `drives.list`

List shared drives.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `max` | number | No | 25 | Max results (1-100) |
| `pageToken` | string | No | — | Pagination |

### `drive` / `comments.list`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | **Yes** | File ID |
| `max` | number | No | 25 |

---

## Docs

### `docs` / `get`

Get document metadata.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | **Yes** | Document ID |

**Response:** `{ documentId, title, revisionId, body: { contentLength } }`

### `docs` / `cat`

Read document text content.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | **Yes** | Document ID |
| `maxBytes` | number | No | Max chars to return (default: 100000, max: 500000) |

**Response:** `{ documentId, title, content, truncated }`

### `docs` / `create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | No | Document title |
| `content` | string | No | Initial text content |
| `folderId` | string | No | Destination folder |

### `docs` / `copy`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | **Yes** | Source document ID |
| `name` | string | No | Copy name |
| `folderId` | string | No | Destination folder |

### `docs` / `export`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | **Yes** | Document ID |
| `format` | string | No | `pdf`, `docx`, `txt`, `html` (default: `pdf`) |

---

## Sheets

### `sheets` / `get`

Get spreadsheet metadata.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | **Yes** | Spreadsheet ID |

**Response:** `{ spreadsheetId, title, locale, timeZone, sheets: [{sheetId, title, index, rowCount, columnCount}], url }`

### `sheets` / `read`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | **Yes** | Spreadsheet ID |
| `range` | string | **Yes** | A1 notation (e.g., `Sheet1!A1:D10`) |
| `valueRenderOption` | string | No | `FORMATTED_VALUE`, `UNFORMATTED_VALUE`, `FORMULA` |
| `dateTimeRenderOption` | string | No | `SERIAL_NUMBER`, `FORMATTED_STRING` |

**Response:** `{ range, values: [[...]], majorDimension }`

### `sheets` / `write` (alias: `update`)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | **Yes** | Spreadsheet ID |
| `range` | string | **Yes** | A1 notation |
| `values` | array[][] | **Yes** | 2D array of values |
| `valueInputOption` | string | No | `USER_ENTERED` (default), `RAW` |
| `majorDimension` | string | No | `ROWS` (default), `COLUMNS` |

### `sheets` / `append`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | **Yes** | Spreadsheet ID |
| `range` | string | **Yes** | A1 notation (append after this range) |
| `values` | array[][] | **Yes** | 2D array of values |
| `valueInputOption` | string | No | `USER_ENTERED` (default), `RAW` |
| `insertDataOption` | string | No | `INSERT_ROWS` (default), `OVERWRITE` |

### `sheets` / `clear`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | **Yes** | Spreadsheet ID |
| `range` | string | **Yes** | A1 notation |

### `sheets` / `create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | No | Spreadsheet title |
| `sheets` | array | No | `[{title: "Sheet1"}]` |
| `folderId` | string | No | Destination folder |

### `sheets` / `copy`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | **Yes** | Source spreadsheet ID |
| `name` | string | No | Copy name |
| `folderId` | string | No | Destination folder |

### `sheets` / `export`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | **Yes** | Spreadsheet ID |
| `format` | string | No | `pdf`, `xlsx`, `csv` (default: `pdf`) |

### `sheets` / `format`

Execute batch update requests (formatting, merging, etc.).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | **Yes** | Spreadsheet ID |
| `requests` | array | **Yes** | Array of Sheets API batchUpdate request objects |

---

## Slides

### `slides` / `get`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `presentationId` | string | **Yes** | Presentation ID |

**Response:** `{ presentationId, title, locale, slideCount, slides: [{objectId, index, pageElements}], pageSize }`

### `slides` / `create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | No | Presentation title |
| `folderId` | string | No | Destination folder |

### `slides` / `copy`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `presentationId` | string | **Yes** | Source presentation ID |
| `name` | string | No | Copy name |
| `folderId` | string | No | Destination folder |

### `slides` / `export`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `presentationId` | string | **Yes** | Presentation ID |
| `format` | string | No | `pdf`, `pptx` (default: `pdf`) |

---

## Contacts

Uses the People API (not the deprecated Contacts API).

### `contacts` / `list`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `max` | number | No | 25 | Max contacts (1-100) |
| `sortOrder` | string | No | `LAST_MODIFIED_DESCENDING` | Sort order |
| `pageToken` | string | No | — | Pagination |

**Response:** `{ contacts: [...], count, nextPageToken, totalPeople }`

### `contacts` / `search`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | **Yes** | Search query (name, email, etc.) |
| `max` | number | No | 25 (max 30) |

### `contacts` / `get`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resourceName` | string | **Yes** | e.g., `people/c12345` |

### `contacts` / `create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `givenName` | string | No | First name |
| `familyName` | string | No | Last name |
| `email` | string | No | Email address |
| `emailType` | string | No | `home`, `work` |
| `phone` | string | No | Phone number |
| `phoneType` | string | No | `mobile`, `home`, `work` |
| `organization` | string | No | Organization name |
| `jobTitle` | string | No | Job title |

### `contacts` / `update`

Same parameters as `create` plus:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resourceName` | string | **Yes** | Contact resource name |

### `contacts` / `delete`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resourceName` | string | **Yes** | Contact resource name |

### `contacts` / `other.list`

List "other contacts" (auto-saved from interactions).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `max` | number | No | 25 |
| `pageToken` | string | No | Pagination |

### `contacts` / `other.search`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | **Yes** | Search query |
| `max` | number | No | 25 |

---

## Tasks

### `tasks` / `tasklists.list`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `max` | number | No | 25 | Max lists (1-100) |
| `pageToken` | string | No | — | Pagination |

**Response:** `{ tasklists: [{tasklistId, title, updated}], count, nextPageToken }`

### `tasks` / `list`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tasklistId` | string | No | `@default` | Task list ID |
| `max` | number | No | 50 | Max tasks (1-100) |
| `showCompleted` | boolean | No | true | Include completed tasks |
| `showHidden` | boolean | No | false | Include hidden tasks |
| `dueMin` | string | No | — | Due date min (ISO 8601) |
| `dueMax` | string | No | — | Due date max |
| `pageToken` | string | No | — | Pagination |

### `tasks` / `get`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | **Yes** | Task ID |
| `tasklistId` | string | No | `@default` |

### `tasks` / `create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | **Yes** | Task title |
| `tasklistId` | string | No | `@default` |
| `notes` | string | No | Task notes |
| `due` | string | No | Due date (ISO 8601) |
| `parent` | string | No | Parent task ID (for subtasks) |
| `previous` | string | No | Previous task ID (for ordering) |

### `tasks` / `update`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | **Yes** | Task ID |
| `tasklistId` | string | No | `@default` |
| `title` | string | No | Updated title |
| `notes` | string | No | Updated notes |
| `due` | string | No | Updated due date |
| `status` | string | No | `needsAction` or `completed` |

### `tasks` / `done`

Mark a task as completed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | **Yes** | Task ID |
| `tasklistId` | string | No | `@default` |

### `tasks` / `undo`

Mark a completed task as incomplete.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | **Yes** | Task ID |
| `tasklistId` | string | No | `@default` |

### `tasks` / `delete`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | **Yes** | Task ID |
| `tasklistId` | string | No | `@default` |

### `tasks` / `clear`

Clear all completed tasks from a list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tasklistId` | string | No | `@default` |

---

## People

Directory search (Workspace accounts).

### `people` / `get`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resourceName` | string | **Yes** | e.g., `people/12345` |

### `people` / `search`

Search the organization directory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | **Yes** | Name or email query |
| `max` | number | No | 10 (max 30) |

**Response:** `{ people: [...], count, nextPageToken }`

---

## Groups

Workspace only. Uses Admin Directory API.

### `groups` / `list`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `max` | number | No | 25 | Max groups (1-200) |
| `domain` | string | No | — | Filter by domain |
| `userKey` | string | No | current user | Filter by user |
| `pageToken` | string | No | — | Pagination |

**Response:** `{ groups: [{groupId, email, name, description, directMembersCount, adminCreated}], count, nextPageToken }`

### `groups` / `members`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupKey` | string | **Yes** | Group email or ID |
| `max` | number | No | 50 |
| `roles` | string | No | Filter by role |
| `pageToken` | string | No | Pagination |

**Response:** `{ members: [{email, role, type, status}], count, nextPageToken }`

---

## Chat

Workspace only.

### `chat` / `spaces.list`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `max` | number | No | 25 | Max spaces (1-100) |
| `filter` | string | No | — | Space filter |
| `pageToken` | string | No | — | Pagination |

### `chat` / `spaces.find`

Find spaces by display name.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | **Yes** | Display name to search (case-insensitive partial match) |

### `chat` / `spaces.create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `displayName` | string | **Yes** | Space name |
| `spaceType` | string | No | `SPACE` (default) |

### `chat` / `messages.list`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spaceName` | string | **Yes** | Space resource name (e.g., `spaces/abc123`) |
| `max` | number | No | 25 |
| `filter` | string | No | Message filter |
| `orderBy` | string | No | Sort order |
| `pageToken` | string | No | Pagination |

### `chat` / `messages.send`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spaceName` | string | **Yes** | Space resource name |
| `text` | string | **Yes** | Message text |
| `threadKey` | string | No | Thread key for threaded messages |

### `chat` / `messages.dm`

Send a direct message to a user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | **Yes** | User ID |
| `text` | string | **Yes** | Message text |

**Response:** `{ spaceName, message: {...} }`

---

## Classroom

Workspace only.

### `classroom` / `courses.list`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `max` | number | No | 25 | Max courses (1-100) |
| `studentId` | string | No | — | Filter by student |
| `teacherId` | string | No | — | Filter by teacher |
| `courseStates` | string[] | No | — | Filter by state |
| `pageToken` | string | No | — | Pagination |

### `classroom` / `courses.get`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `courseId` | string | **Yes** | Course ID |

### `classroom` / `courses.create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | **Yes** | Course name |
| `section` | string | No | Section |
| `description` | string | No | Description |
| `room` | string | No | Room |
| `ownerId` | string | No | Owner ID |

### `classroom` / `roster.list`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `courseId` | string | **Yes** | Course ID |
| `role` | string | No | `student`, `teacher`, or `both` (default) |
| `max` | number | No | 50 |

**Response:** `{ students: [...], teachers: [...] }`

### `classroom` / `coursework.list`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `courseId` | string | **Yes** | Course ID |
| `max` | number | No | 25 |
| `courseWorkStates` | string[] | No | Filter by state |
| `pageToken` | string | No | Pagination |

### `classroom` / `coursework.create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `courseId` | string | **Yes** | Course ID |
| `title` | string | **Yes** | Assignment title |
| `workType` | string | No | `ASSIGNMENT` (default) |
| `state` | string | No | `PUBLISHED` (default) |
| `description` | string | No | Description |
| `maxPoints` | number | No | Maximum points |
| `dueDate` | object | No | `{year, month, day}` |
| `dueTime` | object | No | `{hours, minutes}` |

### `classroom` / `announcements.list`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `courseId` | string | **Yes** | Course ID |
| `max` | number | No | 25 |
| `announcementStates` | string[] | No | Filter by state |
| `pageToken` | string | No | Pagination |

### `classroom` / `announcements.create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `courseId` | string | **Yes** | Course ID |
| `text` | string | **Yes** | Announcement text |
| `state` | string | No | `PUBLISHED` (default) |

### `classroom` / `submissions.list`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `courseId` | string | **Yes** | Course ID |
| `courseWorkId` | string | **Yes** | Coursework ID |
| `max` | number | No | 50 |
| `states` | string[] | No | Filter by state |
| `pageToken` | string | No | Pagination |

---

## Admin

Proxy administration.

### `admin` / `health`

Health check. No parameters.

**Response:** `{ status, timestamp, version, configured, services, config }`

### `admin` / `config.get`

Get all configuration values (secrets are redacted).

**Response:** `{ config: { JWT_SECRET: "****xxxx", ... } }`

### `admin` / `config.set`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | **Yes** | Config key |
| `value` | string | **Yes** | Config value |

### `admin` / `log.status`

Get logging status and statistics.

**Response:** `{ configured, logEnabled, sheetId, rows, maxRows, lastEntry }`

### `admin` / `log.clear`

Clear all log entries (keeps header row).

### `admin` / `ip.list`

List IP allowlist entries.

**Response:** `{ ips: [...], count }`

### `admin` / `ip.add`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ip` | string | **Yes** | IP address or CIDR (e.g., `1.2.3.4` or `10.0.0.0/8`) |

### `admin` / `ip.remove`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ip` | string | **Yes** | IP address or CIDR to remove |
