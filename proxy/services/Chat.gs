/**
 * Chat.gs — Google Chat service handler (Workspace only)
 * Uses Chat Advanced Service
 */

/**
 * Handle Chat service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handleChat(action, params) {
  switch (action) {
    case 'spaces.list': return chatSpacesList(params);
    case 'spaces.find': return chatSpacesFind(params);
    case 'spaces.create': return chatSpacesCreate(params);
    case 'messages.list': return chatMessagesList(params);
    case 'messages.send': return chatMessagesSend(params);
    case 'messages.dm': return chatMessagesDm(params);
    default:
      return errorResponse('NOT_FOUND', 'Unknown Chat action: ' + action, false);
  }
}

function chatSpacesList(params) {
  var max = validatePositiveInt(params.max, 25, 100);
  var options = { pageSize: max };
  if (params.pageToken) options.pageToken = params.pageToken;
  if (params.filter) options.filter = params.filter;

  var result = Chat.Spaces.list(options);
  var spaces = (result.spaces || []).map(formatChatSpace_);

  return successResponse({
    spaces: spaces,
    count: spaces.length,
    nextPageToken: result.nextPageToken || null
  });
}

function chatSpacesFind(params) {
  var err = validateParams(params, ['name']);
  if (err) return err;

  // List spaces and filter by display name
  var result = Chat.Spaces.list({ pageSize: 100 });
  var spaces = (result.spaces || []).filter(function(s) {
    return s.displayName && s.displayName.toLowerCase().indexOf(params.name.toLowerCase()) !== -1;
  }).map(formatChatSpace_);

  return successResponse({ spaces: spaces, count: spaces.length });
}

function chatSpacesCreate(params) {
  var err = validateParams(params, ['displayName']);
  if (err) return err;

  var space = {
    displayName: params.displayName,
    spaceType: params.spaceType || 'SPACE'
  };

  var created = Chat.Spaces.create(space);
  return successResponse(formatChatSpace_(created));
}

function chatMessagesList(params) {
  var err = validateParams(params, ['spaceName']);
  if (err) return err;
  var max = validatePositiveInt(params.max, 25, 100);

  var options = { pageSize: max };
  if (params.pageToken) options.pageToken = params.pageToken;
  if (params.filter) options.filter = params.filter;
  if (params.orderBy) options.orderBy = params.orderBy;

  var result = Chat.Spaces.Messages.list(params.spaceName, options);
  var messages = (result.messages || []).map(formatChatMessage_);

  return successResponse({
    messages: messages,
    count: messages.length,
    nextPageToken: result.nextPageToken || null
  });
}

function chatMessagesSend(params) {
  var err = validateParams(params, ['spaceName', 'text']);
  if (err) return err;

  var message = { text: params.text };
  if (params.threadKey) {
    message.thread = { threadKey: params.threadKey };
  }

  var created = Chat.Spaces.Messages.create(message, params.spaceName);
  return successResponse(formatChatMessage_(created));
}

function chatMessagesDm(params) {
  var err = validateParams(params, ['userId', 'text']);
  if (err) return err;

  // Create or find DM space with user
  var dm = Chat.Spaces.setup({
    spaceType: 'DIRECT_MESSAGE',
    memberships: [{ member: { name: 'users/' + params.userId, type: 'HUMAN' } }]
  });

  var message = Chat.Spaces.Messages.create({ text: params.text }, dm.name);
  return successResponse({
    spaceName: dm.name,
    message: formatChatMessage_(message)
  });
}

// --- Helpers ---

function formatChatSpace_(space) {
  return {
    name: space.name,
    displayName: space.displayName || '',
    type: space.type || space.spaceType || '',
    singleUserBotDm: space.singleUserBotDm || false,
    threaded: space.threaded || false,
    spaceThreadingState: space.spaceThreadingState || ''
  };
}

function formatChatMessage_(msg) {
  return {
    name: msg.name,
    sender: msg.sender ? msg.sender.name : '',
    text: msg.text || '',
    createTime: msg.createTime,
    thread: msg.thread ? msg.thread.name : null
  };
}
