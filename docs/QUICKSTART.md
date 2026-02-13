# Quickstart

Complete walkthrough of deploying GProxy from scratch. Every step, every screen.

## Prerequisites

| Requirement | Check |
|-------------|-------|
| Node.js 18+ | `node --version` |
| clasp installed | `npm install -g @google/clasp` |
| clasp logged in | `clasp login` |
| Apps Script API enabled | [script.google.com/home/usersettings](https://script.google.com/home/usersettings) |

## Install

```bash
npm install -g @primevalsoup/gwspace-cli
```

## Deploy

```bash
gproxy deploy
```

The installer walks you through 5 steps. Here's what to expect.

---

### Step 1/5 — Preflight checks

The CLI verifies clasp is installed, you're logged in, and the Apps Script API is enabled.

```
  GProxy Deploy
  Automated Apps Script proxy installer

[1/5] Checking prerequisites...
  Checking clasp installation...
  clasp 2.4.1
  Checking clasp login...
  Logged in
  Checking Apps Script API...
  Apps Script API enabled
  All checks passed
```

If the Apps Script API is not enabled, the CLI will offer to open the settings page for you.

---

### Step 2/5 — Configuration

You'll answer four prompts:

**Project name** (default: GProxy)
```
? Project name › GProxy
```

**Service selection** — use space to toggle, enter to confirm:
```
? Select services to enable
  ◉ Gmail     — Search, read, send, labels, drafts, attachments, settings
  ◉ Calendar  — Events, freebusy, calendars
  ◉ Drive     — List, search, upload, download, permissions, export
  ◯ Docs      — Get, read text, create, copy, export
  ◯ Sheets    — Read, write, append, clear, format, export
  ...
```

**JWT secret** — auto-generated (press enter to accept):
```
? JWT shared secret › ••••••••••••••••••••••••••••••••
```

**Timezone** — defaults to your system timezone:
```
? Timezone › America/New_York
```

Then you'll see a summary and confirm:
```
  Deployment Summary
  ─────────────────────────────────
  Project:   GProxy
  Services:  Gmail, Calendar, Drive
  Timezone:  America/New_York
  Secret:    a1b2c3d4...

? Proceed with deployment? (Y/n)
```

---

### Step 3/5 — Generate files

The CLI generates all `.gs` files and the Apps Script manifest in a temporary staging directory. Nothing is deployed yet.

```
[3/5] Generating project files...
  Files: 19
    Code.gs
    Auth.gs
    Router.gs
    Gmail.gs
    Calendar.gs
    ...
    appsscript.json
```

---

### Step 4/5 — Deploy to Apps Script

This is where the real work happens. The CLI creates an Apps Script project, pushes your files, and creates a deployment.

```
[4/5] Deploying to Apps Script...
  Creating Apps Script project...
  Script ID: 1abc...xyz
  Pushing files (init window active)...
  Creating initial deployment...
  Setting JWT_SECRET via init endpoint...
```

#### If authorization is needed

Most first-time deploys require you to authorize the app. The CLI will open your browser to the Apps Script editor:

```
  Authorization required before setting JWT_SECRET.
  Opening the Apps Script editor...
  Please select the doGet function and click "Run" to trigger authorization.
  Then approve the permissions in the popup.
```

**In the Apps Script editor:** select the `doGet` function from the dropdown and click **Run**. This triggers the Google OAuth consent flow. You'll see several screens in your browser:

#### Screen 1 — "Google hasn't verified this app"

This is expected — you own the app, it's just not Google-verified (and doesn't need to be).

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ⚠  Google hasn't verified this app                   │
│                                                         │
│   The app is requesting access to sensitive info in     │
│   your Google Account. Until the developer              │
│   (you@gmail.com) verifies this app with Google,        │
│   you shouldn't use it.                                 │
│                                                         │
│                                                         │
│   [Advanced]                        [ BACK TO SAFETY ]  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Click **Advanced** to expand the options.

#### Screen 2 — "Go to GProxy (unsafe)"

After clicking Advanced, a link appears at the bottom:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ⚠  Google hasn't verified this app                   │
│                                                         │
│   The app is requesting access to sensitive info in     │
│   your Google Account. Until the developer              │
│   (you@gmail.com) verifies this app with Google,        │
│   you shouldn't use it.                                 │
│                                                         │
│                                                         │
│   [Hide Advanced]                   [ BACK TO SAFETY ]  │
│                                                         │
│   Continue only if you understand the risks and trust   │
│   the developer (you@gmail.com).                        │
│                                                         │
│   Go to GProxy (unsafe)                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Click **Go to GProxy (unsafe)**. This is safe — you are the developer.

#### Screen 3 — Select permissions

Google asks which permissions to grant. The scopes depend on which services you selected during configuration.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   GProxy wants to access your Google Account            │
│   you@gmail.com                                         │
│                                                         │
│   Select what GProxy can access                         │
│                                                         │
│   ☐ Select all                                          │
│                                                         │
│   📅 See, edit, share, and permanently delete all       │
│      the calendars you can access using Google          │
│      Calendar.                                          │
│                                                         │
│   🔵 See and edit your email labels.                    │
│                                                         │
│   ✉️  Read, compose, and send emails from your          │
│      Gmail account.                                     │
│                                                         │
│   🔗 Connect to an external service.                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Check **Select all**, then scroll down.

#### Screen 4 — Confirm

After selecting all permissions, click **Continue** to grant access.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   GProxy wants to access your Google Account            │
│   you@gmail.com                                         │
│                                                         │
│   ⚠ This app hasn't been verified by Google.            │
│   You should continue only if you know and trust        │
│   the app developer.                                    │
│                                                         │
│   Select what GProxy can access                         │
│                                                         │
│   ☑ Select all                                          │
│                                                         │
│   ☑ 📅 See, edit, share... Google Calendar.             │
│   ☑ 🔵 See and edit your email labels.                  │
│   ☑ ✉️  Read, compose, and send emails...               │
│   ☑ 🔗 Connect to an external service.                  │
│                                                         │
│   Make sure you trust GProxy                            │
│                                                         │
│            [ Cancel ]       [ Continue ]                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Click **Continue**.

#### Back in the terminal

After authorizing in the browser, return to your terminal and confirm:

```
? I've authorized the app — continue? (Y/n)
```

The CLI retries setting the JWT secret and finishes the deployment:

```
  Retrying JWT_SECRET setup...
  JWT_SECRET set successfully
  Pushing final files (init window removed)...
  Creating final deployment...
  Deployment ID: AKfycb...456
  CLI config saved to ~/.gproxy/config.json
```

---

### Step 5/5 — Health check

The CLI verifies the deployed proxy is responding:

```
[5/5] Verifying deployment...
  Proxy is healthy (v1.0.0)
```

If the health check fails on the first attempt, that's normal — Apps Script cold starts can take a few seconds. The CLI retries up to 3 times.

---

### Success

```
  Deployment successful!

  Web App URL:
  https://script.google.com/macros/s/AKfycb.../exec

  JWT Secret:
  a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...

  JWT_SECRET has been set in Script Properties automatically.

  Verify the deployment:
    gproxy admin health
```

Your proxy is live. The CLI config (`~/.gproxy/config.json`) is already saved — no further setup needed.

---

## Verify

```bash
gproxy admin health
```

Expected:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "configured": true
}
```

## Next steps

- See [Usage Examples](../README.md#usage-examples) for common commands
- See [Deployment Guide](DEPLOYMENT.md) for advanced configuration (IP allowlisting, logging, clasp workflows)
- See [API Reference](API.md) for every service, action, and parameter
