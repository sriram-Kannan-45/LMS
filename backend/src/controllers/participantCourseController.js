/**
 * participantCourseController.js
 * ──────────────────────────────
 * Participant-side course-centric endpoints.
 *
 * Visibility rules enforced everywhere:
 *   • A participant can only read lessons / materials / quizzes / assessments
 *     of courses they are currently enrolled in (status = 'ENROLLED').
 *   • Quiz scores are HIDDEN from the participant unless
 *     AIQuiz.result_status = 'PUBLISHED'. The score is still computed and
 *     stored at submission time.
 *   • Assessment scores are HIDDEN until the per-submission status reaches
 *     'PUBLISHED' (trainer publishes after grading).
 *   • Course progress (enrollments.progress_percent) is recomputed after
 *     every lesson view / quiz submit / assessment submit using the
 *     shared recomputeCourseProgress helper.
 */
const { Op } = require('sequelize');
const {
  sequelize,
  Course,
  Training,
  Lesson,
  LessonMaterial,
  LessonAssessment,
  AssessmentSubmission,
  LessonProgress,
  Enrollment,
  AIQuiz,
  AIQuestion,
  QuizAttempt,
  QuizAnswer,
  QuizResult,
  User,
} = require('../models');

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

async function loadEnrolledCourse(req, res, courseId) {
  const id = parseInt(courseId, 10);
  if (!id) { res.status(422).json({ error: 'Invalid courseId' }); return null; }
  const course = await Course.findByPk(id, {
    include: [{ model: Training, as: 'program', attributes: ['id', 'title'] }],
  });
  if (!course) { res.status(404).json({ error: 'Course not found' }); return null; }
  const enrollment = await Enrollment.findOne({
    where: { courseId: id, participantId: req.user.id, status: 'ENROLLED' },
  });
  if (!enrollment) { res.status(403).json({ error: 'You are not enrolled in this course' }); return null; }
  return { course, enrollment };
}

// Resolve the owning course for a lesson and verify enrollment.
async function loadEnrolledLesson(req, res, lessonId) {
  const id = parseInt(lessonId, 10);
  if (!id) { res.status(422).json({ error: 'Invalid lessonId' }); return null; }
  const lesson = await Lesson.findByPk(id);
  if (!lesson || !lesson.courseId) {
    res.status(404).json({ error: 'Lesson not found' });
    return null;
  }
  const ctx = await loadEnrolledCourse(req, res, lesson.courseId);
  if (!ctx) return null;
  return { ...ctx, lesson };
}

/**
 * Recomputes (and persists) the participant's progress in a course.
 * progress_percent = completed_lessons / total_lessons * 100
 *
 * A lesson is "completed" when:
 *   • content_viewed = true
 *   • all mandatory quizzes for the lesson have been submitted
 *   • all mandatory assessments for the lesson have been submitted
 */
async function recomputeCourseProgress(courseId, participantId) {
  const lessons = await Lesson.findAll({
    where: { courseId },
    include: [
      { model: LessonAssessment, as: 'assessments', where: { isMandatory: true }, required: false },
    ],
    attributes: ['id'],
  });
  if (lessons.length === 0) return 0;

  const lessonIds = lessons.map(l => l.id);

  const [progressRows, mandatoryQuizzes, submissions] = await Promise.all([
    LessonProgress.findAll({ where: { lessonId: lessonIds, participantId } }),
    AIQuiz.findAll({
      where: {
        lessonId: lessonIds,
        isMandatory: true,
        status: { [Op.ne]: 'CLOSED' },
      },
      attributes: ['id', 'lessonId'],
    }),
    AssessmentSubmission.findAll({
      where: { participantId },
      include: [{
        model: LessonAssessment, as: 'assessment',
        where: { lessonId: lessonIds, isMandatory: true },
        required: true,
        attributes: ['id', 'lessonId'],
      }],
    }),
  ]);

  // For each mandatory quiz, has the participant submitted?
  const quizIds = mandatoryQuizzes.map(q => q.id);
  const submittedQuizzes = quizIds.length === 0 ? [] : await QuizAttempt.findAll({
    where: { quizId: quizIds, participantId, status: 'SUBMITTED' },
    attributes: ['quizId'],
  });
  const submittedQuizSet = new Set(submittedQuizzes.map(a => String(a.quizId)));

  const progressByLesson = Object.fromEntries(progressRows.map(p => [String(p.lessonId), p]));

  const toComplete = [];
  const toProgress = [];
  for (const lesson of lessons) {
    const p = progressByLesson[String(lesson.id)];
    if (!p || !p.contentViewed) continue;

    const lessonMandatoryQuizzes = mandatoryQuizzes.filter(q => String(q.lessonId) === String(lesson.id));
    const allQuizzesDone = lessonMandatoryQuizzes.every(q => submittedQuizSet.has(String(q.id)));

    const lessonMandatoryAssessments = (lesson.assessments || []);
    const submittedAssessmentIds = new Set(
      submissions.filter(s => String(s.assessment?.lessonId) === String(lesson.id))
                 .map(s => String(s.assessmentId))
    );
    const allAssessmentsDone = lessonMandatoryAssessments.every(a =>
      submittedAssessmentIds.has(String(a.id)));

    if (allQuizzesDone && allAssessmentsDone) {
      completed++;
      if (p.status !== 'COMPLETED') {
        toComplete.push(p.id);
      }
    } else if (p.status === 'NOT_STARTED') {
      toProgress.push(p.id);
    }
  }
  // Batch update progress statuses
  if (toComplete.length > 0) {
    await LessonProgress.update(
      { status: 'COMPLETED', completedAt: new Date() },
      { where: { id: toComplete } }
    );
  }
  if (toProgress.length > 0) {
    await LessonProgress.update(
      { status: 'IN_PROGRESS' },
      { where: { id: toProgress } }
    );
  }

  const percent = (completed / lessons.length) * 100;
  await Enrollment.update(
    { progressPercent: percent },
    { where: { courseId, participantId, status: 'ENROLLED' } }
  );
  return percent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrollment
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/participant/enroll  { courseId } / { trainingId }
async function enroll(req, res) {
  try {
    const courseId = parseInt(req.body.courseId, 10);
    if (!courseId) {
      const trainingId = parseInt(req.body.trainingId, 10);
      if (trainingId) {
        const enrollmentController = require('./enrollmentController');
        return enrollmentController.enrollInTraining(req, res);
      }
      return res.status(422).json({ error: 'courseId is required' });
    }
    const course = await Course.findByPk(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'Course is not open for enrollment' });
    }

    const [enrollment, created] = await Enrollment.findOrCreate({
      where: { courseId, participantId: req.user.id },
      defaults: { courseId, participantId: req.user.id, status: 'PENDING', progressPercent: 0 },
    });
    if (!created && enrollment.status === 'CANCELLED') {
      await enrollment.update({ status: 'PENDING', progressPercent: 0 });
    }
    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Enrollment request submitted for approval' : (enrollment.status === 'PENDING' ? 'Enrollment request already pending' : 'Already enrolled'),
      enrollment: {
        id: enrollment.id,
        courseId: enrollment.courseId,
        status: enrollment.status,
        progressPercent: Number(enrollment.progressPercent || 0),
        enrolledAt: enrollment.enrolled_at || enrollment.createdAt,
      },
    });
  } catch (e) {
    console.error('enroll:', e.message);
    res.status(500).json({ error: 'Failed to enroll' });
  }
}

// DELETE /api/participant/enroll/:courseId
async function unenroll(req, res) {
  try {
    const id = parseInt(req.params.courseId, 10);
    const courseEnrollment = await Enrollment.findOne({
      where: { courseId: id, participantId: req.user.id, status: 'ENROLLED' },
    });
    if (courseEnrollment) {
      await courseEnrollment.update({ status: 'CANCELLED' });
      return res.json({ success: true, message: 'Unenrolled successfully' });
    }

    const trainingEnrollment = await Enrollment.findOne({
      where: { trainingId: id, participantId: req.user.id, status: 'ENROLLED' },
    });
    if (trainingEnrollment) {
      const enrollmentController = require('./enrollmentController');
      req.params.trainingId = req.params.courseId;
      return enrollmentController.cancelEnrollment(req, res);
    }

    return res.status(404).json({ error: 'Enrollment not found' });
  } catch (e) {
    console.error('unenroll:', e.message);
    res.status(500).json({ error: 'Failed to unenroll' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Courses (participant view)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/participant/courses  — all courses the participant is currently enrolled in or pending approval
async function listMyCourses(req, res) {
  try {
    const enrollments = await Enrollment.findAll({
      where: {
        participantId: req.user.id,
        status: { [Op.in]: ['ENROLLED', 'PENDING'] }
      },
      include: [{
        model: Course, as: 'course', required: true,
        include: [
          { model: Training, as: 'program', attributes: ['id', 'title'] },
          { model: User,     as: 'trainer', attributes: ['id', 'name'] },
        ],
      }],
      order: [['enrolled_at', 'DESC']],
    });

    res.json({
      success: true,
      courses: enrollments
        .filter(e => e.course)
        .map(e => ({
          courseId: e.course.id,
          title: e.course.title,
          description: e.course.description,
          thumbnailUrl: e.course.thumbnailUrl,
          status: e.course.status,
          programTitle: e.course.program?.title || null,
          trainerName: e.course.trainer?.name || null,
          progressPercent: Number(e.progressPercent || 0),
          enrolledAt: e.enrolled_at || e.createdAt,
          enrollmentStatus: e.status,
        })),
    });
  } catch (e) {
    console.error('listMyCourses:', e.message);
    res.status(500).json({ error: 'Failed to list enrolled courses' });
  }
}

// GET /api/participant/courses/explore — PUBLISHED courses the participant is NOT enrolled in
async function explore(req, res) {
  try {
    const myEnrolled = await Enrollment.findAll({
      where: {
        participantId: req.user.id,
        status: { [Op.in]: ['ENROLLED', 'PENDING', 'COMPLETED'] }
      },
      attributes: ['courseId'],
    });
    const myIds = myEnrolled.map(e => e.courseId).filter(Boolean);

    const where = { status: 'PUBLISHED' };
    if (myIds.length) where.id = { [Op.notIn]: myIds };

    const courses = await Course.findAll({
      where,
      include: [
        { model: Training, as: 'program', attributes: ['id', 'title'] },
        { model: User,     as: 'trainer', attributes: ['id', 'name'] },
      ],
      order: [['id', 'DESC']],
    });
    res.json({
      success: true,
      courses: courses.map(c => ({
        courseId: c.id,
        title: c.title,
        description: c.description,
        thumbnailUrl: c.thumbnailUrl,
        programTitle: c.program?.title || null,
        trainerName: c.trainer?.name || null,
      })),
    });
  } catch (e) {
    console.error('explore:', e.message);
    res.status(500).json({ error: 'Failed to load explore feed' });
  }
}

// GET /api/participant/courses/:courseId — overview + progress + stat counts
async function getCourseOverview(req, res) {
  try {
    const ctx = await loadEnrolledCourse(req, res, req.params.courseId);
    if (!ctx) return;
    const { course, enrollment } = ctx;

    const [lessonCount, completedLessonCount, quizzes, submissions] = await Promise.all([
      Lesson.count({ where: { courseId: course.id } }),
      LessonProgress.count({
        where: { participantId: req.user.id, status: 'COMPLETED' },
        include: [{ model: Lesson, as: 'lesson', where: { courseId: course.id }, required: true, attributes: [] }],
      }),
      AIQuiz.findAll({ where: { courseId: course.id }, attributes: ['id'] }),
      AssessmentSubmission.findAll({
        where: { participantId: req.user.id },
        include: [{
          model: LessonAssessment, as: 'assessment',
          required: true,
          include: [{ model: Lesson, as: 'lesson', where: { courseId: course.id }, required: true, attributes: [] }],
          attributes: ['id'],
        }],
        attributes: ['id'],
      }),
    ]);

    // Quiz attempts and avg score (only counts published results)
    const quizIds = quizzes.map(q => q.id);
    const [attemptedCount, results] = await Promise.all([
      quizIds.length === 0 ? 0 : QuizAttempt.count({
        where: { quizId: quizIds, participantId: req.user.id, status: 'SUBMITTED' },
      }),
      quizIds.length === 0 ? [] : QuizResult.findAll({
        where: { quizId: quizIds, participantId: req.user.id },
        include: [{
          model: AIQuiz, as: 'quiz',
          where: { courseId: course.id, resultStatus: 'PUBLISHED' },
          required: true,
          attributes: [],
        }],
        attributes: ['percentage'],
      }),
    ]);
    const avgScore = results.length === 0
      ? null
      : Number((results.reduce((s, r) => s + Number(r.percentage || 0), 0) / results.length).toFixed(2));

    const trainer = await User.findByPk(course.trainerId, { attributes: ['id', 'name', 'email'] });

    res.json({
      success: true,
      course: {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnailUrl,
        programTitle: course.program?.title || null,
        trainer: trainer ? { id: trainer.id, name: trainer.name, email: trainer.email } : null,
      },
      enrollment: {
        enrolledAt: enrollment.enrolled_at || enrollment.createdAt,
        progressPercent: Number(enrollment.progressPercent || 0),
      },
      stats: {
        totalLessons: lessonCount,
        completedLessons: completedLessonCount,
        totalQuizzes: quizzes.length,
        attemptedQuizzes: attemptedCount,
        submittedAssessments: submissions.length,
        avgQuizScore: avgScore,
      },
    });
  } catch (e) {
    console.error('getCourseOverview:', e.message);
    res.status(500).json({ error: 'Failed to load course overview' });
  }
}

// GET /api/participant/courses/:courseId/lessons — ordered list with per-lesson progress
async function listCourseLessons(req, res) {
  try {
    const ctx = await loadEnrolledCourse(req, res, req.params.courseId);
    if (!ctx) return;
    const { course } = ctx;

    const lessons = await Lesson.findAll({
      where: { courseId: course.id },
      include: [
        { model: LessonMaterial,   as: 'materials',   attributes: ['id', 'materialType'] },
        { model: LessonAssessment, as: 'assessments', attributes: ['id', 'title', 'isMandatory'] },
      ],
      order: [['orderIndex', 'ASC'], ['id', 'ASC']],
    });
    const lessonIds = lessons.map(l => l.id);
    const progress = lessonIds.length === 0 ? [] : await LessonProgress.findAll({
      where: { lessonId: lessonIds, participantId: req.user.id },
    });
    const progMap = Object.fromEntries(progress.map(p => [String(p.lessonId), p]));

    const out = lessons.map(l => {
      const p = progMap[String(l.id)];
      const counts = { NOTE: 0, VIDEO: 0, IMAGE: 0, LINK: 0, PDF: 0, PPT: 0 };
      (l.materials || []).forEach(m => { counts[m.materialType] = (counts[m.materialType] || 0) + 1; });
      return {
        lessonId: l.id,
        title: l.title,
        description: l.description,
        orderIndex: l.orderIndex,
        materialCounts: counts,
        hasAssessment: (l.assessments || []).length > 0,
        progress: p ? {
          status: p.status,
          contentViewed: p.contentViewed,
          completedAt: p.completedAt,
        } : { status: 'NOT_STARTED', contentViewed: false, completedAt: null },
      };
    });
    res.json({ success: true, lessons: out });
  } catch (e) {
    console.error('listCourseLessons:', e.message);
    res.status(500).json({ error: 'Failed to list course lessons' });
  }
}

// GET /api/participant/courses/:courseId/resources — all materials grouped by type
async function listCourseResources(req, res) {
  try {
    const ctx = await loadEnrolledCourse(req, res, req.params.courseId);
    if (!ctx) return;
    const { course } = ctx;

    const lessons = await Lesson.findAll({
      where: { courseId: course.id },
      include: [{
        model: LessonMaterial, as: 'materials',
        separate: true, order: [['orderIndex', 'ASC']],
      }],
      attributes: ['id', 'title'],
      order: [['orderIndex', 'ASC']],
    });
    const grouped = { NOTE: [], VIDEO: [], IMAGE: [], LINK: [], PDF: [], PPT: [] };
    lessons.forEach(l => {
      (l.materials || []).forEach(m => {
        grouped[m.materialType] = grouped[m.materialType] || [];
        grouped[m.materialType].push({
          id: m.id,
          lessonId: l.id,
          lessonTitle: l.title,
          title: m.title,
          fileUrl: m.fileUrl,
          linkUrl: m.linkUrl,
          fileName: m.fileName,
          fileSize: m.fileSize,
          thumbnailUrl: m.thumbnailUrl,
          orderIndex: m.orderIndex,
        });
      });
    });
    res.json({ success: true, resources: grouped });
  } catch (e) {
    console.error('listCourseResources:', e.message);
    res.status(500).json({ error: 'Failed to load resources' });
  }
}

// GET /api/participant/courses/:courseId/quizzes — all PUBLISHED quizzes with status
async function listCourseQuizzes(req, res) {
  try {
    const ctx = await loadEnrolledCourse(req, res, req.params.courseId);
    if (!ctx) return;
    const { course } = ctx;

    const quizzes = await AIQuiz.findAll({
      where: { courseId: course.id, status: 'PUBLISHED' },
      include: [
        { model: Lesson,    as: 'lesson',    attributes: ['id', 'title'], required: false },
        { model: AIQuestion, as: 'questions', attributes: ['id'], required: false },
      ],
      order: [['id', 'DESC']],
    });
    if (quizzes.length === 0) return res.json({ success: true, quizzes: [] });

    const ids = quizzes.map(q => q.id);
    const [attempts, results] = await Promise.all([
      QuizAttempt.findAll({
        where: { quizId: ids, participantId: req.user.id },
        attributes: ['id', 'quizId', 'status'],
      }),
      QuizResult.findAll({
        where: { quizId: ids, participantId: req.user.id },
        attributes: ['quizId', 'percentage'],
      }),
    ]);
    const attemptMap = Object.fromEntries(attempts.map(a => [String(a.quizId), a]));
    const resultMap = Object.fromEntries(results.map(r => [String(r.quizId), r]));

    const out = quizzes.map(q => {
      const attempt = attemptMap[String(q.id)];
      const result = resultMap[String(q.id)];
      const showScore = q.resultStatus === 'PUBLISHED' && !!result;
      return {
        quizId: q.id,
        title: q.title,
        lessonId: q.lessonId,
        lessonTitle: q.lesson?.title || null,
        questionCount: (q.questions || []).length,
        isMandatory: q.isMandatory,
        myStatus: attempt?.status || 'NOT_STARTED', // IN_PROGRESS | SUBMITTED
        resultStatus: q.resultStatus,
        myScore: showScore ? Number(result.percentage) : null,
      };
    });
    res.json({ success: true, quizzes: out });
  } catch (e) {
    console.error('listCourseQuizzes:', e.message);
    res.status(500).json({ error: 'Failed to list course quizzes' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lesson detail + view
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/participant/lessons/:lessonId — materials + linked quizzes + assessments
async function getLessonDetail(req, res) {
  try {
    const ctx = await loadEnrolledLesson(req, res, req.params.lessonId);
    if (!ctx) return;
    const { lesson } = ctx;

    const [materials, quizzes, assessments, progress] = await Promise.all([
      LessonMaterial.findAll({ where: { lessonId: lesson.id }, order: [['orderIndex', 'ASC']] }),
      AIQuiz.findAll({
        where: { lessonId: lesson.id, status: 'PUBLISHED' },
        include: [{ model: AIQuestion, as: 'questions', attributes: ['id'] }],
      }),
      LessonAssessment.findAll({ where: { lessonId: lesson.id } }),
      LessonProgress.findOne({ where: { lessonId: lesson.id, participantId: req.user.id } }),
    ]);

    // Quiz status per quiz for this participant
    const quizIds = quizzes.map(q => q.id);
    const attempts = quizIds.length === 0 ? [] : await QuizAttempt.findAll({
      where: { quizId: quizIds, participantId: req.user.id },
    });
    const attemptByQuiz = Object.fromEntries(attempts.map(a => [String(a.quizId), a]));

    // Assessment submission status per assessment
    const assessmentIds = assessments.map(a => a.id);
    const submissions = assessmentIds.length === 0 ? [] : await AssessmentSubmission.findAll({
      where: { assessmentId: assessmentIds, participantId: req.user.id },
    });
    const submissionByAssessment = Object.fromEntries(submissions.map(s => [String(s.assessmentId), s]));

    res.json({
      success: true,
      lesson: {
        id: lesson.id,
        courseId: lesson.courseId,
        title: lesson.title,
        description: lesson.description,
        content: lesson.content,
        orderIndex: lesson.orderIndex,
      },
      materials,
      quizzes: quizzes.map(q => {
        const a = attemptByQuiz[String(q.id)];
        return {
          quizId: q.id,
          title: q.title,
          questionCount: q.questions?.length || 0,
          isMandatory: q.isMandatory,
          myStatus: a?.status || 'NOT_STARTED',
          resultStatus: q.resultStatus,
        };
      }),
      assessments: assessments.map(a => {
        const sub = submissionByAssessment[String(a.id)];
        return {
          assessmentId: a.id,
          title: a.title,
          instructions: a.instructions,
          maxScore: Number(a.maxScore),
          isMandatory: a.isMandatory,
          myStatus: sub?.status || 'NOT_STARTED',
          mySubmittedAt: sub?.submittedAt || null,
        };
      }),
      progress: progress ? {
        status: progress.status,
        contentViewed: progress.contentViewed,
        completedAt: progress.completedAt,
      } : { status: 'NOT_STARTED', contentViewed: false, completedAt: null },
    });
  } catch (e) {
    console.error('getLessonDetail:', e.message);
    res.status(500).json({ error: 'Failed to load lesson' });
  }
}

// POST /api/participant/lessons/:lessonId/view  — mark content_viewed = true
async function markLessonViewed(req, res) {
  try {
    const ctx = await loadEnrolledLesson(req, res, req.params.lessonId);
    if (!ctx) return;
    const { lesson, course } = ctx;

    const [progress] = await LessonProgress.findOrCreate({
      where: { lessonId: lesson.id, participantId: req.user.id },
      defaults: { lessonId: lesson.id, participantId: req.user.id, status: 'IN_PROGRESS', contentViewed: true },
    });
    if (!progress.contentViewed) {
      await progress.update({ contentViewed: true, status: 'IN_PROGRESS' });
    }
    await recomputeCourseProgress(course.id, req.user.id);
    res.json({ success: true, message: 'Marked as viewed' });
  } catch (e) {
    console.error('markLessonViewed:', e.message);
    res.status(500).json({ error: 'Failed to mark lesson viewed' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quizzes (course-scoped)
// ─────────────────────────────────────────────────────────────────────────────

async function loadAccessibleQuiz(req, res, quizId) {
  const id = parseInt(quizId, 10);
  if (!id) { res.status(422).json({ error: 'Invalid quizId' }); return null; }
  const quiz = await AIQuiz.findByPk(id);
  if (!quiz) { res.status(404).json({ error: 'Quiz not found' }); return null; }
  if (!quiz.courseId) { res.status(403).json({ error: 'Quiz not associated with a course' }); return null; }
  // Must be enrolled in the quiz's course.
  const enrollment = await Enrollment.findOne({
    where: { courseId: quiz.courseId, participantId: req.user.id, status: 'ENROLLED' },
  });
  if (!enrollment) { res.status(403).json({ error: 'You are not enrolled in this course' }); return null; }
  return { quiz, enrollment };
}

// POST /api/participant/quizzes/:quizId/start  → returns attemptId + questions (without correct answers)
async function startQuiz(req, res) {
  try {
    const ctx = await loadAccessibleQuiz(req, res, req.params.quizId);
    if (!ctx) return;
    const { quiz } = ctx;

    if (quiz.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'Quiz not published' });
    }

    // Reuse an in-progress attempt or create a new one.
    let [attempt] = await QuizAttempt.findAll({
      where: { quizId: quiz.id, participantId: req.user.id, status: 'IN_PROGRESS' },
      order: [['id', 'DESC']],
      limit: 1,
    });
    if (!attempt) {
      attempt = await QuizAttempt.create({
        quizId: quiz.id,
        participantId: req.user.id,
        status: 'IN_PROGRESS',
      });
    }

    const questions = await AIQuestion.findAll({
      where: { quizId: quiz.id },
      attributes: ['id', 'questionText', 'questionType', 'options', 'order'],
      order: [['order', 'ASC'], ['id', 'ASC']],
    });

    res.json({
      success: true,
      attemptId: attempt.id,
      quiz: {
        quizId: quiz.id,
        title: quiz.title,
        timeLimit: quiz.timeLimit,
      },
      // NB: correctAnswer is NOT returned.
      questions: questions.map(q => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        order: q.order,
      })),
    });
  } catch (e) {
    console.error('startQuiz:', e.message);
    res.status(500).json({ error: 'Failed to start quiz' });
  }
}

// POST /api/participant/quizzes/:quizId/submit  { attemptId, answers: [{questionId, answer}] }
async function submitQuiz(req, res) {
  try {
    const ctx = await loadAccessibleQuiz(req, res, req.params.quizId);
    if (!ctx) return;
    const { quiz } = ctx;

    const { attemptId, answers } = req.body;
    if (!Array.isArray(answers)) {
      return res.status(422).json({ error: 'answers[] is required' });
    }
    const attempt = await QuizAttempt.findOne({
      where: { id: attemptId, quizId: quiz.id, participantId: req.user.id },
    });
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.status === 'SUBMITTED') {
      return res.status(409).json({ error: 'Quiz already submitted' });
    }

    const questions = await AIQuestion.findAll({ where: { quizId: quiz.id } });
    const correctByQ = Object.fromEntries(questions.map(q => [String(q.id), q.correctAnswer]));

    let correct = 0;
    const total = questions.length;

    await sequelize.transaction(async t => {
      // Wipe any prior partial answers for this attempt then recreate.
      await QuizAnswer.destroy({ where: { attemptId: attempt.id }, transaction: t });

      // Index lookup so we can store both the raw answer text and the
      // option index (helpful for the review screen).
      const optionsByQ = Object.fromEntries(questions.map(q => [String(q.id), Array.isArray(q.options) ? q.options : []]));

      const answerRows = answers.map(a => {
        const qid = String(a.questionId);
        const expected = correctByQ[qid];
        const submittedText = String(a.answer ?? '').trim();
        const isCorrect = expected != null && submittedText === String(expected).trim();
        if (isCorrect) correct++;
        const optionIdx = optionsByQ[qid] ? optionsByQ[qid].findIndex(o => String(o).trim() === submittedText) : -1;
        return {
          attemptId:      attempt.id,
          questionId:     a.questionId,
          answerText:     submittedText,
          selectedOption: optionIdx >= 0 ? optionIdx : null,
          isCorrect,
          score:          isCorrect ? 1 : 0,
        };
      });
      await QuizAnswer.bulkCreate(answerRows, { transaction: t });

      const submittedAt = new Date();
      await attempt.update({
        status:      'SUBMITTED',
        submittedAt,
        timeTaken:   attempt.startedAt
          ? Math.max(1, Math.round((submittedAt.getTime() - new Date(attempt.startedAt).getTime()) / 1000))
          : null,
      }, { transaction: t });

      // Persist canonical score on QuizResult (stays HIDDEN until trainer publishes).
      const percentage = total > 0 ? (correct / total) * 100 : 0;
      const totalScore = correct;
      const maxScore = total;

      await QuizResult.upsert({
        attemptId:      attempt.id,
        quizId:         quiz.id,
        participantId:  req.user.id,
        totalScore,
        maxScore,
        percentage:     Number(percentage.toFixed(2)),
        evaluatedAt:    submittedAt,
      }, { transaction: t });
    });

    // Recompute course progress (mandatory quiz might have flipped completion).
    await recomputeCourseProgress(quiz.courseId, req.user.id);

    // Note: never return the score here. Score is only revealed via /result
    // after the trainer flips result_status.
    res.json({
      success: true,
      message: 'Quiz submitted. Results will be revealed once your trainer publishes them.',
      attemptId: attempt.id,
    });
  } catch (e) {
    console.error('submitQuiz:', e.message);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
}

// GET /api/participant/quizzes/:quizId/result
async function getQuizResult(req, res) {
  try {
    const ctx = await loadAccessibleQuiz(req, res, req.params.quizId);
    if (!ctx) return;
    const { quiz } = ctx;

    const attempt = await QuizAttempt.findOne({
      where: { quizId: quiz.id, participantId: req.user.id, status: 'SUBMITTED' },
      order: [['id', 'DESC']],
    });
    if (!attempt) {
      return res.json({ success: true, status: 'NOT_SUBMITTED', resultStatus: quiz.resultStatus });
    }

    if (quiz.resultStatus !== 'PUBLISHED') {
      return res.json({
        success: true,
        status: 'SUBMITTED_HIDDEN',
        resultStatus: 'HIDDEN',
        message: 'Quiz submitted. Results will be revealed when your trainer publishes them.',
        submittedAt: attempt.submittedAt,
      });
    }

    const result = await QuizResult.findOne({ where: { attemptId: attempt.id } });
    const reviewQuestions = await AIQuestion.findAll({
      where: { quizId: quiz.id },
      order: [['order', 'ASC'], ['id', 'ASC']],
    });
    const myAnswers = await QuizAnswer.findAll({ where: { attemptId: attempt.id } });
    const answerMap = Object.fromEntries(myAnswers.map(a => [String(a.questionId), a]));

    res.json({
      success: true,
      status: 'PUBLISHED',
      resultStatus: 'PUBLISHED',
      score: result ? Number(result.percentage) : null,
      totalScore: result ? Number(result.totalScore) : null,
      maxScore: result ? Number(result.maxScore) : null,
      submittedAt: attempt.submittedAt,
      review: reviewQuestions.map(q => {
        const my = answerMap[String(q.id)];
        return {
          questionId: q.id,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          myAnswer: my?.answerText || null,
          mySelectedOption: my?.selectedOption ?? null,
          isCorrect: my?.isCorrect || false,
          explanation: q.explanation || null,
        };
      }),
    });
  } catch (e) {
    console.error('getQuizResult:', e.message);
    res.status(500).json({ error: 'Failed to load quiz result' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessments
// ─────────────────────────────────────────────────────────────────────────────

async function loadAccessibleAssessment(req, res, assessmentId) {
  const id = parseInt(assessmentId, 10);
  if (!id) { res.status(422).json({ error: 'Invalid assessmentId' }); return null; }
  const assessment = await LessonAssessment.findByPk(id, {
    include: [{ model: Lesson, as: 'lesson' }],
  });
  if (!assessment || !assessment.lesson) {
    res.status(404).json({ error: 'Assessment not found' });
    return null;
  }
  if (!assessment.lesson.courseId) {
    res.status(404).json({ error: 'Assessment not associated with a course' });
    return null;
  }
  const enrollment = await Enrollment.findOne({
    where: { courseId: assessment.lesson.courseId, participantId: req.user.id, status: 'ENROLLED' },
  });
  if (!enrollment) { res.status(403).json({ error: 'You are not enrolled in this course' }); return null; }
  return { assessment, lesson: assessment.lesson };
}

// POST /api/participant/assessments/:assessmentId/submit  { content, fileUrl }
async function submitAssessment(req, res) {
  try {
    const ctx = await loadAccessibleAssessment(req, res, req.params.assessmentId);
    if (!ctx) return;
    const { assessment, lesson } = ctx;

    const { content, fileUrl } = req.body;
    if (!content && !fileUrl) {
      return res.status(422).json({ error: 'content or fileUrl is required' });
    }

    const [submission] = await AssessmentSubmission.findOrCreate({
      where: { assessmentId: assessment.id, participantId: req.user.id },
      defaults: {
        assessmentId: assessment.id,
        participantId: req.user.id,
        content,
        fileUrl,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
    if (submission.status !== 'NOT_STARTED' && submission.status !== 'SUBMITTED') {
      return res.status(409).json({ error: 'Assessment already graded; cannot resubmit' });
    }
    await submission.update({
      content,
      fileUrl,
      status: 'SUBMITTED',
      submittedAt: new Date(),
    });

    await recomputeCourseProgress(lesson.courseId, req.user.id);
    res.status(201).json({ success: true, message: 'Assessment submitted', submissionId: submission.id });
  } catch (e) {
    console.error('submitAssessment:', e.message);
    res.status(500).json({ error: 'Failed to submit assessment' });
  }
}

// GET /api/participant/assessments/:assessmentId/result
async function getAssessmentResult(req, res) {
  try {
    const ctx = await loadAccessibleAssessment(req, res, req.params.assessmentId);
    if (!ctx) return;
    const { assessment } = ctx;

    const submission = await AssessmentSubmission.findOne({
      where: { assessmentId: assessment.id, participantId: req.user.id },
    });
    if (!submission) return res.json({ success: true, status: 'NOT_STARTED' });

    if (submission.status !== 'PUBLISHED') {
      return res.json({
        success: true,
        status: submission.status, // SUBMITTED or REVIEWED — both still hidden from participant
        message: 'Submission received. Result will be available once your trainer publishes it.',
      });
    }

    res.json({
      success: true,
      status: 'PUBLISHED',
      score: submission.score != null ? Number(submission.score) : null,
      maxScore: Number(assessment.maxScore),
      feedback: submission.feedback,
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt,
    });
  } catch (e) {
    console.error('getAssessmentResult:', e.message);
    res.status(500).json({ error: 'Failed to load assessment result' });
  }
}

module.exports = {
  // Enrollment
  enroll,
  unenroll,
  // Courses
  listMyCourses,
  explore,
  getCourseOverview,
  listCourseLessons,
  listCourseResources,
  listCourseQuizzes,
  // Lessons
  getLessonDetail,
  markLessonViewed,
  // Quizzes
  startQuiz,
  submitQuiz,
  getQuizResult,
  // Assessments
  submitAssessment,
  getAssessmentResult,
};
