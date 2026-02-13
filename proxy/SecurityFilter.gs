/**
 * SecurityFilter.gs — Intercepts account recovery and credential reset emails
 *
 * Prevents agent misuse by hiding security-sensitive emails (password resets,
 * verification codes, login alerts) from list/get responses. Also blocks
 * trash/delete of these messages to prevent hiding "New Login" alerts.
 *
 * Configurable via Script Properties:
 *   SECURITY_BLOCKED_SENDERS  — comma-separated sender addresses
 *   SECURITY_CONTENT_REGEX    — regex pattern for subject/body matching
 */

/**
 * Get the blocked senders list from config.
 * @return {string[]} Lowercased sender addresses
 */
function getBlockedSenders_() {
  var raw = getConfig('SECURITY_BLOCKED_SENDERS') || '';
  if (!raw) return [];
  return raw.split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);
}

/**
 * Get the content filter regex from config.
 * @return {RegExp|null} Compiled regex or null if not configured
 */
function getSecurityContentRegex_() {
  var pattern = getConfig('SECURITY_CONTENT_REGEX');
  if (!pattern) return null;
  try {
    return new RegExp(pattern, 'i');
  } catch (e) {
    return null;
  }
}

/**
 * Check if a Gmail message is security-sensitive.
 * @param {GmailMessage} message - GmailApp message object
 * @return {boolean} true if the message should be hidden from the agent
 */
function isSecurityEmail(message) {
  var blockedSenders = getBlockedSenders_();
  var from = (message.getFrom() || '').toLowerCase();
  for (var i = 0; i < blockedSenders.length; i++) {
    if (from.indexOf(blockedSenders[i]) !== -1) {
      return true;
    }
  }

  var contentRe = getSecurityContentRegex_();
  if (contentRe) {
    var subject = message.getSubject() || '';
    if (contentRe.test(subject)) {
      return true;
    }

    var snippet = message.getPlainBody();
    if (snippet && contentRe.test(snippet.substring(0, 500))) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a Gmail thread contains any security-sensitive message.
 * @param {GmailThread} thread - GmailApp thread object
 * @return {boolean} true if any message in the thread is security-sensitive
 */
function isSecurityThread(thread) {
  var messages = thread.getMessages();
  for (var i = 0; i < messages.length; i++) {
    if (isSecurityEmail(messages[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Log a security intercept event to the admin log.
 * @param {string} action - The action that was intercepted
 * @param {string} detail - Brief description (no sensitive content)
 */
function logSecurityIntercept(action, detail) {
  logRequest(
    generateId(),
    'internal',
    'gmail',
    'security_intercept:' + action,
    'BLOCKED',
    0,
    detail
  );
}
