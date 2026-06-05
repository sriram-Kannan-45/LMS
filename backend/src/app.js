require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const bcrypt = require('bcryptjs');
const { User } = require('./models');
const { sequelize, connectDB } = require('./config/db');
const logger = require('./utils/logger');
const {
  initializeSocket,
  setupRedisAdapter,
  cleanupSocket,
} = require('./config/socket');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const trainingRoutes = require('./routes/trainingRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const trainerRoutes = require('./routes/trainerRoutes');
const trainerCourseRoutes = require('./routes/trainerCourseRoutes');
const participantCourseRoutes = require('./routes/participantCourseRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const noteRoutes = require('./routes/noteRoutes');
const feedRoutes = require('./routes/feedRoutes');
const liveRoutes = require('./routes/liveRoutes');
const aiQuizRoutes = require('./routes/aiQuizRoutes');
const profileRoutes = require('./routes/profileRoutes');
const participantProfileRoutes = require('./routes/participantProfileRoutes');
const proctoringRoutes = require('./routes/proctoringRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const codingAssessmentRoutes = require('./routes/codingAssessmentRoutes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// CORS — allow common Vite dev ports plus any origin in FRONTEND_URL.
// Vite picks 5174/5175/... when 5173 is busy, so we whitelist a small range
// to avoid "Cannot connect to server" failures during local dev.
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
]);

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin / curl / server-to-server (no Origin header)
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
// Body parsers — limit raised to 10 MB to safely accommodate participant
// avatar payloads (sent as base-64 data URLs). The frontend now compresses
// avatars to ~400×400 JPEG before upload, so real payloads are typically
// <100 KB; this header is the safety net.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Global request logger
app.use((req, res, next) => {
  console.log('➡️ API HIT:', req.method, req.originalUrl);
  next();
});

// ROUTE MOUNTING (order matters — more specific first)
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/trainer', trainerCourseRoutes);
app.use('/api/trainer', trainerRoutes);
app.use('/api/participant', participantCourseRoutes);
app.use('/api/participant', enrollmentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/trainings', trainingRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/ai-quiz', aiQuizRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/participant-profile', participantProfileRoutes);
app.use('/api/proctor', proctoringRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/coding', codingAssessmentRoutes);

// Health check for AI service (separate path to avoid conflict with router)
app.get('/api/ai/health', async (req, res) => {
  try {
    const aiService = require('./services/aiService');
    const result = await aiService.checkHealth();
    if (result.available) {
      res.json({ status: 'ok', aiService: result.details });
    } else {
      res.status(503).json({ 
        status: 'error', 
        message: 'AI service is not responding',
        hint: 'Start the Python service: cd ai-service && python main.py'
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      message: 'AI service unavailable',
      hint: 'Start the Python service: cd ai-service && python main.py'
    });
  }
});

// Custom route for updating profile exactly as requested
const profileController = require('./controllers/profileController');
const upload = require('./middleware/upload');
const authenticateToken = require('./middleware/auth');
app.put('/api/update-profile', authenticateToken, upload.single('profilePic'), profileController.updateProfile);

// Top-level /api/test-mail alias (matches the spec's debugging step #5)
const { testMail } = require('./controllers/forgotPasswordController');
app.get('/api/test-mail', testMail);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error on', req.method, req.originalUrl);
  console.error(err.stack);

  // Multer file-type / size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File too large. Maximum size is 5 MB.' });
  }
  if (err.message && err.message.includes('Only JPG')) {
    return res.status(415).json({ success: false, message: err.message });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

// Global 404 fallback with detailed logging
app.use((req, res) => {
  console.error('❌ ENDPOINT NOT FOUND:', req.method, req.originalUrl);
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

const startServer = async () => {
  try {
    await connectDB();
    // ✅ IMPORTANT: Never use alter: true in production
    // See src/config/db.js for detailed explanation
    // Sync is already handled safely in connectDB()
    // await sequelize.sync({ alter: false });

    // Lightweight, additive: ensure the participant_profiles table exists
    // and that any column type drift is corrected. `alter: true` here is
    // scoped to ONE just-introduced model (not the whole DB), so it only
    // alters columns on participant_profiles. Without this, an avatar_url
    // column previously created as TEXT (64 KB) would stay too small for
    // base-64 photo payloads.
    try {
      const { ParticipantProfile } = require('./models');
      await ParticipantProfile.sync({ alter: true });
      logger.info('participant_profiles table ready');
    } catch (e) {
      logger.error('Could not sync participant_profiles', { error: e.message });
    }

    // Proctoring tables — additive sync, scoped to module
    try {
      const {
        ExamSession,
        Violation,
        DeviceFingerprint,
        ProctorActivity,
      } = require('./models');
      await DeviceFingerprint.sync({ alter: true });
      await ExamSession.sync({ alter: true });
      await Violation.sync({ alter: true });
      await ProctorActivity.sync({ alter: true });
      logger.info('proctoring tables ready');
    } catch (e) {
      logger.error('Could not sync proctoring tables', { error: e.message });
    }

    // OTP table for forgot-password flow
    try {
      const { PasswordResetOtp } = require('./models');
      await PasswordResetOtp.sync({ alter: true });
      logger.info('password_reset_otps table ready');
    } catch (e) {
      logger.error('Could not sync password_reset_otps', { error: e.message });
    }

    // Secure Assessment session-lock table (see models/AssessmentSession.js).
    // Mirrors the per-model sync pattern used elsewhere in this file so a
    // fresh checkout boots with the table without needing sequelize-cli.
    try {
      const { AssessmentSession } = require('./models');
      await AssessmentSession.sync({ alter: true });
      logger.info('assessment_sessions table ready');
    } catch (e) {
      logger.error('Could not sync assessment_sessions', { error: e.message });
    }

    // Course-centric architecture — must run BEFORE lesson/quiz/enrollment
    // sync so the bootstrap (rename trainings → training_programs) and the
    // new courses table exist when Lesson/AIQuiz/Enrollment are altered to
    // add their course_id columns.
    try {
      const { bootstrapCourseSchema, relaxLegacyTrainingIdColumns } = require('./config/bootstrapCourseSchema');
      await bootstrapCourseSchema(logger);
      await relaxLegacyTrainingIdColumns(logger);

      const {
        Training,        // table: training_programs (renamed)
        Course,
        LessonMaterial,
        CourseTrainerAssignment,
      } = require('./models');

      // FK checks off: altering Training adds thumbnail_url and (when
      // training_programs was just created empty by the global sync and
      // then dropped during bootstrap) any FK from courses to it should
      // not block the alters.
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      try {
        // Re-sync Training so the new thumbnail_url column is added on
        // existing rows. Legacy columns remain (kept nullable in the model).
        await Training.sync({ alter: true });
        await Course.sync({ alter: true });
        await LessonMaterial.sync({ alter: true });
        await CourseTrainerAssignment.sync({ alter: true });
      } finally {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      }
      logger.info('course-centric tables ready');
    } catch (e) {
      logger.error('Could not sync course-centric tables', { error: e.message, stack: e.stack });
    }

    // Lesson workflow tables — additive sync, scoped to module
    try {
      const {
        Lesson, LessonQuiz, LessonAssessment,
        AssessmentSubmission, QuizProgress, LessonProgress,
        Enrollment, AIQuiz,
      } = require('./models');
      // FK checks off: altering lessons.training_id from NOT NULL to NULL
      // and enrollments.training_id similarly conflicts with existing
      // SET NULL FK actions (column must be nullable for SET NULL — older
      // table state is inconsistent).
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      try {
        // Lesson, AIQuiz, Enrollment now carry the new course_id columns.
        await Lesson.sync({ alter: true });
        await LessonQuiz.sync({ alter: true });
        await LessonAssessment.sync({ alter: true });
        await AssessmentSubmission.sync({ alter: true });
        await QuizProgress.sync({ alter: true });
        await LessonProgress.sync({ alter: true });
        await Enrollment.sync({ alter: true });
        await AIQuiz.sync({ alter: true });
      } finally {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      }
      logger.info('lesson workflow tables ready');
    } catch (e) {
      logger.error('Could not sync lesson workflow tables', { error: e.message });
    }

    // Coding Assessment tables — additive sync, scoped to module
    try {
      const {
        CodingAssessment, CodingQuestion, TestCase, CodingAttempt,
        CodingSubmission, SubmissionResult, CodingViolation, PlagiarismReport,
      } = require('./models');
      await CodingAssessment.sync({ alter: true });
      await CodingQuestion.sync({ alter: true });
      await TestCase.sync({ alter: true });
      await CodingAttempt.sync({ alter: true });
      await CodingSubmission.sync({ alter: true });
      await SubmissionResult.sync({ alter: true });
      await CodingViolation.sync({ alter: true });
      await PlagiarismReport.sync({ alter: true });
      logger.info('coding assessment tables ready');
    } catch (e) {
      logger.error('Could not sync coding assessment tables', { error: e.message });
    }

    // Add course-centric indexes that were intentionally omitted from the
    // model definitions (to avoid racing the global sync). Idempotent.
    try {
      const { bootstrapCourseIndexes } = require('./config/bootstrapCourseSchema');
      await bootstrapCourseIndexes(logger);
    } catch (e) {
      logger.warn('Could not finalize course-centric indexes', { error: e.message });
    }

    // Assessment session expiry job — runs every 5 min
    try {
      const { startAssessmentSessionExpiryJob } = require('./jobs/expireAssessmentSessions');
      startAssessmentSessionExpiryJob({ intervalMs: 5 * 60_000, logger });
    } catch (e) {
      logger.warn('Could not start assessment session expiry job', { error: e.message });
    }

    // Background heartbeat reaper (60s)
    try {
      const proctoring = require('./services/proctoringService');
      setInterval(() => {
        proctoring.expireStaleSessions().catch(err =>
          logger.warn('proctor reaper error', { err: err.message }),
        );
      }, 60_000).unref();
    } catch (e) { /* non-fatal */ }

    // Background OTP cleanup — removes expired & old-used rows every 5 min
    // (replaces MongoDB TTL index since we use Sequelize/MySQL).
    try {
      const { cleanupExpiredOtps } = require('./controllers/forgotPasswordController');
      cleanupExpiredOtps(); // run once at startup
      setInterval(() => cleanupExpiredOtps(), 5 * 60_000).unref();
    } catch (e) { /* non-fatal */ }

    // Initialize Socket.IO
    const io = initializeSocket(server);
    app.set('io', io);
    logger.info('Socket.IO initialized');

    // Setup Redis adapter for multi-instance scaling (disabled for local dev)
    logger.info('Running Socket.IO in single-instance mode (Redis disabled for local dev)');

    // Create default admin if not exists
    const adminExists = await User.findOne({ where: { email: 'admin@test.com' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        name: 'Admin',
        email: 'admin@test.com',
        password: hashedPassword,
        phone: '0000000000',
        role: 'ADMIN'
      });
      logger.info('Default admin created: admin@test.com / admin123');
    } else {
      logger.info('Admin already exists');
    }

    // Friendly EADDRINUSE handler — exits with actionable instructions instead
    // of a raw stack trace when port is busy.
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error('');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('   Another process (most likely a previous backend) is bound to this port.');
        console.error('');
        console.error('   To free it:');
        console.error('     • Quick (recommended):  npm run start:clean');
        console.error('     • PowerShell one-liner: Get-NetTCPConnection -LocalPort ' + PORT + ' -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }');
        console.error(`     • Manual:               netstat -ano | findstr :${PORT}   then   taskkill /PID <pid> /F`);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('');
        process.exit(1);
      }
      // Anything else is a genuine server error — re-throw so it isn't silently swallowed.
      throw err;
    });

    server.listen(PORT, () => {
      logger.info(`🚀 WAVE INIT LMS Server running on http://localhost:${PORT}`);
      logger.info(`📋 Mounted routes:
   /api/auth      → auth routes
   /api/admin     → admin routes (+ analytics endpoints)
   /api/trainer   → trainer routes
   /api/participant → enrollment routes
   /api/feedback  → feedback routes
   /api/trainings → training routes
   /api/feed      → activity feed routes
   /api/notifications → notification routes (+ Socket.IO)
   /api/notes     → notes routes
   /api/ai-quiz   → AI quiz routes
   /api/profile   → trainer profile routes
   /api/participant-profile → participant profile routes
       · GET    /me                  (own profile)
       · PUT    /me                  (update name/bio/skills/links)
       · POST   /me/avatar           (multipart upload)
       · DELETE /me/avatar           (remove avatar)
       · GET    /:userId             (admin/trainer view)
   /api/survey    → survey routes
      `);
      logger.info('🔌 WebSocket server active on Socket.IO');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(async () => {
        logger.info('HTTP server closed');
        await cleanupSocket(io);
        await sequelize.close();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT signal received: closing HTTP server');
      server.close(async () => {
        logger.info('HTTP server closed');
        await cleanupSocket(io);
        await sequelize.close();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server', { 
      error: error.message,
      stack: error.stack,
      code: error.code
    });
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, server };