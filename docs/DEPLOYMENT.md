# Deployment Guide

End-to-end guide for deploying GProxy (proxy + CLI).

## Prerequisites

- **Google Account** (personal Gmail or Google Workspace)
- **Node.js** 18.0.0 or later
- Workspace account required for: Groups, Chat, Classroom services

## 1. Generate a Shared Secret

Generate a cryptographic random secret (32+ bytes):

```bash
openssl rand -base64 48
```

Save this value — you'll need it for both the proxy and CLI configuration.

## 2. Deploy the Apps Script Proxy

See [proxy/SETUP.md](../proxy/SETUP.md) for detailed step-by-step instructions.

**Summary:**
1. Create a new Apps Script project at [script.google.com](https://script.google.com)
2. Copy all `.gs` files from `proxy/` and `proxy/services/` into the project
3. Copy `appsscript.json` (enable "Show manifest file" in Settings)
4. Enable the required Advanced Services
5. Set Script Properties (at minimum: `JWT_SECRET`)
6. Deploy as Web App → Execute as **Me** → Who has access: **Anyone**
7. Copy the deployment URL

## 3. Install the CLI

```bash
npm install -g @primevalsoup/gwspace-cli
```

## 4. Configure the CLI

### Option A: Interactive Setup

```bash
gproxy setup
```

Follow the prompts to enter your proxy URL and shared secret.

### Option B: Manual Configuration

Create `~/.gproxy/config.json`:

```json
{
  "proxy_url": "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",
  "secret": "YOUR_SHARED_SECRET"
}
```

Set secure permissions:
```bash
chmod 600 ~/.gproxy/config.json
```

### Option C: Environment Variables

```bash
export GPROXY_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
export GPROXY_SECRET="YOUR_SHARED_SECRET"
```

## 5. Verify the Deployment

```bash
gproxy admin health
```

Expected output includes:
- `status: healthy`
- `configured: true`
- List of available services

## 6. Advanced Configuration

### IP Allowlisting

Add your IP(s) to the allowlist:

```bash
gproxy admin ip.add --ip "YOUR_PUBLIC_IP"
gproxy admin ip.add --ip "10.0.0.0/8"    # CIDR notation
```

Verify:
```bash
gproxy admin ip.list
```

### Logging Setup

1. Create a new Google Sheet for logs
2. Copy the spreadsheet ID from the URL
3. Set it in proxy config:

```bash
gproxy admin config.set --key "LOG_SHEET_ID" --value "YOUR_SPREADSHEET_ID"
gproxy admin config.set --key "LOG_ENABLED" --value "true"
```

Check log status:
```bash
gproxy admin log.status
```

### AbuseIPDB Integration (Optional)

```bash
gproxy admin config.set --key "IP_CHECK_ENABLED" --value "true"
gproxy admin config.set --key "IP_CHECK_API_KEY" --value "YOUR_ABUSEIPDB_KEY"
gproxy admin config.set --key "IP_CHECK_THRESHOLD" --value "50"
```

## 7. Advanced: clasp Deployment

For version-controlled deployments, use [clasp](https://github.com/nicholaschiang/clasp):

```bash
# Install clasp
npm install -g @nicholaschiang/clasp

# Login
clasp login

# Clone your Apps Script project
clasp clone YOUR_SCRIPT_ID

# Push local changes
clasp push

# Deploy new version
clasp deploy -d "v1.0.1"
```

## 8. Troubleshooting

### "No proxy URL configured"

Set the proxy URL via one of:
- `gproxy setup` (interactive)
- `--proxy-url` flag
- `GPROXY_URL` environment variable
- `~/.gproxy/config.json`

### "AUTH_FAILED: Invalid signature"

The shared secret doesn't match between CLI and proxy. Verify:
1. Check `~/.gproxy/config.json` for the CLI secret
2. Check Script Properties → `JWT_SECRET` in the Apps Script editor
3. Ensure no trailing whitespace or newlines in either value

### "AUTH_FAILED: Token expired"

Clock skew between your machine and Google's servers exceeds 30 seconds. Sync your system clock:
```bash
# macOS
sudo sntp -sS time.apple.com

# Linux
sudo ntpdate pool.ntp.org
```

### Timeout Errors

Apps Script has a 6-minute execution limit. The CLI defaults to a 5.5-minute timeout. For large operations:
- Break operations into smaller batches
- Use pagination parameters (`max`, `pageToken`)

### Cold Start Latency

The first request after a period of inactivity may take 2-5 seconds as Apps Script initializes. This is normal behavior. Subsequent requests within the active window are faster.

### "QUOTA_EXCEEDED"

Google API quotas are per-user per-day. The CLI automatically retries with exponential backoff. If persistent:
- Wait for quota reset (daily)
- Reduce batch sizes
- Check [Google Workspace quotas](https://developers.google.com/apps-script/guides/services/quotas)

### Permission Errors

If a service returns permission errors:
1. Re-deploy the web app to re-authorize scopes
2. Check that the required Advanced Services are enabled in the Apps Script project
3. Verify the deploying user has access to the requested resources
