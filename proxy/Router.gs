/**
 * Router.gs — Request routing and service dispatch
 */

/**
 * Service registry — maps service names to handler functions.
 * Each handler: function(action, params) → {ok: true, data: ...} or {ok: false, error: ...}
 */
var SERVICE_REGISTRY_ = {
  'gmail': handleGmail,
  'calendar': handleCalendar,
  'drive': handleDrive,
  'docs': handleDocs,
  'sheets': handleSheets,
  'slides': handleSlides,
  'contacts': handleContacts,
  'people': handlePeople,
  'tasks': handleTasks,
  'groups': handleGroups,
  'chat': handleChat,
  'classroom': handleClassroom,
  'admin': handleAdmin
};

/**
 * Route a request to the appropriate service handler.
 * @param {string} service - Service name
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response from service handler
 */
function routeRequest(service, action, params) {
  if (!service || typeof service !== 'string') {
    return errorResponse('INVALID_REQUEST', 'Missing service name', false);
  }
  if (!action || typeof action !== 'string') {
    return errorResponse('INVALID_REQUEST', 'Missing action name', false);
  }

  var handler = SERVICE_REGISTRY_[service.toLowerCase()];
  if (!handler) {
    return errorResponse('NOT_FOUND', 'Unknown service: ' + service, false);
  }

  try {
    return handler(action, params || {});
  } catch (e) {
    // Check for quota exceeded
    if (e.message && e.message.indexOf('quota') !== -1) {
      return errorResponse('QUOTA_EXCEEDED', 'API quota exceeded: ' + e.message, true);
    }
    return errorResponse('SERVICE_ERROR', service + '.' + action + ' failed: ' + e.message, true);
  }
}

/**
 * Validate that required parameters are present.
 * @param {Object} params - Request parameters
 * @param {string[]} required - Required parameter names
 * @return {Object|null} Error response if validation fails, null if OK
 */
function validateParams(params, required) {
  for (var i = 0; i < required.length; i++) {
    var key = required[i];
    if (params[key] === undefined || params[key] === null || params[key] === '') {
      return errorResponse('INVALID_REQUEST', 'Missing required parameter: ' + key, false);
    }
  }
  return null;
}

/**
 * Validate that a parameter is a positive integer (for pagination, limits, etc.)
 * @param {*} value - Value to check
 * @param {number} defaultVal - Default if not provided
 * @param {number} maxVal - Maximum allowed value
 * @return {number}
 */
function validatePositiveInt(value, defaultVal, maxVal) {
  if (value === undefined || value === null || value === '') return defaultVal;
  var num = parseInt(value, 10);
  if (isNaN(num) || num < 1) return defaultVal;
  if (maxVal && num > maxVal) return maxVal;
  return num;
}
