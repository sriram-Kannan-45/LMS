/**
 * Centralized API configuration.
 *
 * ALL frontend code MUST use these constants — never hardcode
 * 'http://localhost:3001' anywhere else. This allows the backend
 * URL to be changed via the VITE_API_URL environment variable.
 *
 * Architecture:
 *   Frontend (5173) → Node Backend (3001) → Python AI Service (8000)
 *
 * The frontend NEVER calls the Python AI service directly.
 */

/** Base origin of the Node backend — no trailing slash, no /api */
const BACKEND_ORIGIN = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')   // strip /api if accidentally included
  : 'http://localhost:3001';

/** Base for all REST API calls: http://localhost:3001/api */
const API_BASE = `${BACKEND_ORIGIN}/api`;

/**
 * Resolve a server-relative asset path (e.g. /uploads/trainer/photo.jpg)
 * to an absolute URL that the browser can load.
 *
 * Usage:  <img src={assetUrl(trainer.profile.imagePath)} />
 */
export const assetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  return `${BACKEND_ORIGIN}${path}`;
};

export const API = {
  LOGIN:           `${API_BASE}/auth/login`,
  REGISTER:        `${API_BASE}/auth/register`,
  CHANGE_PASSWORD: `${API_BASE}/auth/change-password`,

  FORGOT_PASSWORD: {
    SEND_OTP:   `${API_BASE}/auth/forgot-password/send-otp`,
    VERIFY_OTP: `${API_BASE}/auth/forgot-password/verify-otp`,
    RESET:      `${API_BASE}/auth/forgot-password/reset`
  },

  ADMIN: {
    CREATE_TRAINER:  `${API_BASE}/admin/create-trainer`,
    TRAININGS:       `${API_BASE}/admin/trainings`,
    TRAINERS:        `${API_BASE}/admin/trainers`,
    PARTICIPANTS:    `${API_BASE}/admin/participants`,
    DELETE_TRAINING: `${API_BASE}/admin/delete-training`,
    NOTES:           `${API_BASE}/notes/admin/notes`
  },

  PARTICIPANT: {
    TRAININGS:     `${API_BASE}/trainings`,
    ENROLL:        `${API_BASE}/participant/enroll`,
    MY_ENROLLMENTS:`${API_BASE}/participant/enrollments`
  },

  FEEDBACK: {
    SUBMIT: `${API_BASE}/feedback`
  },

  NOTES: {
    ADMIN: `${API_BASE}/notes/admin/notes`
  },

  TRAININGS: {
    LIST: `${API_BASE}/trainer/trainings`
  },

  /** Backend health-check proxy for the AI microservice */
  AI_HEALTH: `${API_BASE}/ai/health`,

  AI_QUIZ: {
    TRAINER_UPLOAD:     `${API_BASE}/ai-quiz/trainer/upload-document`,
    TRAINER_QUIZZES:    `${API_BASE}/ai-quiz/trainer/quizzes`,
    TRAINER_UPDATE_QUIZ:(id) => `${API_BASE}/ai-quiz/trainer/quiz/${id}`,
    PARTICIPANT_QUIZZES:`${API_BASE}/ai-quiz/participant/quizzes`,
    START:              (quizId)   => `${API_BASE}/ai-quiz/participant/start/${quizId}`,
    SUBMIT:             (attemptId)=> `${API_BASE}/ai-quiz/participant/submit/${attemptId}`,
    LEADERBOARD:        (quizId)   => `${API_BASE}/ai-quiz/leaderboard/${quizId}`
  },

  /** Lesson workflow: lessons + quiz/assessment gating, results & dashboards */
  LESSONS: {
    // Trainer authoring
    CREATE:             `${API_BASE}/lessons`,
    TRAINER_LIST:       `${API_BASE}/lessons/trainer`,
    ATTACH_QUIZ:        (lessonId) => `${API_BASE}/lessons/${lessonId}/quizzes`,
    CREATE_ASSESSMENT:  (lessonId) => `${API_BASE}/lessons/${lessonId}/assessments`,
    // Trainer dashboard + publishing
    DASHBOARD:          (lessonId) => `${API_BASE}/lessons/${lessonId}/dashboard`,
    PUBLISH_QUIZ:       (lessonQuizId) => `${API_BASE}/lessons/quizzes/${lessonQuizId}/publish`,
    // Trainer assessment review
    SUBMISSIONS:        (assessmentId) => `${API_BASE}/lessons/assessments/${assessmentId}/submissions`,
    GRADE:              (submissionId) => `${API_BASE}/lessons/submissions/${submissionId}/grade`,
    PUBLISH_ASSESSMENT: (submissionId) => `${API_BASE}/lessons/submissions/${submissionId}/publish`,
    // Participant
    PARTICIPANT_LIST:   `${API_BASE}/lessons/participant`,
    VIEW_CONTENT:       (lessonId) => `${API_BASE}/lessons/${lessonId}/view`,
    COMPLETE_QUIZ:      (lessonQuizId) => `${API_BASE}/lessons/quizzes/${lessonQuizId}/complete`,
    SUBMIT_ASSESSMENT:  (assessmentId) => `${API_BASE}/lessons/assessments/${assessmentId}/submit`,
    QUIZ_RESULT:        (lessonQuizId) => `${API_BASE}/lessons/quizzes/${lessonQuizId}/result`,
    ASSESSMENT_RESULT:  (assessmentId) => `${API_BASE}/lessons/assessments/${assessmentId}/result`
  },

  /**
   * Course-centric endpoints (Steps 2–4 of the course restructure).
   * Admin owns programs+courses. Trainer manages lessons/materials/quizzes
   * for assigned courses. Participant browses enrolled courses.
   */
  ADMIN_COURSES: {
    PROGRAMS:               `${API_BASE}/admin/training-programs`,
    PROGRAM:        (id) => `${API_BASE}/admin/training-programs/${id}`,
    PROGRAM_COURSES:(id) => `${API_BASE}/admin/training-programs/${id}/courses`,
    COURSES:                `${API_BASE}/admin/courses`,
    COURSE:         (id) => `${API_BASE}/admin/courses/${id}`,
  },

  TRAINER_COURSES: {
    LIST:                                 `${API_BASE}/trainer/courses`,
    DETAIL:        (courseId)          => `${API_BASE}/trainer/courses/${courseId}`,

    LESSONS:       (courseId)          => `${API_BASE}/trainer/courses/${courseId}/lessons`,
    LESSON:        (courseId, lessonId)=> `${API_BASE}/trainer/courses/${courseId}/lessons/${lessonId}`,
    REORDER_LESSONS:(courseId)         => `${API_BASE}/trainer/courses/${courseId}/lessons/reorder`,

    MATERIALS:     (lessonId)          => `${API_BASE}/trainer/lessons/${lessonId}/materials`,
    MATERIAL:      (lessonId, id)      => `${API_BASE}/trainer/lessons/${lessonId}/materials/${id}`,
    REORDER_MATERIALS:(lessonId)       => `${API_BASE}/trainer/lessons/${lessonId}/materials/reorder`,

    QUIZ_MANUAL:   (courseId)          => `${API_BASE}/trainer/courses/${courseId}/quiz/manual`,
    QUIZZES:       (courseId)          => `${API_BASE}/trainer/courses/${courseId}/quizzes`,
    QUIZ:          (courseId, quizId)  => `${API_BASE}/trainer/courses/${courseId}/quizzes/${quizId}`,
    PUBLISH_QUIZ:  (courseId, quizId)  => `${API_BASE}/trainer/courses/${courseId}/quizzes/${quizId}/publish`,
    QUIZ_DASHBOARD:(courseId, quizId)  => `${API_BASE}/trainer/courses/${courseId}/quizzes/${quizId}/dashboard`,

    PARTICIPANTS:  (courseId)          => `${API_BASE}/trainer/courses/${courseId}/participants`,
    PARTICIPANT:   (courseId, userId)  => `${API_BASE}/trainer/courses/${courseId}/participants/${userId}`,

    ANALYTICS:     (courseId)          => `${API_BASE}/trainer/courses/${courseId}/analytics`,

    ASSESSMENTS:   (courseId, lessonId)=> `${API_BASE}/trainer/courses/${courseId}/lessons/${lessonId}/assessments`,
    ASSESSMENT:    (assessmentId)      => `${API_BASE}/trainer/assessments/${assessmentId}`,
    SUBMISSIONS:   (assessmentId)      => `${API_BASE}/trainer/assessments/${assessmentId}/submissions`,
    GRADE:         (submissionId)      => `${API_BASE}/trainer/submissions/${submissionId}/grade`,
    PUBLISH_SUB:   (submissionId)      => `${API_BASE}/trainer/submissions/${submissionId}/publish`,
  },

  PARTICIPANT_COURSES: {
    ENROLL:                   `${API_BASE}/participant/enroll`,
    UNENROLL:    (courseId)=> `${API_BASE}/participant/enroll/${courseId}`,

    LIST:                     `${API_BASE}/participant/courses`,
    EXPLORE:                  `${API_BASE}/participant/courses/explore`,
    OVERVIEW:    (courseId)=> `${API_BASE}/participant/courses/${courseId}`,
    LESSONS:     (courseId)=> `${API_BASE}/participant/courses/${courseId}/lessons`,
    RESOURCES:   (courseId)=> `${API_BASE}/participant/courses/${courseId}/resources`,
    QUIZZES:     (courseId)=> `${API_BASE}/participant/courses/${courseId}/quizzes`,

    LESSON:      (lessonId)=> `${API_BASE}/participant/lessons/${lessonId}`,
    VIEW_LESSON: (lessonId)=> `${API_BASE}/participant/lessons/${lessonId}/view`,

    QUIZ_START:  (quizId)  => `${API_BASE}/participant/quizzes/${quizId}/start`,
    QUIZ_SUBMIT: (quizId)  => `${API_BASE}/participant/quizzes/${quizId}/submit`,
    QUIZ_RESULT: (quizId)  => `${API_BASE}/participant/quizzes/${quizId}/result`,

    ASSESSMENT_SUBMIT: (assessmentId) => `${API_BASE}/participant/assessments/${assessmentId}/submit`,
    ASSESSMENT_RESULT: (assessmentId) => `${API_BASE}/participant/assessments/${assessmentId}/result`,
  }
};

export { API_BASE, BACKEND_ORIGIN };