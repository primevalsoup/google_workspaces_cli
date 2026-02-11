/**
 * Admin.gs — Admin service handler for proxy management
 */

/**
 * Handle Admin service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handleAdmin(action, params) {
  switch (action) {
    case 'config.get': return adminConfigGet();
    case 'config.set': return adminConfigSet(params);
    case 'log.status': return adminLogStatus();
    case 'log.clear': return adminLogClear();
    case 'ip.list': return adminIpList();
    case 'ip.add': return adminIpAdd(params);
    case 'ip.remove': return adminIpRemove(params);
    case 'health': return adminHealth();
    default:
      return errorResponse('NOT_FOUND', 'Unknown Admin action: ' + action, false);
  }
}

function adminConfigGet() {
  return successResponse({ config: getAllConfig() });
}

function adminConfigSet(params) {
  var err = validateParams(params, ['key', 'value']);
  if (err) return err;
  setConfig(params.key, params.value);
  return successResponse({ key: params.key, set: true });
}

function adminLogStatus() {
  var sheetId = getConfig('LOG_SHEET_ID');
  if (!sheetId) {
    return successResponse({ configured: false, logEnabled: getConfig('LOG_ENABLED') === 'true' });
  }

  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('Logs');
    if (!sheet) {
      return successResponse({ configured: true, sheetId: sheetId, rows: 0 });
    }

    var lastRow = sheet.getLastRow();
    var lastEntry = null;
    if (lastRow > 1) {
      var lastRowData = sheet.getRange(lastRow, 1).getValue();
      lastEntry = lastRowData ? lastRowData.toString() : null;
    }

    return successResponse({
      configured: true,
      logEnabled: getConfig('LOG_ENABLED') === 'true',
      sheetId: sheetId,
      rows: Math.max(0, lastRow - 1), // Exclude header
      maxRows: parseInt(getConfig('LOG_MAX_ROWS') || '5000', 10),
      lastEntry: lastEntry
    });
  } catch (e) {
    return errorResponse('SERVICE_ERROR', 'Cannot access log sheet: ' + e.message, true);
  }
}

function adminLogClear() {
  var sheetId = getConfig('LOG_SHEET_ID');
  if (!sheetId) {
    return errorResponse('INVALID_REQUEST', 'No LOG_SHEET_ID configured', false);
  }

  var lock = LockService.getScriptLock();
  var acquired = lock.tryLock(5000);
  if (!acquired) {
    return errorResponse('SERVICE_ERROR', 'Could not acquire lock to clear logs', true);
  }

  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('Logs');
    if (sheet && sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    return successResponse({ cleared: true });
  } finally {
    lock.releaseLock();
  }
}

function adminIpList() {
  var allowlist = getConfig('IP_ALLOWLIST') || '';
  var ips = allowlist ? allowlist.split(',').map(function(ip) { return ip.trim(); }).filter(function(ip) { return ip.length > 0; }) : [];
  return successResponse({ ips: ips, count: ips.length });
}

function adminIpAdd(params) {
  var err = validateParams(params, ['ip']);
  if (err) return err;

  var allowlist = getConfig('IP_ALLOWLIST') || '';
  var ips = allowlist ? allowlist.split(',').map(function(ip) { return ip.trim(); }).filter(function(ip) { return ip.length > 0; }) : [];

  if (ips.indexOf(params.ip) === -1) {
    ips.push(params.ip);
    setConfig('IP_ALLOWLIST', ips.join(','));
  }

  return successResponse({ ips: ips, added: params.ip });
}

function adminIpRemove(params) {
  var err = validateParams(params, ['ip']);
  if (err) return err;

  var allowlist = getConfig('IP_ALLOWLIST') || '';
  var ips = allowlist ? allowlist.split(',').map(function(ip) { return ip.trim(); }).filter(function(ip) { return ip.length > 0; }) : [];

  var idx = ips.indexOf(params.ip);
  if (idx !== -1) {
    ips.splice(idx, 1);
    setConfig('IP_ALLOWLIST', ips.join(','));
  }

  return successResponse({ ips: ips, removed: params.ip });
}

function adminHealth() {
  var services = [
    'gmail', 'calendar', 'drive', 'docs', 'sheets', 'slides',
    'contacts', 'people', 'tasks', 'groups', 'chat', 'classroom'
  ];

  return successResponse({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    configured: isConfigured(),
    services: services,
    config: getAllConfig()
  });
}
