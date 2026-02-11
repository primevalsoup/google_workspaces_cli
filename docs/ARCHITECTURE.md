# Architecture

## Overview

GProxy uses Google Apps Script as a proxy between the CLI and Google Workspace APIs. The CLI authenticates with a shared-secret JWT and sends structured JSON requests. The Apps Script web app verifies the JWT, routes the request to the appropriate service handler, and returns the result.

## Data Flow

```
┌──────────┐                              ┌─────────────────────────────────────────┐
│          │  1. POST (HTTPS + JWT)       │  Google Apps Script Web App              │
│  gproxy  │ ──────────────────────────►  │                                         │
│   CLI    │                              │  2. doPost(e) → parse body               │
│          │                              │  3. verifyJwt(token) → HS256 check       │
│          │                              │  4. checkIp(clientIp) → allowlist        │
│          │                              │  5. routeRequest(service, action, params)│
│          │  8. JSON response            │  6. ServiceHandler(action, params)       │
│          │ ◄────────────────────────── │  7. logRequest(...) → Sheets logger      │
└──────────┘                              └─────────────────────────────────────────┘
                                                         │
                                                         ▼
                                          ┌──────────────────────────┐
                                          │  Google Workspace APIs    │
                                          │  (Gmail, Calendar, Drive, │
                                          │   Docs, Sheets, etc.)    │
                                          └──────────────────────────┘
```

### Request Format

```json
{
  "jwt": "eyJhbGc...",
  "service": "gmail",
  "action": "search",
  "params": { "query": "is:unread", "max": 10 },
  "clientIp": "1.2.3.4"
}
```

### Response Format

**Success:**
```json
{
  "ok": true,
  "data": { "threads": [...], "count": 5 },
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Error:**
```json
{
  "ok": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Token expired",
    "retryable": false
  },
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

## Proxy Components

| File | Purpose |
|------|---------|
| `Code.gs` | Entry point. `doPost(e)` orchestrates auth → IP check → route → log → respond. `doGet(e)` returns health check. |
| `Auth.gs` | JWT HS256 verification, JTI replay detection (via CacheService), IP allowlist with CIDR matching, optional AbuseIPDB integration. |
| `Config.gs` | PropertiesService wrapper. Reads/writes Script Properties with defaults. Redacts secrets in `getAllConfig()`. |
| `Router.gs` | Service registry mapping service names to handler functions. Parameter validation helpers. |
| `Logger.gs` | Rolling Google Sheets logger. Uses LockService for concurrent write safety. Never logs request parameters (content redaction). |
| `Utils.gs` | Base64url encode/decode, constant-time string comparison, UUID generation, safe JSON parsing, response builders. |
| `services/*.gs` | 13 service handlers — one per Google Workspace service. |

## CLI Components

| File | Purpose |
|------|---------|
| `index.ts` | CLI entry point using Commander.js. Registers global options and service subcommands. |
| `jwt.ts` | Creates HS256 JWT tokens with 5-minute expiry and unique JTI. Uses Node.js `crypto` module. |
| `client.ts` | HTTP client with retry logic, exponential backoff with jitter, timeout via AbortController. |
| `config.ts` | Config loading with priority: CLI flags > env vars > `~/.gproxy/config.json`. HTTPS URL validation. |
| `output.ts` | Output formatters: JSON, human-readable (chalk), and plain text (ANSI stripped). Service-specific formatting. |
| `types.ts` | TypeScript interfaces: `CommandResult`, `ProxyRequest`, `GProxyConfig`, `OutputMode`, `GlobalOptions`. |

## Apps Script Constraints

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| **6-minute execution limit** | Long operations may time out | CLI uses 5.5-minute timeout; proxy checks elapsed time and returns TIMEOUT error before limit |
| **Quotas** | API calls per user per day are limited | Retry with backoff on QUOTA_EXCEEDED; CLI retries up to 3 times |
| **Stateless execution** | No persistent state across requests | CacheService for JTI replay detection (5-minute TTL); PropertiesService for config |
| **No native JWT library** | Must implement JWT verification manually | `Auth.gs` + `Utils.gs` implement HS256 from scratch using `Utilities.computeHmacSha256Signature` |
| **No client IP in doPost** | Cannot verify source IP natively | Client-reported IP in request body; defense-in-depth only |
| **Cold starts** | First request after inactivity may be slow (2-5 seconds) | CLI timeout accounts for cold start latency |

## Service Mapping

| Google Service | Apps Script API | Advanced Service Required | Notes |
|---------------|-----------------|--------------------------|-------|
| Gmail | GmailApp + Gmail | gmail (v1) | Settings require Advanced Service |
| Calendar | CalendarApp + Calendar | calendar (v3) | Free/busy requires Advanced Service |
| Drive | DriveApp + Drive | drive (v3) | File operations use both built-in and advanced |
| Docs | DocumentApp + Docs | docs (v1) | `cat` uses DocumentApp; `get` uses Advanced Service |
| Sheets | SpreadsheetApp + Sheets | sheets (v4) | Read/write/append use Advanced Service |
| Slides | SlidesApp + Slides | slides (v1) | Metadata via Advanced Service |
| Contacts | People | peopleapi (v1) | Uses People API, not deprecated ContactsService |
| Tasks | Tasks | tasks (v1) | Fully via Advanced Service |
| People | People | peopleapi (v1) | Directory search (Workspace) |
| Groups | AdminDirectory | admin (directory_v1) | Workspace only |
| Chat | Chat | chat (v1) | Workspace only |
| Classroom | Classroom | classroom (v1) | Workspace only |

## Error Codes and Retry Semantics

| Error Code | Retryable | Description |
|-----------|-----------|-------------|
| `AUTH_FAILED` | No | Invalid JWT, expired token, replay detected |
| `IP_BLOCKED` | No | Client IP not in allowlist or flagged by AbuseIPDB |
| `INVALID_REQUEST` | No | Missing required parameters, invalid format |
| `NOT_FOUND` | No | Unknown service/action, resource not found |
| `QUOTA_EXCEEDED` | Yes | Google API quota limit reached |
| `SERVICE_ERROR` | Yes | Google API error, internal error |
| `TIMEOUT` | Yes | Approaching Apps Script 6-minute limit |
| `NETWORK_ERROR` | Yes | Network connectivity issue (CLI-side) |
| `MAX_RETRIES` | No | All retry attempts exhausted |

The CLI retries with exponential backoff: base delay 1s, multiplied by 2^(attempt-1), capped at 30s, plus random jitter (0-500ms).

## IP Security Layer

Apps Script `doPost(e)` does not expose the client's real IP address. The client reports its own IP in the request body (`clientIp` field). This is defense-in-depth only and should not be relied upon as a security boundary.

When IP allowlisting is enabled:
1. The proxy reads the `IP_ALLOWLIST` from Script Properties
2. Supports exact match and CIDR notation (e.g., `192.168.1.0/24`)
3. Optionally queries AbuseIPDB for threat intelligence scoring
4. Fails open if AbuseIPDB is unreachable (availability over security for this layer)
