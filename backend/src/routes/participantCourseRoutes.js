/**
 * participantCourseRoutes.js
 * ──────────────────────────
 * Course-centric participant endpoints. Mounted under /api/participant
 * BEFORE the existing enrollmentRoutes so the more specific paths
 * (e.g. /courses, /lessons/:lessonId, /quizzes, /assessments) match first.
 *
 * The legacy POST /enroll and DELETE /enroll/:trainingId routes in
 * enrollmentRoutes are still available for backward compat — but the new
 * POST /enroll body now expects { courseId } (not trainingId), and the new
 * DELETE /enroll/:courseId is course-scoped. Where path collisions exist,
 * Express picks the first registered handler — so this file's handlers win.
 */
const express = require('express');
const c = require('../controllers/participantCourseController');
const authenticateToken = require('../middleware/auth');
const roleMiddleware = require('../middleware/roles');

const router = express.Router();
router.use(authenticateToken);

const participant = roleMiddleware('PARTICIPANT');

// ── Enrollment ───────────────────────────────────────────────────────────
router.post(  '/enroll',                          participant, c.enroll);
router.delete('/enroll/:courseId',                participant, c.unenroll);

// ── Courses ──────────────────────────────────────────────────────────────
router.get(   '/courses',                         participant, c.listMyCourses);
router.get(   '/courses/explore',                 participant, c.explore);
router.get(   '/courses/:courseId',               participant, c.getCourseOverview);
router.get(   '/courses/:courseId/lessons',       participant, c.listCourseLessons);
router.get(   '/courses/:courseId/resources',     participant, c.listCourseResources);
router.get(   '/courses/:courseId/quizzes',       participant, c.listCourseQuizzes);

// ── Lessons ──────────────────────────────────────────────────────────────
router.get(   '/lessons/:lessonId',               participant, c.getLessonDetail);
router.post(  '/lessons/:lessonId/view',          participant, c.markLessonViewed);

// ── Quizzes ──────────────────────────────────────────────────────────────
router.post(  '/quizzes/:quizId/start',           participant, c.startQuiz);
router.post(  '/quizzes/:quizId/submit',          participant, c.submitQuiz);
router.get(   '/quizzes/:quizId/result',          participant, c.getQuizResult);

// ── Assessments ──────────────────────────────────────────────────────────
router.post(  '/assessments/:assessmentId/submit', participant, c.submitAssessment);
router.get(   '/assessments/:assessmentId/result', participant, c.getAssessmentResult);

module.exports = router;
