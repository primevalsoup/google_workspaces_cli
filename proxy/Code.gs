/**
 * Code.gs — Main entry point for the GProxy Apps Script web app
 *
 * doPost(e): Handles all proxy requests (JWT auth → IP check → route → log → respond)
 * doGet(e):  Health check endpoint
 *
 * Request body format:
 * {
 *   "jwt": "...",
 *   "service": "gmail",
 *   "action": "list",
 *   "params": { ... },
 *   "clientIp": "1.2.3.4"  // optional, client-reported
 * }
 *
 * Response format:
 * Success: {"ok": true, "data": { ... }}
 * Error:   {"ok": false, "error": {"code": "ERROR_CODE", "message": "...", "retryable": true|false}}
 */

/**
 * POST handler — main request entry point.
 * @param {Object} e - Apps Script event object
 * @return {TextOutput} JSON response
 */
function doPost(e) {
  var startTime = new Date().getTime();
  var requestId = generateId();
  var service = '';
  var action = '';
  var clientIp = 'unknown';

  try {
    // Parse request body
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'Empty request body', retryable: false },
        requestId: requestId
      });
    }

    var body = safeJsonParse(e.postData.contents);
    if (!body) {
      return jsonResponse({
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid JSON in request body', retryable: false },
        requestId: requestId
      });
    }

    var jwt = body.jwt;
    service = body.service || '';
    action = body.action || '';
    var params = body.params || {};
    clientIp = body.clientIp || 'unknown';

    // 1. Verify JWT
    var authResult = verifyJwt(jwt);
    if (!authResult.ok) {
      var duration = new Date().getTime() - startTime;
      logRequest(requestId, clientIp, service, action, 'AUTH_FAILED', duration, authResult.error.message);
      authResult.requestId = requestId;
      return jsonResponse(authResult);
    }

    // 2. Check IP (defense-in-depth, client-reported)
    var ipResult = checkIp(clientIp);
    if (!ipResult.ok) {
      var duration = new Date().getTime() - startTime;
      logRequest(requestId, clientIp, service, action, 'IP_BLOCKED', duration, ipResult.error.message);
      ipResult.requestId = requestId;
      return jsonResponse(ipResult);
    }

    // 3. Route to service handler
    var result = routeRequest(service, action, params);

    // 4. Log
    var duration = new Date().getTime() - startTime;
    logRequest(requestId, clientIp, service, action, result.ok ? 'OK' : 'ERROR', duration, result.error ? result.error.message : '');

    // 5. Check timeout (warn if approaching Apps Script 6-min limit)
    var elapsed = new Date().getTime() - startTime;
    if (elapsed > 330000) {
      logRequest(requestId, clientIp, service, action, 'TIMEOUT', elapsed, 'Approaching execution time limit');
      return jsonResponse({
        ok: false,
        error: { code: 'TIMEOUT', message: 'Approaching execution time limit', retryable: true },
        requestId: requestId
      });
    }

    result.requestId = requestId;
    return jsonResponse(result);

  } catch (err) {
    var duration = new Date().getTime() - startTime;
    logRequest(requestId, clientIp, service, action, 'ERROR', duration, err.message);
    return jsonResponse({
      ok: false,
      error: { code: 'SERVICE_ERROR', message: err.message, retryable: true },
      requestId: requestId
    });
  }
}

/**
 * GET handler — health check endpoint.
 * @param {Object} e - Apps Script event object
 * @return {TextOutput} JSON response
 */
function doGet(e) {
  return jsonResponse({
    ok: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      configured: isConfigured()
    }
  });
}

/**
 * Create a JSON ContentService response.
 * @param {Object} data - Response data
 * @return {TextOutput} JSON text output
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
