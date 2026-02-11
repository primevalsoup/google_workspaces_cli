/**
 * Tasks.gs — Google Tasks service handler
 * Uses Tasks Advanced Service
 */

/**
 * Handle Tasks service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handleTasks(action, params) {
  switch (action) {
    case 'tasklists.list': return tasksTasklistsList(params);
    case 'list': return tasksList(params);
    case 'get': return tasksGet(params);
    case 'create': return tasksCreate(params);
    case 'update': return tasksUpdate(params);
    case 'done': return tasksDone(params);
    case 'undo': return tasksUndo(params);
    case 'delete': return tasksDelete(params);
    case 'clear': return tasksClear(params);
    default:
      return errorResponse('NOT_FOUND', 'Unknown Tasks action: ' + action, false);
  }
}

function tasksTasklistsList(params) {
  var max = validatePositiveInt(params.max, 25, 100);
  var result = Tasks.Tasklists.list({ maxResults: max, pageToken: params.pageToken || undefined });
  var lists = (result.items || []).map(function(tl) {
    return {
      tasklistId: tl.id,
      title: tl.title,
      updated: tl.updated
    };
  });
  return successResponse({
    tasklists: lists,
    count: lists.length,
    nextPageToken: result.nextPageToken || null
  });
}

function tasksList(params) {
  var tasklistId = params.tasklistId || '@default';
  var max = validatePositiveInt(params.max, 50, 100);
  var options = {
    maxResults: max,
    showCompleted: params.showCompleted !== false,
    showHidden: params.showHidden === true
  };
  if (params.dueMin) options.dueMin = params.dueMin;
  if (params.dueMax) options.dueMax = params.dueMax;
  if (params.pageToken) options.pageToken = params.pageToken;

  var result = Tasks.Tasks.list(tasklistId, options);
  var tasks = (result.items || []).map(formatTask_);
  return successResponse({
    tasks: tasks,
    count: tasks.length,
    nextPageToken: result.nextPageToken || null
  });
}

function tasksGet(params) {
  var err = validateParams(params, ['taskId']);
  if (err) return err;
  var tasklistId = params.tasklistId || '@default';
  var task = Tasks.Tasks.get(tasklistId, params.taskId);
  return successResponse(formatTask_(task));
}

function tasksCreate(params) {
  var err = validateParams(params, ['title']);
  if (err) return err;
  var tasklistId = params.tasklistId || '@default';

  var task = { title: params.title };
  if (params.notes) task.notes = params.notes;
  if (params.due) task.due = params.due;
  if (params.parent) task.parent = params.parent;

  var options = {};
  if (params.previous) options.previous = params.previous;

  var created = Tasks.Tasks.insert(task, tasklistId, options);
  return successResponse(formatTask_(created));
}

function tasksUpdate(params) {
  var err = validateParams(params, ['taskId']);
  if (err) return err;
  var tasklistId = params.tasklistId || '@default';

  var task = Tasks.Tasks.get(tasklistId, params.taskId);
  if (params.title !== undefined) task.title = params.title;
  if (params.notes !== undefined) task.notes = params.notes;
  if (params.due !== undefined) task.due = params.due;
  if (params.status !== undefined) task.status = params.status;

  var updated = Tasks.Tasks.update(task, tasklistId, params.taskId);
  return successResponse(formatTask_(updated));
}

function tasksDone(params) {
  var err = validateParams(params, ['taskId']);
  if (err) return err;
  var tasklistId = params.tasklistId || '@default';

  var task = Tasks.Tasks.get(tasklistId, params.taskId);
  task.status = 'completed';
  var updated = Tasks.Tasks.update(task, tasklistId, params.taskId);
  return successResponse(formatTask_(updated));
}

function tasksUndo(params) {
  var err = validateParams(params, ['taskId']);
  if (err) return err;
  var tasklistId = params.tasklistId || '@default';

  var task = Tasks.Tasks.get(tasklistId, params.taskId);
  task.status = 'needsAction';
  task.completed = null;
  var updated = Tasks.Tasks.update(task, tasklistId, params.taskId);
  return successResponse(formatTask_(updated));
}

function tasksDelete(params) {
  var err = validateParams(params, ['taskId']);
  if (err) return err;
  var tasklistId = params.tasklistId || '@default';
  Tasks.Tasks.remove(tasklistId, params.taskId);
  return successResponse({ deleted: params.taskId });
}

function tasksClear(params) {
  var tasklistId = params.tasklistId || '@default';
  Tasks.Tasks.clear(tasklistId);
  return successResponse({ cleared: tasklistId });
}

// --- Helper ---

function formatTask_(task) {
  return {
    taskId: task.id,
    title: task.title,
    notes: task.notes || '',
    status: task.status,
    due: task.due || null,
    completed: task.completed || null,
    parent: task.parent || null,
    position: task.position,
    updated: task.updated,
    selfLink: task.selfLink || ''
  };
}
