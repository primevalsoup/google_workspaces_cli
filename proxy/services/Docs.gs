/**
 * Docs.gs — Google Docs service handler
 * Uses DocumentApp + Docs Advanced Service
 */

/**
 * Handle Docs service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handleDocs(action, params) {
  switch (action) {
    case 'get': return docsGet(params);
    case 'cat': return docsCat(params);
    case 'create': return docsCreate(params);
    case 'copy': return docsCopy(params);
    case 'export': return docsExport(params);
    default:
      return errorResponse('NOT_FOUND', 'Unknown Docs action: ' + action, false);
  }
}

function docsGet(params) {
  var err = validateParams(params, ['documentId']);
  if (err) return err;

  var doc = Docs.Documents.get(params.documentId);
  return successResponse({
    documentId: doc.documentId,
    title: doc.title,
    revisionId: doc.revisionId,
    body: {
      contentLength: doc.body && doc.body.content ? doc.body.content.length : 0
    }
  });
}

function docsCat(params) {
  var err = validateParams(params, ['documentId']);
  if (err) return err;

  var doc = DocumentApp.openById(params.documentId);
  var text = doc.getBody().getText();

  var maxBytes = validatePositiveInt(params.maxBytes, 100000, 500000);
  if (text.length > maxBytes) {
    text = text.substring(0, maxBytes);
  }

  return successResponse({
    documentId: params.documentId,
    title: doc.getName(),
    content: text,
    truncated: text.length >= maxBytes
  });
}

function docsCreate(params) {
  var title = params.title || 'Untitled Document';
  var doc = DocumentApp.create(title);

  if (params.content) {
    doc.getBody().setText(params.content);
  }

  // Move to folder if specified
  if (params.folderId) {
    var file = DriveApp.getFileById(doc.getId());
    DriveApp.getFolderById(params.folderId).addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  }

  return successResponse({
    documentId: doc.getId(),
    title: doc.getName(),
    url: doc.getUrl()
  });
}

function docsCopy(params) {
  var err = validateParams(params, ['documentId']);
  if (err) return err;

  var name = params.name || 'Copy of document';
  var file = DriveApp.getFileById(params.documentId).makeCopy(name);

  if (params.folderId) {
    DriveApp.getFolderById(params.folderId).addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  }

  return successResponse({
    documentId: file.getId(),
    name: file.getName(),
    url: file.getUrl()
  });
}

function docsExport(params) {
  var err = validateParams(params, ['documentId']);
  if (err) return err;

  var format = (params.format || 'pdf').toLowerCase();
  var formatMap = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'html': 'text/html'
  };

  var mimeType = formatMap[format];
  if (!mimeType) {
    return errorResponse('INVALID_REQUEST', 'Unsupported format: ' + format + '. Supported: pdf, docx, txt, html', false);
  }

  var blob = DriveApp.getFileById(params.documentId).getAs(mimeType);
  if (mimeType.indexOf('text/') === 0) {
    return successResponse({
      content: blob.getDataAsString('UTF-8'),
      mimeType: mimeType,
      encoding: 'utf-8'
    });
  }
  return successResponse({
    content: Utilities.base64Encode(blob.getBytes()),
    mimeType: mimeType,
    encoding: 'base64'
  });
}
