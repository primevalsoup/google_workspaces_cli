/**
 * Classroom.gs — Google Classroom service handler (Workspace only)
 * Uses Classroom Advanced Service
 */

/**
 * Handle Classroom service requests.
 * @param {string} action - Action name
 * @param {Object} params - Request parameters
 * @return {Object} Response
 */
function handleClassroom(action, params) {
  switch (action) {
    case 'courses.list': return classroomCoursesList(params);
    case 'courses.get': return classroomCoursesGet(params);
    case 'courses.create': return classroomCoursesCreate(params);
    case 'roster.list': return classroomRosterList(params);
    case 'coursework.list': return classroomCourseworkList(params);
    case 'coursework.create': return classroomCourseworkCreate(params);
    case 'announcements.list': return classroomAnnouncementsList(params);
    case 'announcements.create': return classroomAnnouncementsCreate(params);
    case 'submissions.list': return classroomSubmissionsList(params);
    default:
      return errorResponse('NOT_FOUND', 'Unknown Classroom action: ' + action, false);
  }
}

function classroomCoursesList(params) {
  var max = validatePositiveInt(params.max, 25, 100);
  var options = { pageSize: max };
  if (params.studentId) options.studentId = params.studentId;
  if (params.teacherId) options.teacherId = params.teacherId;
  if (params.courseStates) options.courseStates = params.courseStates;
  if (params.pageToken) options.pageToken = params.pageToken;

  var result = Classroom.Courses.list(options);
  var courses = (result.courses || []).map(formatCourse_);

  return successResponse({
    courses: courses,
    count: courses.length,
    nextPageToken: result.nextPageToken || null
  });
}

function classroomCoursesGet(params) {
  var err = validateParams(params, ['courseId']);
  if (err) return err;

  var course = Classroom.Courses.get(params.courseId);
  return successResponse(formatCourse_(course));
}

function classroomCoursesCreate(params) {
  var err = validateParams(params, ['name']);
  if (err) return err;

  var course = { name: params.name };
  if (params.section) course.section = params.section;
  if (params.description) course.descriptionHeading = params.description;
  if (params.room) course.room = params.room;
  if (params.ownerId) course.ownerId = params.ownerId;

  var created = Classroom.Courses.create(course);
  return successResponse(formatCourse_(created));
}

function classroomRosterList(params) {
  var err = validateParams(params, ['courseId']);
  if (err) return err;
  var max = validatePositiveInt(params.max, 50, 100);
  var role = params.role || 'both'; // 'student', 'teacher', 'both'

  var result = { students: [], teachers: [] };

  if (role === 'student' || role === 'both') {
    var students = Classroom.Courses.Students.list(params.courseId, {
      pageSize: max, pageToken: params.studentPageToken || undefined
    });
    result.students = (students.students || []).map(function(s) {
      return {
        userId: s.userId,
        fullName: s.profile ? s.profile.name.fullName : '',
        emailAddress: s.profile ? s.profile.emailAddress : ''
      };
    });
    result.studentNextPageToken = students.nextPageToken || null;
  }

  if (role === 'teacher' || role === 'both') {
    var teachers = Classroom.Courses.Teachers.list(params.courseId, {
      pageSize: max, pageToken: params.teacherPageToken || undefined
    });
    result.teachers = (teachers.teachers || []).map(function(t) {
      return {
        userId: t.userId,
        fullName: t.profile ? t.profile.name.fullName : '',
        emailAddress: t.profile ? t.profile.emailAddress : ''
      };
    });
    result.teacherNextPageToken = teachers.nextPageToken || null;
  }

  return successResponse(result);
}

function classroomCourseworkList(params) {
  var err = validateParams(params, ['courseId']);
  if (err) return err;
  var max = validatePositiveInt(params.max, 25, 100);
  var options = { pageSize: max };
  if (params.courseWorkStates) options.courseWorkStates = params.courseWorkStates;
  if (params.pageToken) options.pageToken = params.pageToken;

  var result = Classroom.Courses.CourseWork.list(params.courseId, options);
  var work = (result.courseWork || []).map(formatCoursework_);

  return successResponse({
    coursework: work,
    count: work.length,
    nextPageToken: result.nextPageToken || null
  });
}

function classroomCourseworkCreate(params) {
  var err = validateParams(params, ['courseId', 'title']);
  if (err) return err;

  var coursework = {
    title: params.title,
    workType: params.workType || 'ASSIGNMENT',
    state: params.state || 'PUBLISHED'
  };
  if (params.description) coursework.description = params.description;
  if (params.maxPoints) coursework.maxPoints = params.maxPoints;
  if (params.dueDate) coursework.dueDate = params.dueDate;
  if (params.dueTime) coursework.dueTime = params.dueTime;

  var created = Classroom.Courses.CourseWork.create(coursework, params.courseId);
  return successResponse(formatCoursework_(created));
}

function classroomAnnouncementsList(params) {
  var err = validateParams(params, ['courseId']);
  if (err) return err;
  var max = validatePositiveInt(params.max, 25, 100);
  var options = { pageSize: max };
  if (params.announcementStates) options.announcementStates = params.announcementStates;
  if (params.pageToken) options.pageToken = params.pageToken;

  var result = Classroom.Courses.Announcements.list(params.courseId, options);
  var announcements = (result.announcements || []).map(function(a) {
    return {
      id: a.id,
      text: a.text || '',
      state: a.state,
      creatorUserId: a.creatorUserId,
      creationTime: a.creationTime,
      updateTime: a.updateTime
    };
  });

  return successResponse({
    announcements: announcements,
    count: announcements.length,
    nextPageToken: result.nextPageToken || null
  });
}

function classroomAnnouncementsCreate(params) {
  var err = validateParams(params, ['courseId', 'text']);
  if (err) return err;

  var announcement = {
    text: params.text,
    state: params.state || 'PUBLISHED'
  };

  var created = Classroom.Courses.Announcements.create(announcement, params.courseId);
  return successResponse({
    id: created.id,
    text: created.text,
    state: created.state,
    creationTime: created.creationTime
  });
}

function classroomSubmissionsList(params) {
  var err = validateParams(params, ['courseId', 'courseWorkId']);
  if (err) return err;
  var max = validatePositiveInt(params.max, 50, 100);
  var options = { pageSize: max };
  if (params.states) options.states = params.states;
  if (params.pageToken) options.pageToken = params.pageToken;

  var result = Classroom.Courses.CourseWork.StudentSubmissions.list(
    params.courseId, params.courseWorkId, options
  );
  var submissions = (result.studentSubmissions || []).map(function(s) {
    return {
      id: s.id,
      userId: s.userId,
      state: s.state,
      assignedGrade: s.assignedGrade || null,
      draftGrade: s.draftGrade || null,
      late: s.late || false,
      creationTime: s.creationTime,
      updateTime: s.updateTime
    };
  });

  return successResponse({
    submissions: submissions,
    count: submissions.length,
    nextPageToken: result.nextPageToken || null
  });
}

// --- Helpers ---

function formatCourse_(course) {
  return {
    courseId: course.id,
    name: course.name,
    section: course.section || '',
    description: course.descriptionHeading || '',
    room: course.room || '',
    ownerId: course.ownerId,
    courseState: course.courseState,
    creationTime: course.creationTime,
    updateTime: course.updateTime,
    enrollmentCode: course.enrollmentCode || '',
    alternateLink: course.alternateLink || ''
  };
}

function formatCoursework_(cw) {
  return {
    courseWorkId: cw.id,
    title: cw.title,
    description: cw.description || '',
    workType: cw.workType,
    state: cw.state,
    maxPoints: cw.maxPoints || 0,
    dueDate: cw.dueDate || null,
    dueTime: cw.dueTime || null,
    creationTime: cw.creationTime,
    updateTime: cw.updateTime,
    alternateLink: cw.alternateLink || ''
  };
}
