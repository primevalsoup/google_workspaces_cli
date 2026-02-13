/**
 * Config.gs — PropertiesService wrapper for proxy configuration
 */

var CONFIG_DEFAULTS_ = {
  LOG_ENABLED: 'true',
  LOG_MAX_ROWS: '5000',
  IP_ALLOWLIST: '',
  IP_CHECK_ENABLED: 'false',
  IP_CHECK_THRESHOLD: '50',
  SECURITY_BLOCKED_SENDERS: 'no-reply@accounts.google.com,google-noreply@google.com,mail-noreply@google.com',
  SECURITY_CONTENT_REGEX: '(password\\s*reset|verification\\s*code|recovery\\s*link|one-time\\s*password|otp|confirm\\s*your\\s*identity|security\\s*alert)'
};

var CONFIG_KEYS_ = [
  'JWT_SECRET',
  'IP_ALLOWLIST',
  'LOG_ENABLED',
  'LOG_SHEET_ID',
  'LOG_MAX_ROWS',
  'IP_CHECK_ENABLED',
  'IP_CHECK_API_KEY',
  'IP_CHECK_THRESHOLD',
  'SECURITY_BLOCKED_SENDERS',
  'SECURITY_CONTENT_REGEX'
];

/**
 * Get a configuration value by key.
 * @param {string} key - Config key
 * @return {string|null} Config value or default
 */
function getConfig(key) {
  var props = PropertiesService.getScriptProperties();
  var value = props.getProperty(key);
  if (value !== null) return value;
  return CONFIG_DEFAULTS_[key] || null;
}

/**
 * Set a configuration value.
 * @param {string} key - Config key
 * @param {string} value - Config value
 */
function setConfig(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

/**
 * Delete a configuration value.
 * @param {string} key - Config key
 */
function deleteConfig(key) {
  PropertiesService.getScriptProperties().deleteProperty(key);
}

/**
 * Get all configuration values (redacts sensitive keys).
 * @return {Object} Config map with sensitive values redacted
 */
function getAllConfig() {
  var result = {};
  for (var i = 0; i < CONFIG_KEYS_.length; i++) {
    var key = CONFIG_KEYS_[i];
    var value = getConfig(key);
    if (value === null) {
      result[key] = null;
    } else if (key === 'JWT_SECRET' || key === 'IP_CHECK_API_KEY') {
      result[key] = value.length > 4 ? '****' + value.slice(-4) : '****';
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Check if JWT_SECRET is configured.
 * @return {boolean}
 */
function isConfigured() {
  var secret = getConfig('JWT_SECRET');
  return secret !== null && secret.length > 0;
}
