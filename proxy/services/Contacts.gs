/**
 * Contacts.gs — Contacts service handler
 * Uses People Advanced Service (not deprecated ContactsService)
 */

/**
 * Handle Contacts service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handleContacts(action, params) {
  switch (action) {
    case 'list': return contactsList(params);
    case 'search': return contactsSearch(params);
    case 'get': return contactsGet(params);
    case 'create': return contactsCreate(params);
    case 'update': return contactsUpdate(params);
    case 'delete': return contactsDelete(params);
    case 'other.list': return contactsOtherList(params);
    case 'other.search': return contactsOtherSearch(params);
    default:
      return errorResponse('NOT_FOUND', 'Unknown Contacts action: ' + action, false);
  }
}

var CONTACT_PERSON_FIELDS_ = 'names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,urls,biographies,photos';

function contactsList(params) {
  var max = validatePositiveInt(params.max, 25, 100);
  var options = {
    personFields: CONTACT_PERSON_FIELDS_,
    pageSize: max,
    sortOrder: params.sortOrder || 'LAST_MODIFIED_DESCENDING'
  };
  if (params.pageToken) options.pageToken = params.pageToken;

  var result = People.People.Connections.list('people/me', options);
  var contacts = (result.connections || []).map(formatContact_);
  return successResponse({
    contacts: contacts,
    count: contacts.length,
    nextPageToken: result.nextPageToken || null,
    totalPeople: result.totalPeople || 0
  });
}

function contactsSearch(params) {
  var err = validateParams(params, ['query']);
  if (err) return err;
  var max = validatePositiveInt(params.max, 25, 30);

  var result = People.People.searchContacts({
    query: params.query,
    readMask: CONTACT_PERSON_FIELDS_,
    pageSize: max
  });
  var contacts = (result.results || []).map(function(r) { return formatContact_(r.person); });
  return successResponse({ contacts: contacts, count: contacts.length });
}

function contactsGet(params) {
  var err = validateParams(params, ['resourceName']);
  if (err) return err;

  var person = People.People.get(params.resourceName, { personFields: CONTACT_PERSON_FIELDS_ });
  return successResponse(formatContact_(person));
}

function contactsCreate(params) {
  var person = {};

  if (params.givenName || params.familyName) {
    person.names = [{ givenName: params.givenName || '', familyName: params.familyName || '' }];
  }
  if (params.email) {
    person.emailAddresses = [{ value: params.email, type: params.emailType || 'home' }];
  }
  if (params.phone) {
    person.phoneNumbers = [{ value: params.phone, type: params.phoneType || 'mobile' }];
  }
  if (params.organization) {
    person.organizations = [{ name: params.organization, title: params.jobTitle || '' }];
  }

  var created = People.People.createContact(person);
  return successResponse(formatContact_(created));
}

function contactsUpdate(params) {
  var err = validateParams(params, ['resourceName']);
  if (err) return err;

  // Get current person with etag
  var current = People.People.get(params.resourceName, { personFields: CONTACT_PERSON_FIELDS_ });
  var person = { etag: current.etag };
  var updateFields = [];

  if (params.givenName !== undefined || params.familyName !== undefined) {
    person.names = [{ givenName: params.givenName || '', familyName: params.familyName || '' }];
    updateFields.push('names');
  }
  if (params.email !== undefined) {
    person.emailAddresses = [{ value: params.email, type: params.emailType || 'home' }];
    updateFields.push('emailAddresses');
  }
  if (params.phone !== undefined) {
    person.phoneNumbers = [{ value: params.phone, type: params.phoneType || 'mobile' }];
    updateFields.push('phoneNumbers');
  }
  if (params.organization !== undefined) {
    person.organizations = [{ name: params.organization, title: params.jobTitle || '' }];
    updateFields.push('organizations');
  }

  var updated = People.People.updateContact(person, params.resourceName, {
    updatePersonFields: updateFields.join(',')
  });
  return successResponse(formatContact_(updated));
}

function contactsDelete(params) {
  var err = validateParams(params, ['resourceName']);
  if (err) return err;
  People.People.deleteContact(params.resourceName);
  return successResponse({ deleted: params.resourceName });
}

function contactsOtherList(params) {
  var max = validatePositiveInt(params.max, 25, 100);
  var result = People.People.ListOtherContacts({
    readMask: 'names,emailAddresses,phoneNumbers',
    pageSize: max,
    pageToken: params.pageToken || undefined
  });
  var contacts = (result.otherContacts || []).map(formatContact_);
  return successResponse({
    contacts: contacts,
    count: contacts.length,
    nextPageToken: result.nextPageToken || null
  });
}

function contactsOtherSearch(params) {
  var err = validateParams(params, ['query']);
  if (err) return err;
  var result = People.People.searchContacts({
    query: params.query,
    readMask: 'names,emailAddresses,phoneNumbers',
    pageSize: validatePositiveInt(params.max, 25, 30),
    sources: ['READ_SOURCE_TYPE_CONTACT', 'READ_SOURCE_TYPE_OTHER_CONTACT']
  });
  var contacts = (result.results || []).map(function(r) { return formatContact_(r.person); });
  return successResponse({ contacts: contacts, count: contacts.length });
}

// --- Helper ---

function formatContact_(person) {
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
