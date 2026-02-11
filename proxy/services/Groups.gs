/**
 * Groups.gs — Google Groups service handler (Workspace only)
 * Uses Admin Directory Advanced Service
 */

/**
 * Handle Groups service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handleGroups(action, params) {
  switch (action) {
    case 'list': return groupsList(params);
    case 'members': return groupsMembers(params);
    default:
      return errorResponse('NOT_FOUND', 'Unknown Groups action: ' + action, false);
  }
}

function groupsList(params) {
  var max = validatePositiveInt(params.max, 25, 200);
  var options = { maxResults: max };
  if (params.domain) options.domain = params.domain;
  if (params.userKey) options.userKey = params.userKey;
  if (params.pageToken) options.pageToken = params.pageToken;

  // If no domain/userKey, list groups for current user
  if (!options.domain && !options.userKey) {
    options.userKey = Session.getActiveUser().getEmail();
  }

  var result = AdminDirectory.Groups.list(options);
  var groups = (result.groups || []).map(function(g) {
    return {
      groupId: g.id,
      email: g.email,
      name: g.name,
      description: g.description || '',
      directMembersCount: g.directMembersCount || '0',
      adminCreated: g.adminCreated || false
    };
  });

  return successResponse({
    groups: groups,
    count: groups.length,
    nextPageToken: result.nextPageToken || null
  });
}

function groupsMembers(params) {
  var err = validateParams(params, ['groupKey']);
  if (err) return err;
  var max = validatePositiveInt(params.max, 50, 200);
  var options = { maxResults: max };
  if (params.roles) options.roles = params.roles;
  if (params.pageToken) options.pageToken = params.pageToken;

  var result = AdminDirectory.Members.list(params.groupKey, options);
  var members = (result.members || []).map(function(m) {
    return {
      email: m.email,
      role: m.role,
      type: m.type,
      status: m.status || 'ACTIVE'
    };
  });

  return successResponse({
    members: members,
    count: members.length,
    nextPageToken: result.nextPageToken || null
  });
}
