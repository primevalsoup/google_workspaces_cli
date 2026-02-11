/**
 * Utils.gs — Base64url encoding/decoding, constant-time comparison, helpers
 */

/**
 * Encode a byte array to a base64url string.
 * @param {number[]} data - Byte array
 * @return {string} Base64url-encoded string
 */
function base64urlEncode(data) {
  var blob = Utilities.newBlob(data);
  var base64 = Utilities.base64Encode(blob.getBytes());
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a base64url string to a byte array.
 * @param {string} str - Base64url-encoded string
 * @return {number[]} Decoded byte array
 */
function base64urlDecode(str) {
  var base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  var pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  return Utilities.base64Decode(base64);
}

/**
 * Decode a base64url string to a UTF-8 string.
 * @param {string} str - Base64url-encoded string
 * @return {string} Decoded UTF-8 string
 */
function base64urlDecodeToString(str) {
  var bytes = base64urlDecode(str);
  return Utilities.newBlob(bytes).getDataAsString('UTF-8');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * @param {string} a
 * @param {string} b
 * @return {boolean} true if strings are equal
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a unique request ID.
 * @return {string} UUID-like request ID
 */
function generateId() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var sections = [8, 4, 4, 4, 12];
  var parts = [];
  for (var s = 0; s < sections.length; s++) {
    var part = '';
    for (var i = 0; i < sections[s]; i++) {
      part += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(part);
  }
  return parts.join('-');
}

/**
 * Safely parse JSON, returning null on failure.
 * @param {string} str - JSON string
 * @return {Object|null} Parsed object or null
 */
function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

/**
 * Build a success response object.
 * @param {Object} data - Response data
 * @return {Object} Success response
 */
function successResponse(data) {
  return { ok: true, data: data };
}

/**
 * Build an error response object.
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {boolean} retryable - Whether the client should retry
 * @return {Object} Error response
 */
function errorResponse(code, message, retryable) {
  return {
    ok: false,
    error: {
      code: code,
      message: message,
      retryable: !!retryable
    }
  };
}
