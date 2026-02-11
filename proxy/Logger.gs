/**
 * Logger.gs — Rolling Google Sheets logger with content redaction
 *
 * Columns: Timestamp | Request ID | Source IP | Service | Action | Status | Duration(ms) | Error
 * Uses LockService for concurrent write safety.
 * NEVER logs request params (email bodies, doc content, etc.)
 */

/**
 * Log a request to the configured Google Sheet.
 * @param {string} requestId - Unique request ID
 * @param {string} ip - Client-reported IP
 * @param {string} service - Service name
 * @param {string} action - Action name
 * @param {string} status - 'OK' or 'ERROR'
 * @param {number} durationMs - Request duration in milliseconds
 * @param {string} errorMsg - Error message (if any)
 */
function logRequest(requestId, ip, service, action, status, durationMs, errorMsg) {
  // Check if logging is enabled
  if (getConfig('LOG_ENABLED') !== 'true') return;

  var sheetId = getConfig('LOG_SHEET_ID');
  if (!sheetId) return;

  var lock = LockService.getScriptLock();
  var acquired = false;
  try {
    acquired = lock.tryLock(5000);
    if (!acquired) return; // Skip logging if we can't acquire lock

    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('Logs');
    if (!sheet) {
      sheet = ss.insertSheet('Logs');
      sheet.appendRow(['Timestamp', 'Request ID', 'Source IP', 'Service', 'Action', 'Status', 'Duration(ms)', 'Error']);
      sheet.setFrozenRows(1);
    }

    // Append new log row
    sheet.appendRow([
      new Date().toISOString(),
      requestId || '',
      ip || 'unknown',
      service || '',
      action || '',
      status || '',
      durationMs || 0,
      errorMsg || ''
    ]);

    // Enforce rolling window
    var maxRows = parseInt(getConfig('LOG_MAX_ROWS') || '5000', 10);
    var totalRows = sheet.getLastRow();
    if (totalRows > maxRows + 1) { // +1 for header
      var rowsToDelete = totalRows - maxRows - 1;
      sheet.deleteRows(2, rowsToDelete);
    }
  } catch (e) {
    // Logging failure should never break a request
  } finally {
    if (acquired) {
      lock.releaseLock();
    }
  }
}
