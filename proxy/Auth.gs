/**
 * Auth.gs — JWT HS256 verification and IP allowlist checking
 *
 * NOTE: Apps Script doPost(e) does NOT expose the client's real IP address.
 * The IP is client-reported via the request body `clientIp` field.
 * This is defense-in-depth only — not a reliable security boundary.
 */

/**
 * Verify a JWT token using HS256.
 * @param {string} token - The JWT string (header.payload.signature)
 * @return {Object} {ok: true, data: {claims: ...}} or error response
 */
function verifyJwt(token) {
  if (!token || typeof token !== 'string') {
    return errorResponse('AUTH_FAILED', 'Missing or invalid token', false);
  }

  var secret = getConfig('JWT_SECRET');
  if (!secret) {
    return errorResponse('AUTH_FAILED', 'Server not configured — missing JWT_SECRET', false);
  }

  // 1. Split token
  var parts = token.split('.');
  if (parts.length !== 3) {
    return errorResponse('AUTH_FAILED', 'Malformed token', false);
  }

  var headerB64 = parts[0];
  var payloadB64 = parts[1];
  var signatureB64 = parts[2];

  // 2. Decode header
  var header = safeJsonParse(base64urlDecodeToString(headerB64));
  if (!header) {
    return errorResponse('AUTH_FAILED', 'Invalid token header', false);
  }

  // 3. Verify algorithm
  if (header.alg !== 'HS256') {
    return errorResponse('AUTH_FAILED', 'Unsupported algorithm: ' + header.alg, false);
  }
  if (header.typ && header.typ !== 'JWT') {
    return errorResponse('AUTH_FAILED', 'Invalid token type', false);
  }

  // 4. Compute HMAC-SHA256
  var signingInput = headerB64 + '.' + payloadB64;
  var secretBytes = Utilities.newBlob(secret).getBytes();
  var hmacBytes = Utilities.computeHmacSha256Signature(signingInput, secretBytes);

  // 5. Base64url-encode the HMAC
  var expectedSignature = base64urlEncode(hmacBytes);

  // 6. Constant-time compare
  if (!constantTimeCompare(expectedSignature, signatureB64)) {
    return errorResponse('AUTH_FAILED', 'Invalid signature', false);
  }

  // 7. Decode payload
  var payload = safeJsonParse(base64urlDecodeToString(payloadB64));
  if (!payload) {
    return errorResponse('AUTH_FAILED', 'Invalid token payload', false);
  }

  var now = Math.floor(Date.now() / 1000);
  var CLOCK_SKEW = 30;

  // 8. Check exp claim
  if (payload.exp && payload.exp + CLOCK_SKEW < now) {
    return errorResponse('AUTH_FAILED', 'Token expired', false);
  }

  // 9. Check iat claim (not in the future beyond clock skew)
  if (payload.iat && payload.iat - CLOCK_SKEW > now) {
    return errorResponse('AUTH_FAILED', 'Token issued in the future', false);
  }

  // 10. Optional JTI replay protection
  if (payload.jti) {
    var cache = CacheService.getScriptCache();
    var cacheKey = 'jti_' + payload.jti;
    if (cache.get(cacheKey)) {
      return errorResponse('AUTH_FAILED', 'Token already used (replay detected)', false);
    }
    cache.put(cacheKey, '1', 300); // 5 minutes
  }

  return successResponse({ claims: payload });
}

/**
 * Check client IP against allowlist and optional AbuseIPDB.
 * NOTE: IP is client-reported and NOT verified by Apps Script.
 * @param {string} ip - Client-reported IP address
 * @return {Object} Success or IP_BLOCKED error response
 */
function checkIp(ip) {
  if (!ip || ip === 'unknown') {
    // If no IP provided, allow (defense-in-depth is optional)
    return successResponse({ ip: ip, checked: false });
  }

  // Check allowlist
  var allowlist = getConfig('IP_ALLOWLIST');
  if (allowlist && allowlist.length > 0) {
    var allowed = allowlist.split(',');
    var isAllowed = false;
    for (var i = 0; i < allowed.length; i++) {
      var entry = allowed[i].trim();
      if (!entry) continue;
      if (entry.indexOf('/') !== -1) {
        // CIDR match
        if (cidrMatch(ip, entry)) {
          isAllowed = true;
          break;
        }
      } else {
        // Exact match
        if (ip === entry) {
          isAllowed = true;
          break;
        }
      }
    }
    if (!isAllowed) {
      return errorResponse('IP_BLOCKED', 'IP not in allowlist', false);
    }
  }

  // Optional AbuseIPDB check
  if (getConfig('IP_CHECK_ENABLED') === 'true') {
    var apiKey = getConfig('IP_CHECK_API_KEY');
    var threshold = parseInt(getConfig('IP_CHECK_THRESHOLD') || '50', 10);
    if (apiKey) {
      try {
        var response = UrlFetchApp.fetch('https://api.abuseipdb.com/api/v2/check?ipAddress=' + encodeURIComponent(ip), {
          method: 'get',
          headers: { 'Key': apiKey, 'Accept': 'application/json' },
          muteHttpExceptions: true
        });
        var result = JSON.parse(response.getContentText());
        if (result.data && result.data.abuseConfidenceScore >= threshold) {
          return errorResponse('IP_BLOCKED', 'IP flagged by threat intelligence (score: ' + result.data.abuseConfidenceScore + ')', false);
        }
      } catch (e) {
        // AbuseIPDB check failed — allow request (fail open for availability)
      }
    }
  }

  return successResponse({ ip: ip, checked: true });
}

/**
 * Check if an IPv4 address matches a CIDR range.
 * @param {string} ip - IPv4 address (e.g., "192.168.1.100")
 * @param {string} cidr - CIDR notation (e.g., "192.168.1.0/24")
 * @return {boolean}
 */
function cidrMatch(ip, cidr) {
  var parts = cidr.split('/');
  if (parts.length !== 2) return false;

  var cidrIp = parts[0];
  var maskBits = parseInt(parts[1], 10);
  if (isNaN(maskBits) || maskBits < 0 || maskBits > 32) return false;

  var ipNum = ipToInt(ip);
  var cidrNum = ipToInt(cidrIp);
  if (ipNum === null || cidrNum === null) return false;

  var mask = maskBits === 0 ? 0 : (-1 << (32 - maskBits)) >>> 0;
  return ((ipNum >>> 0) & mask) === ((cidrNum >>> 0) & mask);
}

/**
 * Convert IPv4 string to 32-bit integer.
 * @param {string} ip - IPv4 address
 * @return {number|null}
 */
function ipToInt(ip) {
  var parts = ip.split('.');
  if (parts.length !== 4) return null;
  var num = 0;
  for (var i = 0; i < 4; i++) {
    var octet = parseInt(parts[i], 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    num = (num * 256) + octet;
  }
  return num;
}
