require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const compression = require('compression');
const responseTime = require('response-time');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const { User } = require('./models');
const { sequelize, connectDB } = require('./config/db');
const logger = require('./utils/logger');
const {
  initializeSocket,
  setupRedisAdapter,
  cleanupSocket,
} = require('./config/socket');
const {
  performanceMonitor,
  requestTimeout,
  cacheControl,
  compressionConfig,
} = require('./middleware/performance');
const cacheService = require('./services/cacheService');

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

// ─── Global Middleware (order matters — performant middleware first) ─

// 1. Security headers (Helmet) — improves Lighthouse score
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: false, // Disabled for SPA with inline styles
}));

// 2. Compression — gzip/brotli for all responses > 1KB
app.use(compression(compressionConfig()));

// 3. Response time header (X-Response-Time)
app.use(responseTime({ suffix: false }));

// 3. Performance monitoring & timeout
app.use(performanceMonitor);
app.use(requestTimeout);

// 4. CORS
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
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// 5. Body parsers with reduced limit for non-upload routes
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 6. Cache control headers for static assets
app.use('/uploads', cacheControl(86400), express.static(path.join(__dirname, '../uploads')));

// 7. Request logging (using logger, not console.log)
app.use((req, res, next) => {
  logger.debug('API HIT', { method: req.method, url: req.originalUrl });
  next();
});

// ─── Route Mounting ────────────────────────────────────────────────
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

// Cache-aware health check for AI service
app.get('/api/ai/health', cacheControl(30), async (req, res) => {
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

// Custom route for updating profile
const profileController = require('./controllers/profileController');
const upload = require('./middleware/upload');
const authenticateToken = require('./middleware/auth');
app.put('/api/update-profile', authenticateToken, upload.single('profilePic'), profileController.updateProfile);

// Top-level test-mail alias
const { testMail } = require('./controllers/forgotPasswordController');
app.get('/api/test-mail', testMail);

// Health check with cache control
app.get('/health', cacheControl(10), (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    cache: cacheService.getStats(),
    uptime: process.uptime(),
  });
});

// Performance stats endpoint (admin only)
app.get('/api/admin/performance', authenticateToken, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { getSlowestEndpoints } = require('./middleware/performance');
  res.json({
    cache: cacheService.getStats(),
    slowEndpoints: getSlowestEndpoints(20),
  });
});

// ─── Global error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

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

// 404 handler
app.use((req, res) => {
  logger.warn('Endpoint not found', { method: req.method, url: req.originalUrl });
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// ─── Server Startup ────────────────────────────────────────────────
const startServer = async () => {
  try {
    await connectDB();
    require('./models');

    // Initialize cache service
    await cacheService.initialize();
    app.set('cache', cacheService);
    logger.info('Cache service initialized', { mode: cacheService.getStats().mode });

    // Background jobs (started with .unref() so they don't block shutdown)
    try {
      const { startAssessmentSessionExpiryJob } = require('./jobs/expireAssessmentSessions');
      startAssessmentSessionExpiryJob({ intervalMs: 5 * 60_000, logger });
    } catch (e) {
      logger.warn('Could not start assessment session expiry job', { error: e.message });
    }

    try {
      const proctoring = require('./services/proctoringService');
      setInterval(() => {
        proctoring.expireStaleSessions().catch(err =>
          logger.warn('proctor reaper error', { err: err.message }),
        );
      }, 60_000).unref();
    } catch (e) { /* non-fatal */ }

    try {
      const { cleanupExpiredOtps } = require('./controllers/forgotPasswordController');
      cleanupExpiredOtps();
      setInterval(() => cleanupExpiredOtps(), 5 * 60_000).unref();
    } catch (e) { /* non-fatal */ }

    // Initialize Socket.IO
    const io = initializeSocket(server);
    app.set('io', io);
    logger.info('Socket.IO initialized');

    logger.info('Running Socket.IO in single-instance mode (enable Redis for multi-instance)');

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

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use.`);
        process.exit(1);
      }
      throw err;
    });

    server.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received: closing server`);
      server.close(async () => {
        await cacheService.shutdown();
        await cleanupSocket(io);
        await sequelize.close();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

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
