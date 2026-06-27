const {
  Lesson, LessonQuiz, LessonAssessment, AssessmentSubmission,
  QuizProgress, LessonProgress, Enrollment, AIQuiz, User,
  LessonCodingAssessment, CodingAssessment, CodingAttempt,
} = require('../models');
const NotificationService = require('../services/notificationService');

// ── Helpers ──────────────────────────────────────────────────────────────────

// Participants "assigned" to a lesson = participants enrolled in its training.
const assignedParticipantIds = async (trainingId) => {
  const rows = await Enrollment.findAll({
    where: { trainingId, status: 'ENROLLED' },
    attributes: ['participantId']
  });
  return rows.map(r => r.participantId);
};

// Completion stats for one lesson quiz: total / completed / pending.
const quizStats = async (lessonQuiz) => {
  const lesson = await Lesson.findByPk(lessonQuiz.lessonId);
  const ids = await assignedParticipantIds(lesson.trainingId);
  const completed = ids.length
    ? await QuizProgress.count({
        where: { lessonQuizId: lessonQuiz.id, participantId: ids, status: 'COMPLETED' }
      })
    : 0;
  return { total: ids.length, completed, pending: ids.length - completed, assignedIds: ids };
};

// Completion stats for one coding assessment: total / submitted / pending.
const codingAssessmentStats = async (lessonCoding) => {
  const lesson = await Lesson.findByPk(lessonCoding.lessonId);
  const ids = await assignedParticipantIds(lesson.trainingId);
  const submitted = ids.length
    ? await CodingAttempt.count({
        where: { assessmentId: lessonCoding.assessmentId, participantId: ids, status: ['SUBMITTED', 'AUTO_SUBMITTED'] }
      })
    : 0;
  return { total: ids.length, completed: submitted, pending: ids.length - submitted, assignedIds: ids };
};

// ── Trainer: authoring ───────────────────────────────────────────────────────

const createLesson = async (req, res) => {
  try {
    const { trainingId, title, content, orderIndex } = req.body;
    if (!trainingId || !title) return res.status(422).json({ error: 'trainingId and title are required' });
    const lesson = await Lesson.create({
      trainingId, title, content, orderIndex: orderIndex || 0, trainerId: req.user.id
    });
    res.status(201).json({ lesson });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const getTrainerLessons = async (req, res) => {
  try {
    const where = { trainerId: req.user.id };
    if (req.query.trainingId) where.trainingId = req.query.trainingId;
    const lessons = await Lesson.findAll({
      where,
      include: [
        { model: LessonQuiz, as: 'quizzes', include: [{ model: AIQuiz, as: 'quiz', attributes: ['id', 'title'] }] },
        { model: LessonAssessment, as: 'assessments' },
        { model: LessonCodingAssessment, as: 'codingAssessments', include: [{ model: CodingAssessment, as: 'assessment', attributes: ['id', 'title', 'status'] }] },
      ],
      order: [['orderIndex', 'ASC']]
    });
    res.json({ lessons });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const attachQuiz = async (req, res) => {
  try {
    const { quizId, isMandatory } = req.body;
    const lesson = await Lesson.findByPk(req.params.lessonId);
    if (!lesson || lesson.trainerId !== req.user.id) return res.status(404).json({ error: 'Lesson not found' });
    if (!await AIQuiz.findByPk(quizId)) return res.status(404).json({ error: 'Quiz not found' });
    const link = await LessonQuiz.create({
      lessonId: lesson.id, quizId, isMandatory: isMandatory !== false
    });
    res.status(201).json({ lessonQuiz: link });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const createAssessment = async (req, res) => {
  try {
    const { title, instructions, maxScore, isMandatory } = req.body;
    const lesson = await Lesson.findByPk(req.params.lessonId);
    if (!lesson || lesson.trainerId !== req.user.id) return res.status(404).json({ error: 'Lesson not found' });
    const assessment = await LessonAssessment.create({
      lessonId: lesson.id, title, instructions, maxScore: maxScore || 100, isMandatory: isMandatory !== false
    });
    res.status(201).json({ assessment });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const attachCodingAssessment = async (req, res) => {
  try {
    const { assessmentId, isMandatory } = req.body;
    const lesson = await Lesson.findByPk(req.params.lessonId);
    if (!lesson || lesson.trainerId !== req.user.id) return res.status(404).json({ error: 'Lesson not found' });
    const ca = await CodingAssessment.findByPk(assessmentId);
    if (!ca || String(ca.trainerId) !== String(req.user.id)) return res.status(404).json({ error: 'Coding assessment not found' });
    const link = await LessonCodingAssessment.create({
      lessonId: lesson.id, assessmentId, isMandatory: isMandatory !== false
    });
    res.status(201).json({ lessonCodingAssessment: link });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Trainer: dashboard ───────────────────────────────────────────────────────

// Enrolled / completed / pending counts per quiz & coding assessment in a lesson, plus publish-eligibility.
const getLessonDashboard = async (req, res) => {
  try {
    const lesson = await Lesson.findByPk(req.params.lessonId, {
      include: [
        { model: LessonQuiz, as: 'quizzes', include: [{ model: AIQuiz, as: 'quiz', attributes: ['id', 'title'] }] },
        { model: LessonCodingAssessment, as: 'codingAssessments', include: [{ model: CodingAssessment, as: 'assessment', attributes: ['id', 'title'] }] },
      ]
    });
    if (!lesson || lesson.trainerId !== req.user.id) return res.status(404).json({ error: 'Lesson not found' });

    const quizzes = await Promise.all(lesson.quizzes.map(async (lq) => {
      const s = await quizStats(lq);
      return {
        lessonQuizId: lq.id,
        quizId: lq.quizId,
        title: lq.quiz?.title,
        resultStatus: lq.resultStatus,
        enrolled: s.total,
        completed: s.completed,
        pending: s.pending,
        canPublish: s.total > 0 && s.pending === 0 && lq.resultStatus === 'HIDDEN'
      };
    }));

    const codingAssessments = await Promise.all(lesson.codingAssessments.map(async (lca) => {
      const s = await codingAssessmentStats(lca);
      return {
        lessonCodingId: lca.id,
        assessmentId: lca.assessmentId,
        title: lca.assessment?.title,
        resultStatus: lca.resultStatus,
        enrolled: s.total,
        completed: s.completed,
        pending: s.pending,
        canPublish: s.total > 0 && s.pending === 0 && lca.resultStatus === 'HIDDEN'
      };
    }));

    res.json({ lessonId: lesson.id, quizzes, codingAssessments });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Trainer: publish quiz results (gated) ────────────────────────────────────

const publishQuizResults = async (req, res) => {
  try {
    const lq = await LessonQuiz.findByPk(req.params.lessonQuizId, { include: [{ model: Lesson, as: 'lesson' }] });
    if (!lq || lq.lesson.trainerId !== req.user.id) return res.status(404).json({ error: 'Lesson quiz not found' });

    const s = await quizStats(lq);
    if (s.total === 0 || s.pending > 0) {
      return res.status(409).json({ error: 'Results cannot be published until all assigned participants complete the quiz.' });
    }

    lq.resultStatus = 'PUBLISHED';
    lq.publishedAt = new Date();
    await lq.save();

    const io = req.app.get('io');
    await Promise.all(s.assignedIds.map(pid =>
      NotificationService.createNotification({
        userId: pid,
        message: 'Your quiz results have been published.',
        type: 'OTHER',
        actionUrl: `/lessons/${lq.lessonId}`,
        relatedEntityId: lq.id,
        relatedEntityType: 'LessonQuiz'
      }, io)
    ));
    res.json({ message: 'Quiz results published', lessonQuiz: lq });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Trainer: publish coding assessment results (gated) ───────────────────────

const publishCodingAssessmentResults = async (req, res) => {
  try {
    const lca = await LessonCodingAssessment.findByPk(req.params.lessonCodingId, { include: [{ model: Lesson, as: 'lesson' }] });
    if (!lca || lca.lesson.trainerId !== req.user.id) return res.status(404).json({ error: 'Lesson coding assessment not found' });

    const s = await codingAssessmentStats(lca);
    if (s.total === 0 || s.pending > 0) {
      return res.status(409).json({ error: 'Results cannot be published until all assigned participants complete the coding assessment.' });
    }

    lca.resultStatus = 'PUBLISHED';
    lca.publishedAt = new Date();
    await lca.save();

    const io = req.app.get('io');
    await Promise.all(s.assignedIds.map(pid =>
      NotificationService.createNotification({
        userId: pid,
        message: 'Your coding assessment results have been published.',
        type: 'OTHER',
        actionUrl: `/lessons/${lca.lessonId}`,
        relatedEntityId: lca.id,
        relatedEntityType: 'LessonCodingAssessment'
      }, io)
    ));
    res.json({ message: 'Coding assessment results published', lessonCodingAssessment: lca });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Trainer: assessment review / grade / publish ─────────────────────────────

const getAssessmentSubmissions = async (req, res) => {
  try {
    const assessment = await LessonAssessment.findByPk(req.params.assessmentId, { include: [{ model: Lesson, as: 'lesson' }] });
    if (!assessment || assessment.lesson.trainerId !== req.user.id) return res.status(404).json({ error: 'Assessment not found' });
    const submissions = await AssessmentSubmission.findAll({
      where: { assessmentId: assessment.id },
      include: [{ model: User, as: 'participant', attributes: ['id', 'name', 'email'] }]
    });
    res.json({ submissions });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const gradeAssessment = async (req, res) => {
  try {
    const { score, feedback } = req.body;
    const sub = await AssessmentSubmission.findByPk(req.params.submissionId, {
      include: [{ model: LessonAssessment, as: 'assessment', include: [{ model: Lesson, as: 'lesson' }] }]
    });
    if (!sub || sub.assessment.lesson.trainerId !== req.user.id) return res.status(404).json({ error: 'Submission not found' });
    sub.score = score;
    sub.feedback = feedback;
    sub.status = 'REVIEWED';
    sub.reviewedAt = new Date();
    await sub.save();
    res.json({ message: 'Assessment graded', submission: sub });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// Publish a graded assessment result to the participant (hidden until now).
const publishAssessment = async (req, res) => {
  try {
    const sub = await AssessmentSubmission.findByPk(req.params.submissionId, {
      include: [{ model: LessonAssessment, as: 'assessment', include: [{ model: Lesson, as: 'lesson' }] }]
    });
    if (!sub || sub.assessment.lesson.trainerId !== req.user.id) return res.status(404).json({ error: 'Submission not found' });
    if (sub.status !== 'REVIEWED') return res.status(409).json({ error: 'Grade the submission before publishing.' });
    sub.status = 'PUBLISHED';
    await sub.save();

    await NotificationService.createNotification({
      userId: sub.participantId,
      message: `Your assessment result for "${sub.assessment.title}" has been published.`,
      type: 'OTHER',
      actionUrl: `/lessons/${sub.assessment.lessonId}`,
      relatedEntityId: sub.id,
      relatedEntityType: 'AssessmentSubmission'
    }, req.app.get('io'));
    res.json({ message: 'Assessment result published', submission: sub });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Participant: view lessons ────────────────────────────────────────────────

const getParticipantLessons = async (req, res) => {
  try {
    const where = {};
    if (req.query.trainingId) where.trainingId = req.query.trainingId;
    const lessons = await Lesson.findAll({
      where,
      include: [
        { model: LessonQuiz, as: 'quizzes', include: [{ model: AIQuiz, as: 'quiz', attributes: ['id', 'title'] }] },
        { model: LessonAssessment, as: 'assessments' },
        { model: LessonCodingAssessment, as: 'codingAssessments', include: [{ model: CodingAssessment, as: 'assessment', attributes: ['id', 'title'] }] },
      ],
      order: [['orderIndex', 'ASC']]
    });
    res.json({ lessons });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const viewContent = async (req, res) => {
  try {
    const lesson = await Lesson.findByPk(req.params.lessonId);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    const [prog] = await LessonProgress.findOrCreate({
      where: { lessonId: lesson.id, participantId: req.user.id },
      defaults: { status: 'IN_PROGRESS' }
    });
    prog.contentViewed = true;
    if (prog.status === 'NOT_STARTED') prog.status = 'IN_PROGRESS';
    await prog.save();
    await evaluateLessonCompletion(lesson, req.user.id, req.app.get('io'));
    res.json({ message: 'Content marked as viewed', progress: prog });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// Participant completes a quiz. Score (computed by the quiz engine) is stored
// but never returned — results stay hidden until the trainer publishes.
const completeQuiz = async (req, res) => {
  try {
    const { score } = req.body;
    const lq = await LessonQuiz.findByPk(req.params.lessonQuizId, { include: [{ model: Lesson, as: 'lesson' }] });
    if (!lq) return res.status(404).json({ error: 'Lesson quiz not found' });

    const [prog] = await QuizProgress.findOrCreate({
      where: { lessonQuizId: lq.id, participantId: req.user.id },
      defaults: { status: 'IN_PROGRESS' }
    });
    prog.status = 'COMPLETED';
    prog.score = score != null ? score : prog.score;
    prog.completedAt = new Date();
    await prog.save();

    const io = req.app.get('io');
    await evaluateLessonCompletion(lq.lesson, req.user.id, io);

    // Notify trainer once ALL assigned participants have completed this quiz.
    const s = await quizStats(lq);
    if (s.total > 0 && s.pending === 0) {
      await NotificationService.createNotification({
        userId: lq.lesson.trainerId,
        message: `All participants have completed the quiz for lesson "${lq.lesson.title}". You can now publish results.`,
        type: 'OTHER',
        actionUrl: `/trainer/lessons/${lq.lessonId}`,
        relatedEntityId: lq.id,
        relatedEntityType: 'LessonQuiz'
      }, io);
    }
    res.json({ message: 'Quiz completed successfully. Your responses have been submitted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const submitAssessment = async (req, res) => {
  try {
    const { content, fileUrl } = req.body;
    const assessment = await LessonAssessment.findByPk(req.params.assessmentId);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const [sub] = await AssessmentSubmission.findOrCreate({
      where: { assessmentId: assessment.id, participantId: req.user.id },
      defaults: { status: 'SUBMITTED' }
    });
    sub.content = content;
    sub.fileUrl = fileUrl;
    sub.status = 'SUBMITTED';
    sub.submittedAt = new Date();
    await sub.save();

    const lesson = await Lesson.findByPk(assessment.lessonId);
    await evaluateLessonCompletion(lesson, req.user.id, req.app.get('io'));
    res.status(201).json({ message: 'Assessment submitted successfully.', submission: { id: sub.id, status: sub.status } });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Participant: complete coding assessment ──────────────────────────────────

const completeCodingAssessment = async (req, res) => {
  try {
    const lca = await LessonCodingAssessment.findByPk(req.params.lessonCodingId, { include: [{ model: Lesson, as: 'lesson' }] });
    if (!lca) return res.status(404).json({ error: 'Lesson coding assessment not found' });

    const attempt = await CodingAttempt.findOne({
      where: { assessmentId: lca.assessmentId, participantId: req.user.id, status: ['SUBMITTED', 'AUTO_SUBMITTED'] }
    });
    if (!attempt) return res.status(400).json({ error: 'No submitted attempt found for this coding assessment.' });

    const io = req.app.get('io');
    await evaluateLessonCompletion(lca.lesson, req.user.id, io);

    const s = await codingAssessmentStats(lca);
    if (s.total > 0 && s.pending === 0) {
      await NotificationService.createNotification({
        userId: lca.lesson.trainerId,
        message: `All participants have completed the coding assessment for lesson "${lca.lesson.title}". You can now publish results.`,
        type: 'OTHER',
        actionUrl: `/trainer/lessons/${lca.lessonId}`,
        relatedEntityId: lca.id,
        relatedEntityType: 'LessonCodingAssessment'
      }, io);
    }
    res.json({ message: 'Coding assessment completed.', attempt: { id: attempt.id, score: attempt.score } });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Participant: result visibility ───────────────────────────────────────────

const getQuizResult = async (req, res) => {
  try {
    const lq = await LessonQuiz.findByPk(req.params.lessonQuizId);
    if (!lq) return res.status(404).json({ error: 'Lesson quiz not found' });
    const prog = await QuizProgress.findOne({ where: { lessonQuizId: lq.id, participantId: req.user.id } });

    if (!prog || prog.status !== 'COMPLETED') {
      return res.json({ status: prog?.status || 'NOT_STARTED', resultStatus: lq.resultStatus });
    }
    if (lq.resultStatus !== 'PUBLISHED') {
      return res.json({
        status: 'COMPLETED',
        resultStatus: 'HIDDEN',
        message: 'Your quiz has been submitted. Results will be available once published by the trainer.'
      });
    }
    res.json({ status: 'COMPLETED', resultStatus: 'PUBLISHED', score: prog.score, completedAt: prog.completedAt });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const getAssessmentResult = async (req, res) => {
  try {
    const sub = await AssessmentSubmission.findOne({
      where: { assessmentId: req.params.assessmentId, participantId: req.user.id }
    });
    if (!sub) return res.json({ status: 'NOT_STARTED' });
    if (sub.status !== 'PUBLISHED') {
      return res.json({
        status: sub.status,
        message: 'Your assessment has been submitted. Results will be available once published by the trainer.'
      });
    }
    res.json({ status: 'PUBLISHED', score: sub.score, feedback: sub.feedback });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const getCodingAssessmentResult = async (req, res) => {
  try {
    const lca = await LessonCodingAssessment.findByPk(req.params.lessonCodingId);
    if (!lca) return res.status(404).json({ error: 'Lesson coding assessment not found' });

    const attempt = await CodingAttempt.findOne({
      where: { assessmentId: lca.assessmentId, participantId: req.user.id }
    });

    if (!attempt || !['SUBMITTED', 'AUTO_SUBMITTED'].includes(attempt.status)) {
      return res.json({ status: attempt?.status || 'NOT_STARTED', resultStatus: lca.resultStatus });
    }
    if (lca.resultStatus !== 'PUBLISHED') {
      return res.json({
        status: 'SUBMITTED',
        resultStatus: 'HIDDEN',
        message: 'Your coding assessment has been submitted. Results will be available once published by the trainer.'
      });
    }
    res.json({
      status: 'SUBMITTED',
      resultStatus: 'PUBLISHED',
      score: attempt.score,
      attemptId: attempt.id,
      submittedAt: attempt.submittedAt,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Lesson completion logic ──────────────────────────────────────────────────
// Complete when: content viewed AND all mandatory quizzes COMPLETED AND all
// mandatory assessments SUBMITTED (any of REVIEWED/PUBLISHED also counts) AND
// all mandatory coding assessments SUBMITTED.
const evaluateLessonCompletion = async (lesson, participantId, io) => {
  const [prog] = await LessonProgress.findOrCreate({
    where: { lessonId: lesson.id, participantId },
    defaults: { status: 'IN_PROGRESS' }
  });

  const quizzes = await LessonQuiz.findAll({ where: { lessonId: lesson.id, isMandatory: true } });
  const quizzesDone = (await Promise.all(quizzes.map(async (q) => {
    const p = await QuizProgress.findOne({ where: { lessonQuizId: q.id, participantId } });
    return p && p.status === 'COMPLETED';
  }))).every(Boolean);

  const assessments = await LessonAssessment.findAll({ where: { lessonId: lesson.id, isMandatory: true } });
  const assessmentsDone = (await Promise.all(assessments.map(async (a) => {
    const sub = await AssessmentSubmission.findOne({ where: { assessmentId: a.id, participantId } });
    return sub && ['SUBMITTED', 'REVIEWED', 'PUBLISHED'].includes(sub.status);
  }))).every(Boolean);

  const codingAssessments = await LessonCodingAssessment.findAll({ where: { lessonId: lesson.id, isMandatory: true } });
  const codingDone = (await Promise.all(codingAssessments.map(async (ca) => {
    const attempt = await CodingAttempt.findOne({ where: { assessmentId: ca.assessmentId, participantId } });
    return attempt && ['SUBMITTED', 'AUTO_SUBMITTED'].includes(attempt.status);
  }))).every(Boolean);

  const completed = prog.contentViewed && quizzesDone && assessmentsDone && codingDone;
  const next = completed ? 'COMPLETED' : (prog.contentViewed ? 'IN_PROGRESS' : prog.status);
  if (next !== prog.status) {
    prog.status = next;
    prog.completedAt = completed ? new Date() : null;
    await prog.save();
  }
  return prog;
};

module.exports = {
  createLesson, getTrainerLessons, attachQuiz, createAssessment,
  attachCodingAssessment,
  getLessonDashboard, publishQuizResults, publishCodingAssessmentResults,
  getAssessmentSubmissions, gradeAssessment, publishAssessment,
  getParticipantLessons, viewContent, completeQuiz, submitAssessment,
  completeCodingAssessment,
  getQuizResult, getAssessmentResult, getCodingAssessmentResult
};
