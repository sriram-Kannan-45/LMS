const { sequelize } = require('../config/db');
const User = require('./user');
const Training = require('./training');
const TrainerProfile = require('./trainerProfile');
const Enrollment = require('./enrollment');
const Feedback = require('./feedback');

const Notification = require('./notification');
const SurveyQuestion = require('./surveyQuestion');
const SurveyAnswer = require('./surveyAnswer');
const Note = require('./note');
const ActivityLog = require('./activityLog');
const LiveSession = require('./liveSession');
const Attendance = require('./attendance');
const ChatMessage = require('./chatMessage');
const ParticipantProfile = require('./participantProfile');

const AIDocument = require('./aiDocument');
const AIQuiz = require('./aiQuiz');
const AIQuestion = require('./aiQuestion');
const AIQuestionOption = require('./aiQuestionOption');
const QuizAttempt = require('./quizAttempt');
const QuizAnswer = require('./quizAnswer');
const QuizResult = require('./quizResult');

const PasswordResetOtp = require('./PasswordResetOtp');
const AssessmentSession = require('./AssessmentSession');

// Lesson workflow module (lessons + quiz/assessment gating + progress)
const Lesson = require('./lesson');
const LessonQuiz = require('./lessonQuiz');
const LessonAssessment = require('./lessonAssessment');
const AssessmentSubmission = require('./assessmentSubmission');
const QuizProgress = require('./quizProgress');
const LessonProgress = require('./lessonProgress');
const LessonCodingAssessment = require('./lessonCodingAssessment');

// Course-centric architecture (new — see Section 1 of the course-restructure spec)
const Course = require('./course');
const LessonMaterial = require('./lessonMaterial');
const CourseTrainerAssignment = require('./courseTrainerAssignment');

// Coding Assessment module
const CodingAssessment = require('./codingAssessment');
const CodingQuestion = require('./codingQuestion');
const TestCase = require('./testCase');
const CodingAttempt = require('./codingAttempt');
const CodingSubmission = require('./codingSubmission');
const SubmissionResult = require('./submissionResult');
const CodingViolation = require('./codingViolation');
const PlagiarismReport = require('./plagiarismReport');

// Proctoring module
const ExamSession = require('./examSession');
const Violation = require('./violation');
const DeviceFingerprint = require('./deviceFingerprint');
const ProctorActivity = require('./proctorActivity');
const Screenshot = require('./screenshot');

// Parallel monitor system (prompt-spec, does not touch proctoring tables)
const MonitorAttempt = require('./monitorAttempt');
const MonitorViolation = require('./monitorViolation');
const MonitorScreenshot = require('./monitorScreenshot');

// New Enhancements
const TrainingTrainerAssignment = require('./trainingTrainerAssignment');
const QuizAssignment = require('./quizAssignment');
const QuizCopyViolation = require('./quizCopyViolation');
const DiscussionPost = require('./discussionPost');
const Certificate = require('./certificate');
const ParticipantTracking = require('./participantTracking');
const QuizResultsAudit = require('./quizResultsAudit');

// Quiz Recordings module
const QuizRecording = require('./quizRecording');

// --- Core LMS Associations ---

// User <-> TrainerProfile
User.hasOne(TrainerProfile, { foreignKey: 'userId', as: 'profile' });
TrainerProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Training (now: TrainingProgram) <-> Trainer (User) — legacy
// Kept so the older trainingController/trainingRoutes continue to function.
// New course-centric flows use Course.trainer_id instead.
Training.belongsTo(User, { foreignKey: 'trainerId', as: 'trainer' });
User.hasMany(Training, { foreignKey: 'trainerId', as: 'trainings' });

// TrainingProgram (Training) ←→ Course
Training.hasMany(Course, { foreignKey: 'trainingProgramId', as: 'courses' });
Course.belongsTo(Training, { foreignKey: 'trainingProgramId', as: 'program' });

// Course ←→ Trainer (primary trainer)
Course.belongsTo(User, { foreignKey: 'trainerId', as: 'trainer' });
User.hasMany(Course, { foreignKey: 'trainerId', as: 'courses' });

// Course ←→ CourseTrainerAssignment (M:N future multi-trainer)
Course.hasMany(CourseTrainerAssignment, { foreignKey: 'courseId', as: 'trainerAssignments' });
CourseTrainerAssignment.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
CourseTrainerAssignment.belongsTo(User, { foreignKey: 'trainerId', as: 'trainer' });
User.hasMany(CourseTrainerAssignment, { foreignKey: 'trainerId', as: 'courseAssignments' });

// Training ←→ TrainingTrainerAssignment
Training.hasMany(TrainingTrainerAssignment, { foreignKey: 'trainingId', as: 'trainerAssignments' });
TrainingTrainerAssignment.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
TrainingTrainerAssignment.belongsTo(User, { foreignKey: 'trainerId', as: 'trainer' });
User.hasMany(TrainingTrainerAssignment, { foreignKey: 'trainerId', as: 'trainingAssignments' });

// DiscussionPost associations
DiscussionPost.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
Training.hasMany(DiscussionPost, { foreignKey: 'trainingId', as: 'discussionPosts' });
DiscussionPost.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(DiscussionPost, { foreignKey: 'userId', as: 'discussionPosts' });
DiscussionPost.belongsTo(DiscussionPost, { foreignKey: 'parentId', as: 'parent' });
DiscussionPost.hasMany(DiscussionPost, { foreignKey: 'parentId', as: 'replies' });

// Certificate associations
Certificate.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Certificate, { foreignKey: 'userId', as: 'certificates' });
Certificate.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
Training.hasMany(Certificate, { foreignKey: 'trainingId', as: 'certificates' });
Certificate.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Course.hasMany(Certificate, { foreignKey: 'courseId', as: 'certificates' });

// ParticipantTracking associations
ParticipantTracking.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(ParticipantTracking, { foreignKey: 'userId', as: 'trackingRecords' });
ParticipantTracking.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });
Lesson.hasMany(ParticipantTracking, { foreignKey: 'lessonId', as: 'trackingRecords' });
ParticipantTracking.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
Training.hasMany(ParticipantTracking, { foreignKey: 'trainingId', as: 'trackingRecords' });

// Enrollment associations — both legacy (Training) and new (Course)
Enrollment.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });
Enrollment.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
Enrollment.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
User.hasMany(Enrollment, { foreignKey: 'participantId', as: 'enrollments' });
Training.hasMany(Enrollment, { foreignKey: 'trainingId', as: 'enrollments' });
Course.hasMany(Enrollment, { foreignKey: 'courseId', as: 'enrollments' });

// Feedback associations (legacy training-scoped)
Feedback.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
Feedback.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });
Training.hasMany(Feedback, { foreignKey: 'trainingId', as: 'feedbacks' });
User.hasMany(Feedback, { foreignKey: 'participantId', as: 'feedbacks' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

// Note associations (standalone trainer notes/resources — separate from lesson_materials)
Note.belongsTo(User, { foreignKey: 'trainerId', as: 'trainer' });
Note.belongsTo(Training, { foreignKey: 'trainingId', as: 'training', required: false });

// ParticipantProfile (1-1 with User)
User.hasOne(ParticipantProfile, { foreignKey: 'userId', as: 'participantProfile' });
ParticipantProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// --- AI Quiz System ---
AIDocument.belongsTo(User, { foreignKey: 'trainerId', as: 'trainer' });
AIDocument.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });

AIQuiz.belongsTo(AIDocument, { foreignKey: 'documentId', as: 'document' });
AIQuiz.belongsTo(User, { foreignKey: 'trainerId', as: 'trainer' });
AIQuiz.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' }); // legacy
AIQuiz.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
AIQuiz.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });
AIQuiz.hasMany(AIQuestion, { foreignKey: 'quizId', as: 'questions' });
AIQuiz.hasMany(QuizAssignment, { foreignKey: 'quizId', as: 'quizAssignments' });

Course.hasMany(AIQuiz, { foreignKey: 'courseId', as: 'quizzes' });
Lesson.hasMany(AIQuiz, { foreignKey: 'lessonId', as: 'directQuizzes' });

// QuizAssignment associations (per-participant assignment with PENDING/COMPLETED status)
QuizAssignment.belongsTo(AIQuiz, { foreignKey: 'quizId', as: 'quiz' });
QuizAssignment.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });
User.hasMany(QuizAssignment, { foreignKey: 'participantId', as: 'quizAssignments' });

AIQuestion.belongsTo(AIQuiz, { foreignKey: 'quizId', as: 'quiz' });
AIQuestion.hasMany(AIQuestionOption, { foreignKey: 'questionId', as: 'optionRows' });
AIQuestionOption.belongsTo(AIQuestion, { foreignKey: 'questionId', as: 'question' });

QuizAttempt.belongsTo(AIQuiz, { foreignKey: 'quizId', as: 'quiz' });
QuizAttempt.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });
QuizAttempt.hasMany(QuizAnswer, { foreignKey: 'attemptId', as: 'answers' });
QuizAttempt.hasOne(QuizResult, { foreignKey: 'attemptId', as: 'result' });

QuizAnswer.belongsTo(QuizAttempt, { foreignKey: 'attemptId', as: 'attempt' });
QuizAnswer.belongsTo(AIQuestion, { foreignKey: 'questionId', as: 'question' });

QuizResult.belongsTo(QuizAttempt, { foreignKey: 'attemptId', as: 'attempt' });
QuizResult.belongsTo(AIQuiz, { foreignKey: 'quizId', as: 'quiz' });
QuizResult.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });

QuizAttempt.hasMany(QuizCopyViolation, { foreignKey: 'attemptId', as: 'copyViolations' });
QuizCopyViolation.belongsTo(QuizAttempt, { foreignKey: 'attemptId', as: 'attempt' });
QuizCopyViolation.belongsTo(AIQuiz, { foreignKey: 'quizId', as: 'quiz' });
QuizCopyViolation.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });

// --- Proctoring Associations ---
ExamSession.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });
ExamSession.belongsTo(AIQuiz, { foreignKey: 'quizId', as: 'quiz' });
ExamSession.belongsTo(QuizAttempt, { foreignKey: 'attemptId', as: 'attempt' });
ExamSession.belongsTo(DeviceFingerprint, { foreignKey: 'deviceFingerprintId', as: 'device' });
ExamSession.hasMany(Violation, { foreignKey: 'sessionId', as: 'violations' });
ExamSession.hasMany(ProctorActivity, { foreignKey: 'sessionId', as: 'activities' });
ExamSession.hasMany(Screenshot, { foreignKey: 'sessionId', as: 'screenshots' });

Violation.belongsTo(ExamSession, { foreignKey: 'sessionId', as: 'session' });
Violation.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });

Screenshot.belongsTo(ExamSession, { foreignKey: 'sessionId', as: 'session' });
Screenshot.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });

ProctorActivity.belongsTo(ExamSession, { foreignKey: 'sessionId', as: 'session' });

// --- Parallel Monitor System Associations ---
MonitorAttempt.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });
MonitorAttempt.belongsTo(AIQuiz, { foreignKey: 'testId', as: 'test' });
MonitorAttempt.hasMany(MonitorViolation, { foreignKey: 'attemptId', as: 'violations' });
MonitorAttempt.hasMany(MonitorScreenshot, { foreignKey: 'attemptId', as: 'screenshots' });

MonitorViolation.belongsTo(MonitorAttempt, { foreignKey: 'attemptId', as: 'attempt' });
MonitorViolation.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });

MonitorScreenshot.belongsTo(MonitorAttempt, { foreignKey: 'attemptId', as: 'attempt' });
MonitorScreenshot.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });

User.hasMany(MonitorAttempt, { foreignKey: 'participantId', as: 'monitorAttempts' });
AIQuiz.hasMany(MonitorAttempt, { foreignKey: 'testId', as: 'monitorAttempts' });

DeviceFingerprint.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(DeviceFingerprint, { foreignKey: 'userId', as: 'devices' });
User.hasMany(ExamSession, { foreignKey: 'participantId', as: 'examSessions' });

// --- Secure Assessment Session lock (separate from proctoring module) ---
AssessmentSession.belongsTo(QuizAttempt, { foreignKey: 'attemptId', as: 'attempt' });
AssessmentSession.belongsTo(AIQuiz, { foreignKey: 'quizId', as: 'quiz' });
AssessmentSession.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });
AssessmentSession.belongsTo(User, { foreignKey: 'resetByAdmin', as: 'resetAdmin' });
QuizAttempt.hasOne(AssessmentSession, { foreignKey: 'attemptId', as: 'assessmentSession' });
User.hasMany(AssessmentSession, { foreignKey: 'participantId', as: 'assessmentSessions' });

// --- Lesson Workflow Associations ---
// Legacy training-scoped lesson link (kept for back-compat)
Lesson.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
Training.hasMany(Lesson, { foreignKey: 'trainingId', as: 'lessons' });
Lesson.belongsTo(User, { foreignKey: 'trainerId', as: 'trainer' });

// New course-scoped lesson link
Lesson.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Course.hasMany(Lesson, { foreignKey: 'courseId', as: 'lessons' });

// LessonMaterial — 1:M from Lesson
Lesson.hasMany(LessonMaterial, { foreignKey: 'lessonId', as: 'materials' });
LessonMaterial.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });

Lesson.hasMany(LessonQuiz, { foreignKey: 'lessonId', as: 'quizzes' });
LessonQuiz.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });
LessonQuiz.belongsTo(AIQuiz, { foreignKey: 'quizId', as: 'quiz' });

Lesson.hasMany(LessonAssessment, { foreignKey: 'lessonId', as: 'assessments' });
LessonAssessment.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });

LessonAssessment.hasMany(AssessmentSubmission, { foreignKey: 'assessmentId', as: 'submissions' });
AssessmentSubmission.belongsTo(LessonAssessment, { foreignKey: 'assessmentId', as: 'assessment' });
AssessmentSubmission.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });

LessonQuiz.hasMany(QuizProgress, { foreignKey: 'lessonQuizId', as: 'progress' });
QuizProgress.belongsTo(LessonQuiz, { foreignKey: 'lessonQuizId', as: 'lessonQuiz' });
QuizProgress.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });

Lesson.hasMany(LessonProgress, { foreignKey: 'lessonId', as: 'progress' });
LessonProgress.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });
LessonProgress.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });

// --- Lesson Coding Assessment Associations (junction) ---
Lesson.hasMany(LessonCodingAssessment, { foreignKey: 'lessonId', as: 'codingAssessments' });
LessonCodingAssessment.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });
LessonCodingAssessment.belongsTo(CodingAssessment, { foreignKey: 'assessmentId', as: 'assessment' });

// --- Coding Assessment Associations ---
CodingAssessment.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
Training.hasMany(CodingAssessment, { foreignKey: 'trainingId', as: 'codingAssessments' });
CodingAssessment.belongsTo(User, { foreignKey: 'trainerId', as: 'trainer' });
CodingAssessment.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
CodingAssessment.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });
CodingAssessment.hasMany(CodingQuestion, { foreignKey: 'assessmentId', as: 'questions' });
CodingAssessment.hasMany(CodingAttempt, { foreignKey: 'assessmentId', as: 'attempts' });
CodingAssessment.hasMany(PlagiarismReport, { foreignKey: 'assessmentId', as: 'plagiarismReports' });

CodingQuestion.belongsTo(CodingAssessment, { foreignKey: 'assessmentId', as: 'assessment' });
CodingQuestion.hasMany(TestCase, { foreignKey: 'questionId', as: 'testCases' });
CodingQuestion.hasMany(CodingSubmission, { foreignKey: 'questionId', as: 'submissions' });
TestCase.belongsTo(CodingQuestion, { foreignKey: 'questionId', as: 'question' });

CodingAttempt.belongsTo(CodingAssessment, { foreignKey: 'assessmentId', as: 'assessment' });
CodingAttempt.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });
CodingAttempt.hasMany(CodingSubmission, { foreignKey: 'attemptId', as: 'submissions' });
CodingAttempt.hasMany(CodingViolation, { foreignKey: 'attemptId', as: 'violations' });

CodingSubmission.belongsTo(CodingAttempt, { foreignKey: 'attemptId', as: 'attempt' });
CodingSubmission.belongsTo(CodingQuestion, { foreignKey: 'questionId', as: 'question' });
CodingSubmission.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });
CodingSubmission.hasMany(SubmissionResult, { foreignKey: 'submissionId', as: 'results' });
SubmissionResult.belongsTo(CodingSubmission, { foreignKey: 'submissionId', as: 'submission' });

CodingViolation.belongsTo(CodingAttempt, { foreignKey: 'attemptId', as: 'attempt' });
ExamSession.belongsTo(CodingAttempt, { foreignKey: 'attemptId', as: 'codingAttempt' });

PlagiarismReport.belongsTo(CodingAssessment, { foreignKey: 'assessmentId', as: 'assessment' });
PlagiarismReport.belongsTo(CodingQuestion, { foreignKey: 'questionId', as: 'question' });
PlagiarismReport.belongsTo(User, { foreignKey: 'participantAId', as: 'participantA' });
PlagiarismReport.belongsTo(User, { foreignKey: 'participantBId', as: 'participantB' });

// --- Quiz Results Audit associations ---
QuizResultsAudit.belongsTo(AIQuiz, { foreignKey: 'quizId', as: 'quiz' });
QuizResultsAudit.belongsTo(User, { foreignKey: 'performedBy', as: 'performer' });
AIQuiz.hasMany(QuizResultsAudit, { foreignKey: 'quizId', as: 'auditLogs' });

// --- Quiz Recording Associations ---
QuizRecording.belongsTo(CodingAttempt, { foreignKey: 'codingAttemptId', as: 'codingAttempt' });
QuizRecording.belongsTo(AIQuiz, { foreignKey: 'quizId', as: 'quiz' });
QuizRecording.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });
QuizRecording.belongsTo(User, { foreignKey: 'trainerId', as: 'trainer' });
AIQuiz.hasMany(QuizRecording, { foreignKey: 'quizId', as: 'recordings' });
User.hasMany(QuizRecording, { foreignKey: 'participantId', as: 'participantRecordings' });
User.hasMany(QuizRecording, { foreignKey: 'trainerId', as: 'trainerRecordings' });

module.exports = {
  sequelize,
  User,
  Training,
  TrainerProfile,
  Enrollment,
  Feedback,
  Notification,
  SurveyQuestion,
  SurveyAnswer,
  Note,
  ActivityLog,
  LiveSession,
  Attendance,
  ChatMessage,
  ParticipantProfile,
  AIDocument,
  AIQuiz,
  AIQuestion,
  AIQuestionOption,
  QuizAttempt,
  QuizAnswer,
  QuizResult,
  // Proctoring
  ExamSession,
  Violation,
  DeviceFingerprint,
  ProctorActivity,
  Screenshot,
  // Parallel monitor system
  MonitorAttempt,
  MonitorViolation,
  MonitorScreenshot,
  PasswordResetOtp,
  // Secure Assessment session lock
  AssessmentSession,
  // Lesson workflow module
  Lesson,
  LessonQuiz,
  LessonAssessment,
  AssessmentSubmission,
  QuizProgress,
  LessonProgress,
  LessonCodingAssessment,
  // Course-centric module
  Course,
  LessonMaterial,
  CourseTrainerAssignment,
  // Coding Assessment module
  CodingAssessment,
  CodingQuestion,
  TestCase,
  CodingAttempt,
  CodingSubmission,
  SubmissionResult,
  CodingViolation,
  PlagiarismReport,
  TrainingTrainerAssignment,
  QuizAssignment,
  DiscussionPost,
  Certificate,
  ParticipantTracking,
  QuizResultsAudit,
  QuizCopyViolation,
  QuizRecording,
};
