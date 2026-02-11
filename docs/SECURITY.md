# Security Model

## Authentication: JWT (HS256)

Every request from the CLI to the proxy includes a JWT signed with a shared secret using HMAC-SHA256.

### Token Structure

```
HEADER.PAYLOAD.SIGNATURE

Header:  {"alg": "HS256", "typ": "JWT"}
Payload: {"iat": 1707550000, "exp": 1707550300, "jti": "550e8400-e29b-41d4-a716-446655440000"}
```

### Token Properties

| Property | Value | Purpose |
|----------|-------|---------|
| Algorithm | HS256 (HMAC-SHA256) | Symmetric signature |
| Expiry | 5 minutes (`iat + 300`) | Limits replay window |
| Clock Skew Tolerance | 30 seconds | Handles time drift between client and server |
| JTI | UUID v4 | Unique per request; prevents replay within the 5-minute window |

### Verification Steps (Proxy)

1. Split token into 3 parts (header, payload, signature)
2. Decode and validate header (`alg` must be `HS256`)
3. Compute HMAC-SHA256 of `header.payload` using the shared secret
4. **Constant-time compare** computed signature with provided signature
5. Decode payload and check `exp` (with 30s clock skew tolerance)
6. Check `iat` is not in the future (with 30s tolerance)
7. Check JTI against CacheService for replay detection (5-minute TTL)

### Shared Secret Requirements

- **Minimum length**: 32 bytes (256 bits) recommended
- **Generation**: Cryptographic random (e.g., `openssl rand -base64 48`)
- **Storage (CLI)**: `~/.gproxy/config.json` with file permissions `0600`
- **Storage (Proxy)**: Apps Script Script Properties (not in source code)
- **Rotation**: Change the secret in both Script Properties and CLI config; old tokens expire within 5 minutes

## Base64url Encoding

Both the CLI (Node.js) and proxy (Apps Script) implement base64url encoding/decoding per RFC 7515:

- Replace `+` with `-`
- Replace `/` with `_`
- Strip trailing `=` padding

The CLI uses `Buffer.toString('base64')` with regex replacement. The proxy uses `Utilities.base64Encode()` with the same replacement pattern. Both implementations produce identical output for the same input, ensuring interoperability.

## Constant-Time Comparison

Signature verification uses constant-time string comparison to prevent timing attacks:

```javascript
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

Note: The length check leaks whether strings are the same length. For HMAC signatures of a fixed algorithm, all outputs have the same length, so this is not a concern.

## IP Allowlisting

### Limitation

**Apps Script `doPost(e)` does not expose the client's real IP address.** The IP used for allowlisting is client-reported via the `clientIp` field in the request body. A motivated attacker with the shared secret could spoof any IP.

This is **defense-in-depth only** — it prevents casual misuse but does not constitute a security boundary.

### Configuration

Set `IP_ALLOWLIST` in Script Properties as a comma-separated list:

```
192.168.1.100,10.0.0.0/8,203.0.113.42
```

Supports:
- Exact IPv4 match: `192.168.1.100`
- CIDR notation: `10.0.0.0/8`

### AbuseIPDB Integration (Optional)

When enabled, the proxy queries AbuseIPDB's threat intelligence API before processing requests:

| Script Property | Description |
|----------------|-------------|
| `IP_CHECK_ENABLED` | `true` to enable |
| `IP_CHECK_API_KEY` | AbuseIPDB API key |
| `IP_CHECK_THRESHOLD` | Confidence score threshold (default: 50) |

The check **fails open** — if AbuseIPDB is unreachable, the request proceeds. This prioritizes availability over security for this defense-in-depth layer.

## HTTPS Enforcement

The CLI validates that the proxy URL starts with `https://`. HTTP URLs are rejected with an error. This ensures all traffic between the CLI and Apps Script is encrypted in transit.

## Content Redaction

The proxy logger (`Logger.gs`) **never records request parameters**. Log entries include only:

| Column | Example |
|--------|---------|
| Timestamp | `2026-02-10T14:30:00.000Z` |
| Request ID | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| Source IP | `192.168.1.100` |
| Service | `gmail` |
| Action | `send` |
| Status | `OK` |
| Duration (ms) | `1234` |
| Error | _(empty on success)_ |

Email bodies, document content, file data, and other sensitive parameters are never written to the log sheet.

## Apps Script Execution Model

The proxy runs as a **Web App deployed as the deploying user** with access set to **Anyone**. This means:

- All Google API calls execute with the permissions of the user who deployed the script
- The "Anyone" access setting means the web app URL is publicly reachable (JWT auth is the access control)
- OAuth scopes are granted at deployment time and apply to all requests

## Secrets Management

| Secret | Where Stored | Notes |
|--------|-------------|-------|
| JWT shared secret | CLI: `~/.gproxy/config.json` (mode 0600) | Never committed to source control |
| JWT shared secret | Proxy: Script Properties (`JWT_SECRET`) | Not accessible via web; only via Apps Script editor |
| AbuseIPDB API key | Proxy: Script Properties (`IP_CHECK_API_KEY`) | Optional; redacted in `getAllConfig()` |

## Threat Model

### What GProxy Protects Against

| Threat | Mitigation |
|--------|------------|
| Unauthorized API access | JWT authentication with shared secret |
| Token replay | JTI uniqueness check via CacheService (5-minute window) |
| Token expiry bypass | 5-minute expiry with 30-second clock skew tolerance |
| Timing attacks on signature | Constant-time comparison |
| Eavesdropping | HTTPS-only communication |
| Log data leakage | Content redaction (no request params logged) |
| Casual IP-based attacks | IP allowlisting (defense-in-depth) |
| Brute force secret guessing | 32+ byte secret provides 256+ bits of entropy |

### What GProxy Does NOT Protect Against

| Threat | Why |
|--------|-----|
| Compromised shared secret | Anyone with the secret can authenticate. Rotate immediately if compromised. |
| Compromised Google account | The proxy runs as the deploying user. If that account is compromised, all API access is exposed. |
| IP spoofing | Client-reported IP is not verified by Apps Script |
| Apps Script platform compromise | GProxy relies on Google's infrastructure security |
| Insider threats | Anyone with access to the Apps Script project can read the secret from Script Properties |
| Rate limiting | GProxy does not implement its own rate limiting beyond Google's API quotas |

### Recommendations

1. Use a strong, randomly generated shared secret (32+ bytes)
2. Restrict Script Properties access to trusted editors only
3. Enable IP allowlisting as an additional layer
4. Monitor the log sheet for unusual activity
5. Rotate the secret periodically and immediately if compromise is suspected
6. Use a dedicated Google account for the proxy if managing sensitive data
