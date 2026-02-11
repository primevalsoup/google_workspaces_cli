/**
 * Slides.gs — Google Slides service handler
 * Uses SlidesApp + Slides Advanced Service
 */

/**
 * Handle Slides service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handleSlides(action, params) {
  switch (action) {
    case 'get': return slidesGet(params);
    case 'create': return slidesCreate(params);
    case 'copy': return slidesCopy(params);
    case 'export': return slidesExport(params);
    default:
      return errorResponse('NOT_FOUND', 'Unknown Slides action: ' + action, false);
  }
}

function slidesGet(params) {
  var err = validateParams(params, ['presentationId']);
  if (err) return err;

  var pres = Slides.Presentations.get(params.presentationId);
  var slides = (pres.slides || []).map(function(s, i) {
    return {
      objectId: s.objectId,
      index: i,
      pageElements: s.pageElements ? s.pageElements.length : 0
    };
  });

  return successResponse({
    presentationId: pres.presentationId,
    title: pres.title,
    locale: pres.locale,
    slideCount: slides.length,
    slides: slides,
    pageSize: pres.pageSize
  });
}

function slidesCreate(params) {
  var title = params.title || 'Untitled Presentation';
  var pres = Slides.Presentations.create({ title: title });

  if (params.folderId) {
    var file = DriveApp.getFileById(pres.presentationId);
    DriveApp.getFolderById(params.folderId).addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  }

  return successResponse({
    presentationId: pres.presentationId,
    title: pres.title
  });
}

function slidesCopy(params) {
  var err = validateParams(params, ['presentationId']);
  if (err) return err;

  var name = params.name || 'Copy of presentation';
  var file = DriveApp.getFileById(params.presentationId).makeCopy(name);

  if (params.folderId) {
    DriveApp.getFolderById(params.folderId).addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  }

  return successResponse({
    presentationId: file.getId(),
    name: file.getName(),
    url: file.getUrl()
  });
}

function slidesExport(params) {
  var err = validateParams(params, ['presentationId']);
  if (err) return err;

  var format = (params.format || 'pdf').toLowerCase();
  var formatMap = {
    'pdf': 'application/pdf',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };

  var mimeType = formatMap[format];
  if (!mimeType) {
    return errorResponse('INVALID_REQUEST', 'Unsupported format: ' + format + '. Supported: pdf, pptx', false);
  }

  var blob = DriveApp.getFileById(params.presentationId).getAs(mimeType);
  return successResponse({
    content: Utilities.base64Encode(blob.getBytes()),
    mimeType: mimeType,
    encoding: 'base64'
  });
}
