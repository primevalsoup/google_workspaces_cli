/**
 * Drive.gs — Drive service handler
 * Uses DriveApp + Drive Advanced Service
 */

/**
 * Handle Drive service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handleDrive(action, params) {
  switch (action) {
    case 'list': return driveList(params);
    case 'search': return driveSearch(params);
    case 'get': return driveGet(params);
    case 'download': return driveDownload(params);
    case 'upload': return driveUpload(params);
    case 'copy': return driveCopy(params);
    case 'delete': return driveDelete(params);
    case 'export': return driveExport(params);
    case 'permissions.list': return drivePermissionsList(params);
    case 'permissions.create': return drivePermissionsCreate(params);
    case 'permissions.delete': return drivePermissionsDelete(params);
    case 'mkdir': return driveMkdir(params);
    case 'drives.list': return driveDrivesList(params);
    case 'comments.list': return driveCommentsList(params);
    default:
      return errorResponse('NOT_FOUND', 'Unknown Drive action: ' + action, false);
  }
}

function driveList(params) {
  var max = validatePositiveInt(params.max, 25, 100);
  var options = { maxResults: max };

  var query = params.query || '';
  if (params.folderId) {
    query = (query ? query + ' and ' : '') + "'" + params.folderId + "' in parents";
  }
  if (params.mimeType) {
    query = (query ? query + ' and ' : '') + "mimeType = '" + params.mimeType + "'";
  }
  query = (query ? query + ' and ' : '') + 'trashed = false';

  options.q = query;
  if (params.orderBy) options.orderBy = params.orderBy;
  if (params.pageToken) options.pageToken = params.pageToken;

  var result = Drive.Files.list(options);
  var files = (result.items || []).map(formatDriveFile_);
  return successResponse({
    files: files,
    count: files.length,
    nextPageToken: result.nextPageToken || null
  });
}

function driveSearch(params) {
  var err = validateParams(params, ['query']);
  if (err) return err;
  var max = validatePositiveInt(params.max, 25, 100);
  var result = Drive.Files.list({
    q: params.query + ' and trashed = false',
    maxResults: max,
    orderBy: params.orderBy || 'modifiedDate desc',
    pageToken: params.pageToken || null
  });
  var files = (result.items || []).map(formatDriveFile_);
  return successResponse({
    files: files,
    count: files.length,
    nextPageToken: result.nextPageToken || null
  });
}

function driveGet(params) {
  var err = validateParams(params, ['fileId']);
  if (err) return err;
  var file = Drive.Files.get(params.fileId);
  return successResponse(formatDriveFile_(file));
}

function driveDownload(params) {
  var err = validateParams(params, ['fileId']);
  if (err) return err;

  var file = Drive.Files.get(params.fileId);
  var mimeType = file.mimeType;

  // Google Workspace files need export, not download
  var exportMimeTypes = {
    'application/vnd.google-apps.document': 'text/plain',
    'application/vnd.google-apps.spreadsheet': 'text/csv',
    'application/vnd.google-apps.presentation': 'application/pdf',
    'application/vnd.google-apps.drawing': 'image/png'
  };

  var blob;
  if (exportMimeTypes[mimeType]) {
    var exportType = params.exportMimeType || exportMimeTypes[mimeType];
    blob = DriveApp.getFileById(params.fileId).getAs(exportType);
  } else {
    blob = DriveApp.getFileById(params.fileId).getBlob();
  }

  // For text content, return as string
  if (blob.getContentType() && blob.getContentType().indexOf('text/') === 0) {
    return successResponse({
      name: file.title,
      mimeType: blob.getContentType(),
      content: blob.getDataAsString('UTF-8'),
      encoding: 'utf-8'
    });
  }

  // For binary, return base64
  return successResponse({
    name: file.title,
    mimeType: blob.getContentType(),
    content: Utilities.base64Encode(blob.getBytes()),
    encoding: 'base64'
  });
}

function driveUpload(params) {
  var err = validateParams(params, ['name', 'content']);
  if (err) return err;

  var mimeType = params.mimeType || 'application/octet-stream';
  var blob;
  if (params.encoding === 'base64') {
    blob = Utilities.newBlob(Utilities.base64Decode(params.content), mimeType, params.name);
  } else {
    blob = Utilities.newBlob(params.content, mimeType, params.name);
  }

  var metadata = {
    title: params.name,
    mimeType: mimeType
  };
  if (params.folderId) {
    metadata.parents = [{ id: params.folderId }];
  }
  if (params.description) {
    metadata.description = params.description;
  }

  // Convert to Google format if requested
  var options = {};
  if (params.convert) {
    options.convert = true;
  }

  var file = Drive.Files.insert(metadata, blob, options);
  return successResponse(formatDriveFile_(file));
}

function driveCopy(params) {
  var err = validateParams(params, ['fileId']);
  if (err) return err;

  var metadata = {};
  if (params.name) metadata.title = params.name;
  if (params.folderId) metadata.parents = [{ id: params.folderId }];

  var file = Drive.Files.copy(metadata, params.fileId);
  return successResponse(formatDriveFile_(file));
}

function driveDelete(params) {
  var err = validateParams(params, ['fileId']);
  if (err) return err;
  DriveApp.getFileById(params.fileId).setTrashed(true);
  return successResponse({ deleted: params.fileId, trashed: true });
}

function driveExport(params) {
  var err = validateParams(params, ['fileId', 'format']);
  if (err) return err;

  var formatMap = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'csv': 'text/csv',
    'txt': 'text/plain',
    'html': 'text/html',
    'png': 'image/png',
    'svg': 'image/svg+xml'
  };

  var exportMime = formatMap[params.format.toLowerCase()];
  if (!exportMime) {
    return errorResponse('INVALID_REQUEST', 'Unsupported format: ' + params.format + '. Supported: ' + Object.keys(formatMap).join(', '), false);
  }

  var blob = DriveApp.getFileById(params.fileId).getAs(exportMime);
  if (exportMime.indexOf('text/') === 0) {
    return successResponse({
      content: blob.getDataAsString('UTF-8'),
      mimeType: exportMime,
      encoding: 'utf-8'
    });
  }
  return successResponse({
    content: Utilities.base64Encode(blob.getBytes()),
    mimeType: exportMime,
    encoding: 'base64'
  });
}

// --- Permissions ---

function drivePermissionsList(params) {
  var err = validateParams(params, ['fileId']);
  if (err) return err;
  var perms = Drive.Permissions.list(params.fileId);
  var items = (perms.items || []).map(function(p) {
    return {
      permissionId: p.id,
      role: p.role,
      type: p.type,
      emailAddress: p.emailAddress || '',
      domain: p.domain || '',
      name: p.name || ''
    };
  });
  return successResponse({ permissions: items });
}

function drivePermissionsCreate(params) {
  var err = validateParams(params, ['fileId', 'role', 'type']);
  if (err) return err;

  var permission = { role: params.role, type: params.type };
  if (params.emailAddress) permission.value = params.emailAddress;
  if (params.domain) permission.value = params.domain;

  var options = {};
  if (params.sendNotificationEmails === false) options.sendNotificationEmails = false;

  var created = Drive.Permissions.insert(permission, params.fileId, options);
  return successResponse({
    permissionId: created.id,
    role: created.role,
    type: created.type
  });
}

function drivePermissionsDelete(params) {
  var err = validateParams(params, ['fileId', 'permissionId']);
  if (err) return err;
  Drive.Permissions.remove(params.fileId, params.permissionId);
  return successResponse({ deleted: params.permissionId });
}

// --- Folders ---

function driveMkdir(params) {
  var err = validateParams(params, ['name']);
  if (err) return err;

  var metadata = {
    title: params.name,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (params.parentId) {
    metadata.parents = [{ id: params.parentId }];
  }

  var folder = Drive.Files.insert(metadata);
  return successResponse(formatDriveFile_(folder));
}

// --- Shared Drives ---

function driveDrivesList(params) {
  var max = validatePositiveInt(params.max, 25, 100);
  var result = Drive.Drives.list({ maxResults: max, pageToken: params.pageToken || null });
  var drives = (result.items || []).map(function(d) {
    return { driveId: d.id, name: d.name };
  });
  return successResponse({ drives: drives, count: drives.length });
}

// --- Comments ---

function driveCommentsList(params) {
  var err = validateParams(params, ['fileId']);
  if (err) return err;
  var max = validatePositiveInt(params.max, 25, 100);
  var result = Drive.Comments.list(params.fileId, { maxResults: max });
  var comments = (result.items || []).map(function(c) {
    return {
      commentId: c.commentId,
      author: c.author ? c.author.displayName : '',
      content: c.content,
      createdDate: c.createdDate,
      modifiedDate: c.modifiedDate,
      resolved: c.status === 'resolved'
    };
  });
  return successResponse({ comments: comments, count: comments.length });
}

// --- Helper ---

function formatDriveFile_(file) {
  return {
    fileId: file.id,
    name: file.title,
    mimeType: file.mimeType,
    size: file.fileSize ? parseInt(file.fileSize, 10) : 0,
    createdDate: file.createdDate,
    modifiedDate: file.modifiedDate,
    owners: (file.owners || []).map(function(o) { return o.emailAddress; }),
    webViewLink: file.alternateLink || '',
    iconLink: file.iconLink || '',
    parents: (file.parents || []).map(function(p) { return p.id; }),
    shared: file.shared || false
  };
}
