# GProxy

**Google Workspace CLI via Apps Script Proxy**

Access Gmail, Calendar, Drive, Docs, Sheets, Slides, Contacts, Tasks, People, Groups, Chat, and Classroom from the command line — no OAuth setup, no GCP project required.

## Architecture

```
┌─────────────┐       HTTPS + JWT       ┌──────────────────────┐
│             │  ──────────────────────► │  Google Apps Script   │
│  gproxy CLI │                          │  (Web App / doPost)   │
│  (Node.js)  │  ◄────────────────────  │                       │
│             │       JSON response      │  ┌─────────────────┐ │
└─────────────┘                          │  │  Auth.gs (JWT)   │ │
                                         │  │  Router.gs       │ │
   Runs on your                          │  │  13 Services     │ │
   local machine                         │  │  Logger.gs       │ │
                                         │  └─────────────────┘ │
                                         │                       │
                                         │  Calls Google APIs    │
                                         │  as deploying user    │
                                         └──────────────────────┘
```

## Why This Architecture

- **No OAuth on client** — the CLI sends a JWT; the Apps Script proxy handles Google API auth automatically
- **No GCP project setup** — Apps Script runs under your Google account with no Cloud Console configuration
- **Zero-trust design** — every request is authenticated with a shared secret (HS256 JWT, 5-minute expiry)
- **Runtime-configurable** — change allowed IPs, logging, and secrets via Script Properties without redeploying

## Features

| Service | Actions |
|---------|---------|
| **Gmail** | search, read, send, labels, drafts, attachments, settings (vacation, filters, forwarding, delegates) |
| **Calendar** | events (list, create, update, delete, respond, conflicts), freebusy, calendars list |
| **Drive** | list, search, get, upload, download, copy, delete, export, permissions, mkdir, shared drives, comments |
| **Docs** | get, cat (read text), create, copy, export (pdf/docx/txt/html) |
| **Sheets** | get, read, write, append, clear, create, copy, export, format |
| **Slides** | get, create, copy, export (pdf/pptx) |
| **Contacts** | list, search, get, create, update, delete, other contacts |
| **Tasks** | tasklists, list, get, create, update, done, undo, delete, clear |
| **People** | get, search (directory) |
| **Groups** | list, members (Workspace only) |
| **Chat** | spaces (list, find, create), messages (list, send, dm) (Workspace only) |
| **Classroom** | courses, roster, coursework, announcements, submissions (Workspace only) |
| **Admin** | health, config, logs, IP allowlist |

## Quick Start

```bash
# Install
npm install -g @primevalsoup/gwspace-cli

# Deploy the Apps Script proxy (interactive installer)
gproxy deploy

# Or configure manually if proxy is already deployed
gproxy setup

# Verify
gproxy admin health
```

## Usage Examples

```bash
# Gmail
gproxy gmail search --query "is:unread"
gproxy gmail send --to "alice@example.com" --subject "Hello" --body "Hi there"
gproxy gmail read --threadId "18abc..."

# Calendar
gproxy calendar events.list --timeMin "2026-02-10T00:00:00Z"
gproxy calendar events.create --summary "Meeting" --start "2026-02-11T10:00:00Z" --end "2026-02-11T11:00:00Z"

# Drive
gproxy drive list
gproxy drive upload --name "report.txt" --content "Hello World"
gproxy drive search --query "name contains 'budget'"

# Docs
gproxy docs cat --documentId "1abc..."
gproxy docs create --title "New Document" --content "Initial text"

# Sheets
gproxy sheets read --spreadsheetId "1abc..." --range "Sheet1!A1:D10"
gproxy sheets write --spreadsheetId "1abc..." --range "A1" --values '[["a","b"],["c","d"]]'

# Tasks
gproxy tasks list
gproxy tasks create --title "Buy groceries"
gproxy tasks done --taskId "abc123"

# Output formats
gproxy gmail search --query "is:inbox" --json    # JSON output
gproxy gmail search --query "is:inbox" --plain   # No colors
```

## Global Options

| Flag | Environment Variable | Description |
|------|---------------------|-------------|
| `--proxy-url <url>` | `GPROXY_URL` | Apps Script web app URL (must be HTTPS) |
| `--secret <key>` | `GPROXY_SECRET` | JWT shared secret |
| `--json` | — | Output as JSON |
| `--plain` | — | Output as plain text (no ANSI colors) |
| `--verbose` | — | Show request/response details on stderr |
| `--timeout <ms>` | — | Request timeout (default: 330000ms / 5.5min) |
| `--retry <n>` | — | Max retries (default: 3) |

Configuration priority: **CLI flags > environment variables > config file** (`~/.gproxy/config.json`).

## Security Model

- **JWT authentication**: HS256 with 5-minute expiry and unique JTI per request
- **Shared secret**: 32+ bytes, cryptographic random
- **Constant-time comparison**: Signature verification resists timing attacks
- **HTTPS only**: CLI rejects non-HTTPS proxy URLs
- **IP allowlisting**: Optional defense-in-depth layer (client-reported)
- **Content redaction**: Logger never records request parameters (email bodies, file content)

See [docs/SECURITY.md](docs/SECURITY.md) for the full security model and threat analysis.

## Documentation

- [Quickstart](docs/QUICKSTART.md) — Step-by-step deploy walkthrough with every screen
- [Architecture](docs/ARCHITECTURE.md) — Data flow, Apps Script constraints, design decisions
- [Security](docs/SECURITY.md) — JWT details, threat model, IP allowlisting
- [API Reference](docs/API.md) — Every service, action, and parameter documented
- [Deployment Guide](docs/DEPLOYMENT.md) — End-to-end setup for proxy and CLI
- [Apps Script Setup](proxy/SETUP.md) — Step-by-step proxy deployment guide

## Requirements

- **Node.js** 18.0.0 or later
- **Google Account** (personal or Workspace)
- Workspace accounts required for: Groups, Chat, Classroom

## License

[MIT](LICENSE)
