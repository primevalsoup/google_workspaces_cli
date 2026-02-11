/**
 * Sheets.gs — Google Sheets service handler
 * Uses SpreadsheetApp + Sheets Advanced Service
 */

/**
 * Handle Sheets service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handleSheets(action, params) {
  switch (action) {
    case 'get': return sheetsGet(params);
    case 'read': return sheetsRead(params);
    case 'write': return sheetsWrite(params);
    case 'update': return sheetsUpdate(params);
    case 'append': return sheetsAppend(params);
    case 'clear': return sheetsClear(params);
    case 'create': return sheetsCreate(params);
    case 'copy': return sheetsCopy(params);
    case 'export': return sheetsExport(params);
    case 'format': return sheetsFormat(params);
    default:
      return errorResponse('NOT_FOUND', 'Unknown Sheets action: ' + action, false);
  }
}

function sheetsGet(params) {
  var err = validateParams(params, ['spreadsheetId']);
  if (err) return err;

  var ss = Sheets.Spreadsheets.get(params.spreadsheetId);
  var sheets = (ss.sheets || []).map(function(s) {
    return {
      sheetId: s.properties.sheetId,
      title: s.properties.title,
      index: s.properties.index,
      rowCount: s.properties.gridProperties.rowCount,
      columnCount: s.properties.gridProperties.columnCount
    };
  });

  return successResponse({
    spreadsheetId: ss.spreadsheetId,
    title: ss.properties.title,
    locale: ss.properties.locale,
    timeZone: ss.properties.timeZone,
    sheets: sheets,
    url: ss.spreadsheetUrl
  });
}

function sheetsRead(params) {
  var err = validateParams(params, ['spreadsheetId', 'range']);
  if (err) return err;

  var options = {};
  if (params.valueRenderOption) options.valueRenderOption = params.valueRenderOption;
  if (params.dateTimeRenderOption) options.dateTimeRenderOption = params.dateTimeRenderOption;

  var result = Sheets.Spreadsheets.Values.get(params.spreadsheetId, params.range, options);
  return successResponse({
    range: result.range,
    values: result.values || [],
    majorDimension: result.majorDimension || 'ROWS'
  });
}

function sheetsWrite(params) {
  var err = validateParams(params, ['spreadsheetId', 'range', 'values']);
  if (err) return err;

  var resource = {
    values: params.values,
    majorDimension: params.majorDimension || 'ROWS'
  };

  var result = Sheets.Spreadsheets.Values.update(resource, params.spreadsheetId, params.range, {
    valueInputOption: params.valueInputOption || 'USER_ENTERED'
  });

  return successResponse({
    updatedRange: result.updatedRange,
    updatedRows: result.updatedRows,
    updatedColumns: result.updatedColumns,
    updatedCells: result.updatedCells
  });
}

function sheetsUpdate(params) {
  // Alias for write with update semantics
  return sheetsWrite(params);
}

function sheetsAppend(params) {
  var err = validateParams(params, ['spreadsheetId', 'range', 'values']);
  if (err) return err;

  var resource = {
    values: params.values,
    majorDimension: params.majorDimension || 'ROWS'
  };

  var result = Sheets.Spreadsheets.Values.append(resource, params.spreadsheetId, params.range, {
    valueInputOption: params.valueInputOption || 'USER_ENTERED',
    insertDataOption: params.insertDataOption || 'INSERT_ROWS'
  });

  return successResponse({
    updatedRange: result.updates ? result.updates.updatedRange : null,
    updatedRows: result.updates ? result.updates.updatedRows : 0,
    updatedCells: result.updates ? result.updates.updatedCells : 0
  });
}

function sheetsClear(params) {
  var err = validateParams(params, ['spreadsheetId', 'range']);
  if (err) return err;

  Sheets.Spreadsheets.Values.clear({}, params.spreadsheetId, params.range);
  return successResponse({ cleared: params.range });
}

function sheetsCreate(params) {
  var title = params.title || 'Untitled Spreadsheet';
  var resource = {
    properties: { title: title }
  };

  if (params.sheets) {
    resource.sheets = params.sheets.map(function(s, i) {
      return { properties: { title: s.title || 'Sheet' + (i + 1) } };
    });
  }

  var ss = Sheets.Spreadsheets.create(resource);

  if (params.folderId) {
    var file = DriveApp.getFileById(ss.spreadsheetId);
    DriveApp.getFolderById(params.folderId).addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  }

  return successResponse({
    spreadsheetId: ss.spreadsheetId,
    title: ss.properties.title,
    url: ss.spreadsheetUrl
  });
}

function sheetsCopy(params) {
  var err = validateParams(params, ['spreadsheetId']);
  if (err) return err;

  var name = params.name || 'Copy of spreadsheet';
  var file = DriveApp.getFileById(params.spreadsheetId).makeCopy(name);

  if (params.folderId) {
    DriveApp.getFolderById(params.folderId).addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  }

  return successResponse({
    spreadsheetId: file.getId(),
    name: file.getName(),
    url: file.getUrl()
  });
}

function sheetsExport(params) {
  var err = validateParams(params, ['spreadsheetId']);
  if (err) return err;

  var format = (params.format || 'pdf').toLowerCase();
  var formatMap = {
    'pdf': 'application/pdf',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv'
  };

  var mimeType = formatMap[format];
  if (!mimeType) {
    return errorResponse('INVALID_REQUEST', 'Unsupported format: ' + format + '. Supported: pdf, xlsx, csv', false);
  }

  var blob = DriveApp.getFileById(params.spreadsheetId).getAs(mimeType);
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

function sheetsFormat(params) {
  var err = validateParams(params, ['spreadsheetId', 'requests']);
  if (err) return err;

  var result = Sheets.Spreadsheets.batchUpdate({ requests: params.requests }, params.spreadsheetId);
  return successResponse({
    spreadsheetId: params.spreadsheetId,
    replies: result.replies || []
  });
}
