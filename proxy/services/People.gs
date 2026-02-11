/**
 * People.gs — People service handler (directory search)
 * Uses People Advanced Service
 */

/**
 * Handle People service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handlePeople(action, params) {
  switch (action) {
    case 'get': return peopleGet(params);
    case 'search': return peopleSearch(params);
    default:
      return errorResponse('NOT_FOUND', 'Unknown People action: ' + action, false);
  }
}

function peopleGet(params) {
  var err = validateParams(params, ['resourceName']);
  if (err) return err;

  var person = People.People.get(params.resourceName, {
    personFields: 'names,emailAddresses,phoneNumbers,organizations,photos,addresses,biographies'
  });

  return successResponse(formatPerson_(person));
}

function peopleSearch(params) {
  var err = validateParams(params, ['query']);
  if (err) return err;
  var max = validatePositiveInt(params.max, 10, 30);

  // Search directory (Workspace)
  var result = People.People.searchDirectoryPeople({
    query: params.query,
    readMask: 'names,emailAddresses,phoneNumbers,organizations,photos',
    pageSize: max,
    sources: ['DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE']
  });

  var people = (result.people || []).map(formatPerson_);
  return successResponse({
    people: people,
    count: people.length,
    nextPageToken: result.nextPageToken || null
  });
}

// --- Helper ---

function formatPerson_(person) {
  if (!person) return null;
  var name = person.names && person.names[0];
  return {
    resourceName: person.resourceName,
    displayName: name ? (name.displayName || (name.givenName + ' ' + name.familyName).trim()) : '',
    givenName: name ? name.givenName || '' : '',
    familyName: name ? name.familyName || '' : '',
    emails: (person.emailAddresses || []).map(function(e) { return { value: e.value, type: e.type || '' }; }),
    phones: (person.phoneNumbers || []).map(function(p) { return { value: p.value, type: p.type || '' }; }),
    organizations: (person.organizations || []).map(function(o) { return { name: o.name || '', title: o.title || '' }; }),
    photo: person.photos && person.photos[0] ? person.photos[0].url : null
  };
}
