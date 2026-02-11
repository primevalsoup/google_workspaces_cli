# Apps Script Proxy Setup

Step-by-step guide for deploying the GProxy proxy as a Google Apps Script web app.

## 1. Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **New project**
3. Name it "GProxy" (click "Untitled project" at the top)

## 2. Create the Files

Delete the default `Code.gs` content, then create each file:

### Core Files (in project root)

| File | Source |
|------|--------|
| `Code.gs` | Copy from `proxy/Code.gs` |
| `Auth.gs` | Copy from `proxy/Auth.gs` |
| `Config.gs` | Copy from `proxy/Config.gs` |
| `Router.gs` | Copy from `proxy/Router.gs` |
| `Logger.gs` | Copy from `proxy/Logger.gs` |
| `Utils.gs` | Copy from `proxy/Utils.gs` |

### Service Files

Create each service handler file:

| File | Source |
|------|--------|
| `Gmail.gs` | Copy from `proxy/services/Gmail.gs` |
| `Calendar.gs` | Copy from `proxy/services/Calendar.gs` |
| `Drive.gs` | Copy from `proxy/services/Drive.gs` |
| `Docs.gs` | Copy from `proxy/services/Docs.gs` |
| `Sheets.gs` | Copy from `proxy/services/Sheets.gs` |
| `Slides.gs` | Copy from `proxy/services/Slides.gs` |
| `Contacts.gs` | Copy from `proxy/services/Contacts.gs` |
| `Tasks.gs` | Copy from `proxy/services/Tasks.gs` |
| `People.gs` | Copy from `proxy/services/People.gs` |
| `Groups.gs` | Copy from `proxy/services/Groups.gs` |
| `Chat.gs` | Copy from `proxy/services/Chat.gs` |
| `Classroom.gs` | Copy from `proxy/services/Classroom.gs` |
| `Admin.gs` | Copy from `proxy/services/Admin.gs` |

To create a new file: click **+** next to Files → **Script**.

Note: Apps Script does not support subdirectories. All `.gs` files go in the project root.

## 3. Update the Manifest

1. In the Apps Script editor, click the gear icon (**Project Settings**)
2. Check **Show "appsscript.json" manifest file in editor**
3. Go back to the editor and open `appsscript.json`
4. Replace its contents with the content from `proxy/appsscript.json`

This configures:
- Required OAuth scopes
- Advanced Services
- Web app execution settings

## 4. Enable Advanced Services

1. In the Apps Script editor, click the gear icon (**Project Settings**)
2. Scroll to **Google Advanced Services** (or use the sidebar: **Services**)
3. Enable each of the following:

| Service | Identifier | Version |
|---------|-----------|---------|
| Gmail API | `Gmail` | v1 |
| Google Calendar API | `Calendar` | v3 |
| Google Drive API | `Drive` | v3 |
| Google Docs API | `Docs` | v1 |
| Google Sheets API | `Sheets` | v4 |
| Google Slides API | `Slides` | v1 |
| People API | `People` | v1 |
| Tasks API | `Tasks` | v1 |
| Admin SDK Directory API | `AdminDirectory` | directory_v1 |
| Google Chat API | `Chat` | v1 |
| Google Classroom API | `Classroom` | v1 |

**Notes:**
- The People API identifier in Apps Script is `People`, mapped to service ID `peopleapi`
- AdminDirectory is only available on Google Workspace accounts
- Chat and Classroom are only available on Google Workspace accounts
- If you don't need a service, you can skip enabling it (requests to that service will fail with a service error)

## 5. Set Script Properties

1. Click the gear icon (**Project Settings**)
2. Scroll to **Script Properties**
3. Click **Add script property** for each:

| Property | Value | Required |
|----------|-------|----------|
| `JWT_SECRET` | Your shared secret (32+ bytes, e.g., from `openssl rand -base64 48`) | **Yes** |
| `IP_ALLOWLIST` | Comma-separated IPs/CIDRs (e.g., `1.2.3.4,10.0.0.0/8`) | No |
| `LOG_ENABLED` | `true` or `false` (default: `true`) | No |
| `LOG_SHEET_ID` | Google Sheets ID for logging | No |
| `LOG_MAX_ROWS` | Max log rows before rotation (default: `5000`) | No |
| `IP_CHECK_ENABLED` | `true` to enable AbuseIPDB (default: `false`) | No |
| `IP_CHECK_API_KEY` | AbuseIPDB API key | No |
| `IP_CHECK_THRESHOLD` | Abuse confidence threshold (default: `50`) | No |

**Important:** The `JWT_SECRET` must exactly match the secret configured in the CLI. No trailing whitespace or newlines.

## 6. Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon next to "Select type" → choose **Web app**
3. Configure:
   - **Description**: "GProxy v1.0.0" (optional)
   - **Execute as**: **Me** (your Google account)
   - **Who has access**: **Anyone**
4. Click **Deploy**
5. **Authorize access** when prompted — review and grant the requested permissions
6. Copy the **Web app URL** — this is your proxy URL

The URL looks like:
```
https://script.google.com/macros/s/AKfycb.../exec
```

## 7. Test the Deployment

### Health Check (Browser)

Open the web app URL in your browser. You should see:

```json
{"ok":true,"data":{"status":"healthy","timestamp":"...","version":"1.0.0","configured":true}}
```

### Health Check (CLI)

```bash
gproxy admin health --proxy-url "YOUR_URL" --secret "YOUR_SECRET"
```

### Send a Test Request (curl)

```bash
# This will fail with AUTH_FAILED since we're not sending a valid JWT,
# but it confirms the endpoint is reachable:
curl -X POST "YOUR_URL" \
  -H "Content-Type: application/json" \
  -d '{"jwt":"invalid","service":"admin","action":"health"}'
```

Expected: `{"ok":false,"error":{"code":"AUTH_FAILED","message":"Invalid signature","retryable":false},...}`

## 8. Updating the Deployment

When you modify the code:

1. Make your changes in the Apps Script editor
2. Click **Deploy** → **Manage deployments**
3. Click the pencil icon on your deployment
4. Change **Version** to **New version**
5. Click **Deploy**

**Important:** After updating, the URL stays the same. Clients don't need reconfiguration.

Alternatively, with clasp:
```bash
clasp push && clasp deploy -d "v1.0.1"
```

## Troubleshooting

### "Authorization required"
Re-deploy the web app. This re-triggers the OAuth consent flow for any new scopes.

### "Service not enabled"
Check that the required Advanced Service is enabled in Project Settings → Services.

### "Cannot read property of null"
The service might not be available for your account type (e.g., AdminDirectory requires Workspace).

### Slow first request
Apps Script cold starts can take 2-5 seconds. This is normal and affects only the first request after a period of inactivity.
