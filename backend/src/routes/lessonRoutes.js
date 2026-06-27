const express = require('express');
const c = require('../controllers/lessonController');
const authenticateToken = require('../middleware/auth');
const roleMiddleware = require('../middleware/roles');

const router = express.Router();
router.use(authenticateToken);

const trainer = roleMiddleware('TRAINER', 'ADMIN');
const participant = roleMiddleware('PARTICIPANT');

// ── Trainer: authoring ──
router.post('/', trainer, c.createLesson);
router.get('/trainer', trainer, c.getTrainerLessons);
router.post('/:lessonId/quizzes', trainer, c.attachQuiz);
router.post('/:lessonId/assessments', trainer, c.createAssessment);
router.post('/:lessonId/coding-assessments', trainer, c.attachCodingAssessment);

// ── Trainer: dashboard + publishing ──
router.get('/:lessonId/dashboard', trainer, c.getLessonDashboard);
router.post('/quizzes/:lessonQuizId/publish', trainer, c.publishQuizResults);
router.post('/coding-assessments/:lessonCodingId/publish', trainer, c.publishCodingAssessmentResults);

// ── Trainer: assessment review ──
router.get('/assessments/:assessmentId/submissions', trainer, c.getAssessmentSubmissions);
router.put('/submissions/:submissionId/grade', trainer, c.gradeAssessment);
router.post('/submissions/:submissionId/publish', trainer, c.publishAssessment);

// ── Participant: learning + submission ──
router.get('/participant', participant, c.getParticipantLessons);
router.post('/:lessonId/view', participant, c.viewContent);
router.post('/quizzes/:lessonQuizId/complete', participant, c.completeQuiz);
router.post('/assessments/:assessmentId/submit', participant, c.submitAssessment);
router.post('/coding-assessments/:lessonCodingId/complete', participant, c.completeCodingAssessment);

// ── Participant: result visibility ──
router.get('/quizzes/:lessonQuizId/result', participant, c.getQuizResult);
router.get('/assessments/:assessmentId/result', participant, c.getAssessmentResult);
router.get('/coding-assessments/:lessonCodingId/result', participant, c.getCodingAssessmentResult);

module.exports = router;
