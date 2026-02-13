/**
 * Gmail.gs — Gmail service handler
 * Uses GmailApp + Gmail Advanced Service
 */

/**
 * Handle Gmail service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handleGmail(action, params) {
  switch (action) {
    case 'search': return gmailSearch(params);
    case 'messageSearch': return gmailMessageSearch(params);
    case 'get': return gmailGet(params);
    case 'read': return gmailGet(params);
    case 'send': return gmailSend(params);
    case 'labels.list': return gmailLabelsList();
    case 'labels.create': return gmailLabelsCreate(params);
    case 'labels.delete': return gmailLabelsDelete(params);
    case 'thread.modify': return gmailThreadModify(params);
    case 'drafts.list': return gmailDraftsList(params);
    case 'drafts.create': return gmailDraftsCreate(params);
    case 'drafts.update': return gmailDraftsUpdate(params);
    case 'drafts.send': return gmailDraftsSend(params);
    case 'attachments.download': return gmailAttachmentsDownload(params);
    case 'settings.vacation': return gmailSettingsVacation(params);
    case 'settings.filters.list': return gmailSettingsFiltersList();
    case 'settings.filters.create': return gmailSettingsFiltersCreate(params);
    case 'settings.filters.delete': return gmailSettingsFiltersDelete(params);
    case 'settings.forwarding': return gmailSettingsForwarding(params);
    case 'settings.sendAs': return gmailSettingsSendAs();
    case 'settings.delegates': return gmailSettingsDelegates(params);
    default:
      return errorResponse('NOT_FOUND', 'Unknown Gmail action: ' + action, false);
  }
}

// --- Core actions ---

function gmailSearch(params) {
  var query = params.query || 'is:inbox';
  var max = validatePositiveInt(params.max, 20, 100);
  var includeBody = params.includeBody === true;

  var threads = GmailApp.search(query, 0, max);
  var results = [];
  for (var i = 0; i < threads.length; i++) {
    var t = threads[i];
    if (isSecurityThread(t)) {
      logSecurityIntercept('search', 'Filtered thread ' + t.getId());
      continue;
    }
    var messages = t.getMessages();
    var first = messages[0];
    var last = messages[messages.length - 1];
    var item = {
      threadId: t.getId(),
      subject: first.getSubject(),
      from: last.getFrom(),
      to: last.getTo(),
      date: last.getDate().toISOString(),
      messageCount: t.getMessageCount(),
      isUnread: t.isUnread(),
      isStarred: t.hasStarredMessages(),
      labels: t.getLabels().map(function(l) { return l.getName(); }),
      snippet: last.getPlainBody().substring(0, 200)
    };
    if (includeBody) {
      item.body = last.getPlainBody();
    }
    results.push(item);
  }
  return successResponse({ threads: results, count: results.length });
}

function gmailMessageSearch(params) {
  var query = params.query || 'is:inbox';
  var max = validatePositiveInt(params.max, 20, 100);
  var includeBody = params.includeBody === true;

  var threads = GmailApp.search(query, 0, max);
  var messages = [];
  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    for (var j = 0; j < msgs.length; j++) {
      var m = msgs[j];
      if (isSecurityEmail(m)) {
        logSecurityIntercept('messageSearch', 'Filtered message ' + m.getId());
        continue;
      }
      var item = {
        messageId: m.getId(),
        threadId: threads[i].getId(),
        subject: m.getSubject(),
        from: m.getFrom(),
        to: m.getTo(),
        cc: m.getCc(),
        date: m.getDate().toISOString(),
        isUnread: m.isUnread(),
        isStarred: m.isStarred()
      };
      if (includeBody) {
        item.body = m.getPlainBody();
        item.bodyHtml = m.getBody();
      } else {
        item.snippet = m.getPlainBody().substring(0, 200);
      }
      messages.push(item);
    }
  }
  return successResponse({ messages: messages, count: messages.length });
}

function gmailGet(params) {
  var err = validateParams(params, ['threadId']);
  if (err) return err;

  var thread = GmailApp.getThreadById(params.threadId);
  if (!thread) {
    return errorResponse('NOT_FOUND', 'Thread not found: ' + params.threadId, false);
  }

  if (isSecurityThread(thread)) {
    logSecurityIntercept('get', 'Blocked access to thread ' + params.threadId);
    return errorResponse('FORBIDDEN', 'Access to this thread is restricted by security policy', false);
  }

  var messages = thread.getMessages();
  var result = {
    threadId: thread.getId(),
    subject: messages[0].getSubject(),
    messageCount: thread.getMessageCount(),
    isUnread: thread.isUnread(),
    labels: thread.getLabels().map(function(l) { return l.getName(); }),
    messages: []
  };

  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    var attachments = m.getAttachments();
    var attachmentMeta = [];
    for (var a = 0; a < attachments.length; a++) {
      attachmentMeta.push({
        name: attachments[a].getName(),
        contentType: attachments[a].getContentType(),
        size: attachments[a].getSize()
      });
    }
    result.messages.push({
      messageId: m.getId(),
      from: m.getFrom(),
      to: m.getTo(),
      cc: m.getCc(),
      bcc: m.getBcc(),
      replyTo: m.getReplyTo(),
      date: m.getDate().toISOString(),
      body: m.getPlainBody(),
      bodyHtml: m.getBody(),
      isUnread: m.isUnread(),
      isStarred: m.isStarred(),
      attachments: attachmentMeta
    });
  }

  return successResponse(result);
}

function gmailSend(params) {
  var err = validateParams(params, ['to', 'subject']);
  if (err) return err;

  var options = {};
  if (params.cc) options.cc = params.cc;
  if (params.bcc) options.bcc = params.bcc;
  if (params.bodyHtml) options.htmlBody = params.bodyHtml;
  if (params.replyTo) options.replyTo = params.replyTo;
  if (params.from) options.from = params.from;

  // Handle attachments (base64-encoded)
  if (params.attachments && params.attachments.length > 0) {
    var blobs = [];
    for (var i = 0; i < params.attachments.length; i++) {
      var att = params.attachments[i];
      var bytes = Utilities.base64Decode(att.content);
      blobs.push(Utilities.newBlob(bytes, att.mimeType || 'application/octet-stream', att.name));
    }
    options.attachments = blobs;
  }

  // Reply to thread or send new
  if (params.replyToThreadId) {
    var thread = GmailApp.getThreadById(params.replyToThreadId);
    if (!thread) {
      return errorResponse('NOT_FOUND', 'Thread not found for reply: ' + params.replyToThreadId, false);
    }
    thread.reply(params.body || '', options);
    return successResponse({ threadId: thread.getId(), action: 'replied' });
  }

  GmailApp.sendEmail(params.to, params.subject, params.body || '', options);
  return successResponse({ action: 'sent' });
}

// --- Labels ---

function gmailLabelsList() {
  var labels = GmailApp.getUserLabels();
  var result = [];
  for (var i = 0; i < labels.length; i++) {
    result.push({
      name: labels[i].getName(),
      unreadCount: labels[i].getUnreadCount()
    });
  }
  return successResponse({ labels: result });
}

function gmailLabelsCreate(params) {
  var err = validateParams(params, ['name']);
  if (err) return err;
  var label = GmailApp.createLabel(params.name);
  return successResponse({ name: label.getName() });
}

function gmailLabelsDelete(params) {
  var err = validateParams(params, ['name']);
  if (err) return err;
  var label = GmailApp.getUserLabelByName(params.name);
  if (!label) return errorResponse('NOT_FOUND', 'Label not found: ' + params.name, false);
  label.deleteLabel();
  return successResponse({ deleted: params.name });
}

// --- Thread modify ---

function gmailThreadModify(params) {
  var err = validateParams(params, ['threadId']);
  if (err) return err;
  var thread = GmailApp.getThreadById(params.threadId);
  if (!thread) return errorResponse('NOT_FOUND', 'Thread not found', false);

  if (isSecurityThread(thread)) {
    logSecurityIntercept('thread.modify', 'Blocked modify on thread ' + params.threadId);
    return errorResponse('FORBIDDEN', 'Modifying this thread is restricted by security policy', false);
  }

  if (params.addLabels) {
    var labels = params.addLabels;
    for (var i = 0; i < labels.length; i++) {
      var label = GmailApp.getUserLabelByName(labels[i]);
      if (label) thread.addLabel(label);
    }
  }
  if (params.removeLabels) {
    var labels = params.removeLabels;
    for (var i = 0; i < labels.length; i++) {
      var label = GmailApp.getUserLabelByName(labels[i]);
      if (label) thread.removeLabel(label);
    }
  }
  if (params.markRead === true) thread.markRead();
  if (params.markUnread === true) thread.markUnread();
  if (params.star === true) thread.getMessages().forEach(function(m) { m.star(); });
  if (params.unstar === true) thread.getMessages().forEach(function(m) { m.unstar(); });
  if (params.moveToTrash === true) thread.moveToTrash();
  if (params.moveToArchive === true) thread.moveToArchive();
  if (params.moveToInbox === true) thread.moveToInbox();
  if (params.markImportant === true) thread.markImportant();
  if (params.markUnimportant === true) thread.markUnimportant();

  return successResponse({ threadId: params.threadId, modified: true });
}

// --- Drafts ---

function gmailDraftsList(params) {
  var drafts = GmailApp.getDrafts();
  var max = validatePositiveInt(params.max, 20, 100);
  var results = [];
  for (var i = 0; i < Math.min(drafts.length, max); i++) {
    var d = drafts[i];
    var msg = d.getMessage();
    results.push({
      draftId: d.getId(),
      messageId: msg.getId(),
      subject: msg.getSubject(),
      to: msg.getTo(),
      date: msg.getDate().toISOString()
    });
  }
  return successResponse({ drafts: results, count: results.length });
}

function gmailDraftsCreate(params) {
  var err = validateParams(params, ['to', 'subject']);
  if (err) return err;

  var options = {};
  if (params.cc) options.cc = params.cc;
  if (params.bcc) options.bcc = params.bcc;
  if (params.bodyHtml) options.htmlBody = params.bodyHtml;

  var draft;
  if (params.replyToMessageId) {
    var message = GmailApp.getMessageById(params.replyToMessageId);
    if (!message) return errorResponse('NOT_FOUND', 'Message not found for reply draft', false);
    draft = message.createDraftReply(params.body || '', options);
  } else {
    draft = GmailApp.createDraft(params.to, params.subject, params.body || '', options);
  }

  return successResponse({ draftId: draft.getId() });
}

function gmailDraftsUpdate(params) {
  var err = validateParams(params, ['draftId']);
  if (err) return err;
  var draft = GmailApp.getDraft(params.draftId);
  if (!draft) return errorResponse('NOT_FOUND', 'Draft not found', false);
  draft.update(params.to, params.subject, params.body || '', {
    cc: params.cc || '',
    bcc: params.bcc || '',
    htmlBody: params.bodyHtml || ''
  });
  return successResponse({ draftId: params.draftId, updated: true });
}

function gmailDraftsSend(params) {
  var err = validateParams(params, ['draftId']);
  if (err) return err;
  var draft = GmailApp.getDraft(params.draftId);
  if (!draft) return errorResponse('NOT_FOUND', 'Draft not found', false);
  var msg = draft.send();
  return successResponse({ messageId: msg.getId(), sent: true });
}

// --- Attachments ---

function gmailAttachmentsDownload(params) {
  var err = validateParams(params, ['messageId']);
  if (err) return err;

  var message = GmailApp.getMessageById(params.messageId);
  if (!message) return errorResponse('NOT_FOUND', 'Message not found', false);

  var attachments = message.getAttachments();
  if (params.attachmentIndex !== undefined) {
    var idx = parseInt(params.attachmentIndex, 10);
    if (idx < 0 || idx >= attachments.length) {
      return errorResponse('NOT_FOUND', 'Attachment index out of range', false);
    }
    var att = attachments[idx];
    return successResponse({
      name: att.getName(),
      contentType: att.getContentType(),
      size: att.getSize(),
      content: Utilities.base64Encode(att.getBytes())
    });
  }

  // Return all attachments
  var results = [];
  for (var i = 0; i < attachments.length; i++) {
    results.push({
      index: i,
      name: attachments[i].getName(),
      contentType: attachments[i].getContentType(),
      size: attachments[i].getSize(),
      content: Utilities.base64Encode(attachments[i].getBytes())
    });
  }
  return successResponse({ attachments: results });
}

// --- Settings (Gmail Advanced Service) ---

function gmailSettingsVacation(params) {
  var userId = 'me';
  if (params.set === true) {
    var vacation = {
      enableAutoReply: params.enabled !== false,
      responseSubject: params.subject || '',
      responseBodyPlainText: params.body || '',
      responseBodyHtml: params.bodyHtml || ''
    };
    if (params.startTime) vacation.startTime = new Date(params.startTime).getTime();
    if (params.endTime) vacation.endTime = new Date(params.endTime).getTime();
    if (params.restrictToContacts) vacation.restrictToContacts = true;
    if (params.restrictToDomain) vacation.restrictToDomain = true;
    var result = Gmail.Users.Settings.updateVacation(vacation, userId);
    return successResponse(result);
  }
  var current = Gmail.Users.Settings.getVacation(userId);
  return successResponse(current);
}

function gmailSettingsFiltersList() {
  var result = Gmail.Users.Settings.Filters.list('me');
  return successResponse({ filters: result.filter || [] });
}

function gmailSettingsFiltersCreate(params) {
  var err = validateParams(params, ['criteria', 'action']);
  if (err) return err;
  var filter = { criteria: params.criteria, action: params.action };
  var result = Gmail.Users.Settings.Filters.create(filter, 'me');
  return successResponse(result);
}

function gmailSettingsFiltersDelete(params) {
  var err = validateParams(params, ['filterId']);
  if (err) return err;
  Gmail.Users.Settings.Filters.remove('me', params.filterId);
  return successResponse({ deleted: params.filterId });
}

function gmailSettingsForwarding(params) {
  if (params.set === true) {
    var err = validateParams(params, ['email']);
    if (err) return err;
    var fwd = Gmail.Users.Settings.ForwardingAddresses.create({ forwardingEmail: params.email }, 'me');
    return successResponse(fwd);
  }
  var result = Gmail.Users.Settings.ForwardingAddresses.list('me');
  return successResponse({ forwardingAddresses: result.forwardingAddresses || [] });
}

function gmailSettingsSendAs() {
  var result = Gmail.Users.Settings.SendAs.list('me');
  return successResponse({ sendAs: result.sendAs || [] });
}

function gmailSettingsDelegates(params) {
  if (params.add) {
    var delegate = Gmail.Users.Settings.Delegates.create({ delegateEmail: params.add }, 'me');
    return successResponse(delegate);
  }
  if (params.remove) {
    Gmail.Users.Settings.Delegates.remove('me', params.remove);
    return successResponse({ removed: params.remove });
  }
  var result = Gmail.Users.Settings.Delegates.list('me');
  return successResponse({ delegates: result.delegates || [] });
}
