/**
 * Centralized API configuration.
 *
 * ALL frontend code MUST use these constants — never hardcode
 * 'http://localhost:3001' anywhere else.
 */

/** Base origin of the Node backend — no trailing slash, no /api */
const BACKEND_ORIGIN = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
  : 'http://localhost:3001';

/** Base for all REST API calls: http://localhost:3001/api */
const API_BASE = `${BACKEND_ORIGIN}/api`;

/**
 * Resolve a server-relative asset path to an absolute URL.
 * Adds Cloudinary optimization parameters for images.
 */
export const assetUrl = (path, options = {}) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    // Add Cloudinary transformations for Cloudinary URLs
    if (path.includes('cloudinary.com') && options.optimize !== false) {
      const separator = path.includes('?') ? '&' : '?';
      return `${path}${separator}f_auto,q_auto,w_${options.width || 400}`;
    }
    return path;
  }
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

  LESSONS: {
    CREATE:             `${API_BASE}/lessons`,
    TRAINER_LIST:       `${API_BASE}/lessons/trainer`,
    ATTACH_QUIZ:        (lessonId) => `${API_BASE}/lessons/${lessonId}/quizzes`,
    CREATE_ASSESSMENT:  (lessonId) => `${API_BASE}/lessons/${lessonId}/assessments`,
    DASHBOARD:          (lessonId) => `${API_BASE}/lessons/${lessonId}/dashboard`,
    PUBLISH_QUIZ:       (lessonQuizId) => `${API_BASE}/lessons/quizzes/${lessonQuizId}/publish`,
    SUBMISSIONS:        (assessmentId) => `${API_BASE}/lessons/assessments/${assessmentId}/submissions`,
    GRADE:              (submissionId) => `${API_BASE}/lessons/submissions/${submissionId}/grade`,
    PUBLISH_ASSESSMENT: (submissionId) => `${API_BASE}/lessons/submissions/${submissionId}/publish`,
    PARTICIPANT_LIST:   `${API_BASE}/lessons/participant`,
    VIEW_CONTENT:       (lessonId) => `${API_BASE}/lessons/${lessonId}/view`,
    COMPLETE_QUIZ:      (lessonQuizId) => `${API_BASE}/lessons/quizzes/${lessonQuizId}/complete`,
    SUBMIT_ASSESSMENT:  (assessmentId) => `${API_BASE}/lessons/assessments/${assessmentId}/submit`,
    QUIZ_RESULT:        (lessonQuizId) => `${API_BASE}/lessons/quizzes/${lessonQuizId}/result`,
    ASSESSMENT_RESULT:  (assessmentId) => `${API_BASE}/lessons/assessments/${assessmentId}/result`
  },

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
    AVAILABLE_PARTICIPANTS: (courseId) => `${API_BASE}/trainer/courses/${courseId}/available-participants`,
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
  },

  CODING: {
    ASSESSMENTS:          `${API_BASE}/coding/assessments`,
    ASSESSMENT:     (id) => `${API_BASE}/coding/assessments/${id}`,
    QUESTIONS:      (id) => `${API_BASE}/coding/assessments/${id}/questions`,
    GENERATE_Q:     (id) => `${API_BASE}/coding/assessments/${id}/generate-question`,
    PLAGIARISM_CHECK:   (id) => `${API_BASE}/coding/assessments/${id}/plagiarism-check`,
    PLAGIARISM_REPORTS: (id) => `${API_BASE}/coding/assessments/${id}/plagiarism-reports`,
    RESULTS:        (id) => `${API_BASE}/coding/assessments/${id}/results`,
    P_ASSESSMENTS:        `${API_BASE}/coding/participant/assessments`,
    P_ASSESSMENT:   (id) => `${API_BASE}/coding/participant/assessments/${id}`,
    START:          (id) => `${API_BASE}/coding/participant/assessments/${id}/start`,
    RUN:     (attemptId) => `${API_BASE}/coding/participant/attempts/${attemptId}/run`,
    SUBMIT:  (attemptId) => `${API_BASE}/coding/participant/attempts/${attemptId}/submit`,
    REVIEW:      (subId) => `${API_BASE}/coding/participant/submissions/${subId}/review`,
    VIOLATION:(attemptId)=> `${API_BASE}/coding/participant/attempts/${attemptId}/violation`,
  }
};

export { API_BASE, BACKEND_ORIGIN };
