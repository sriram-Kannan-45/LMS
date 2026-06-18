const express = require('express');
const multer = require('multer');
const path = require('path');
const { AIDocument, AIQuiz, AIQuestion, QuizAttempt, QuizAnswer, QuizResult, Training, User, Course, CourseTrainerAssignment, TrainingTrainerAssignment } = require('../models');
const authenticateToken = require('../middleware/auth');
const roleMiddleware = require('../middleware/roles');
const aiService = require('../services/aiService');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const { generateAIQuiz } = require('../controllers/aiQuizGenerationController');
const { uploadAIQuizMaterial } = require('../middleware/uploadAIQuizMaterial');

const { gradeAnswer } = require('../utils/gradeAnswer');

const router = express.Router();

  // Absolute path for uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads', 'ai-docs');
  
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory:', uploadsDir);
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
      cb(null, unique);
    }
  });

  // STRICT image detection - check magic bytes
  const isImageFile = (buffer) => {
    if (!buffer || buffer.length < 4) return false;
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
    // GIF: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
    // BMP: 42 4D
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) return true;
    // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
    if (buffer.length >= 12 && buffer.slice(0,4).toString() === 'RIFF' && buffer.slice(8,12).toString() === 'WEBP') return true;
    return false;
  };

  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      // Check MIME type first
      const allowedMimes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      const isImageMime = file.mimetype?.startsWith('image/');
      
      if (isImageMime) {
        return cb(new Error('Images are not supported. Please upload PDF, DOCX, or TXT files only.'));
      }
      
      if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(pdf|docx|txt)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 }
  });

  const extractText = async (filePath, mimeType) => {
    // Ensure the file path is absolute
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(absPath)) {
      throw new Error(`File not found: ${absPath}`);
    }

    if (mimeType === 'text/plain' || absPath.endsWith('.txt')) {
      return fs.readFileSync(absPath, 'utf8');
    }
    if (mimeType === 'application/pdf' || absPath.endsWith('.pdf')) {
      const dataBuffer = fs.readFileSync(absPath);
      try {
        const data = await pdf(dataBuffer);
        return data.text || '';
      } catch (pdfErr) {
        console.error('PDF parse error:', pdfErr.message);
        throw new Error('Failed to parse PDF: ' + pdfErr.message);
      }
    }
    if (mimeType.includes('wordprocessingml') || absPath.endsWith('.docx')) {
      try {
        const result = await mammoth.extractRawText({ path: absPath });
        return result.value || '';
      } catch (docxErr) {
        console.error('DOCX parse error:', docxErr.message);
        throw new Error('Failed to parse DOCX: ' + docxErr.message);
      }
    }
    throw new Error('Unsupported file type: ' + mimeType);
  };

  // RAG replacement for the document quiz generator. This route is registered
  // before the legacy inline handler below, so existing clients keep using the
  // same URL while the implementation moves to retrieval-first generation.
  router.post('/trainer/upload-document',
    authenticateToken,
    roleMiddleware('TRAINER'),
    uploadAIQuizMaterial.single('file'),
    generateAIQuiz
  );

  // POST /api/ai-quiz/trainer/upload-document
  router.post('/trainer/upload-document',
    authenticateToken,
    roleMiddleware('TRAINER'),
    upload.single('file'),
    async (req, res) => {
      try {
        const { trainingId, courseId, numQuestions = 10, difficulty = 'MIXED' } = req.body;
        const trainerId = req.user.id;

        // Print received params for debugging as requested
        console.log(`[aiQuizRoutes] Request received: trainingId="${trainingId}" (type: ${typeof trainingId}), courseId="${courseId}" (type: ${typeof courseId}), trainerId="${trainerId}"`);

        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = path.resolve(req.file.path);  // Get absolute path
        const fileType = req.file.mimetype;
        const originalName = req.file.originalname;

        // STRICT validation: Read first bytes to detect image signatures
        try {
          const fileBuffer = fs.readFileSync(filePath);
          
          // Check for image file signatures (magic bytes)
          if (isImageFile(fileBuffer)) {
            // Clean up the uploaded file
            try { fs.unlinkSync(filePath); } catch(e) {}
            return res.status(415).json({ 
              error: 'Images are not supported. Please upload PDF, DOCX, or TXT files only.',
              details: 'The AI model (google/flan-t5-base) does not support image input.'
            });
          }
        } catch (readErr) {
          console.warn('Could not read file for image detection:', readErr.message);
        }

      let content = '';
      try {
        // Ensure we pass absolute path to extractText
        const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
        content = await extractText(absPath, fileType);
      } catch (err) {
        // Clean up file on error
        try { fs.unlinkSync(filePath); } catch(e) {}
        return res.status(400).json({ error: 'Failed to extract text from file: ' + err.message });
      }

      if (!content || content.trim().length < 50) {
        return res.status(400).json({ error: 'Document content too short or empty' });
      }

      // ── Resolve courseId and trainingId ──
      let resolvedCourseId = courseId || null;
      let resolvedTrainingId = trainingId || null;

      // Clean up stringified values
      if (resolvedCourseId === 'undefined' || resolvedCourseId === 'null' || resolvedCourseId === 'NaN' || resolvedCourseId === '') {
        resolvedCourseId = null;
      }
      if (resolvedTrainingId === 'undefined' || resolvedTrainingId === 'null' || resolvedTrainingId === 'NaN' || resolvedTrainingId === '') {
        resolvedTrainingId = null;
      }

      // Fallback: If trainingId was passed but no courseId was provided, check if it's actually a courseId or a trainingId.
      if (resolvedTrainingId && !resolvedCourseId) {
        const courseCheck = await Course.findByPk(resolvedTrainingId);
        if (courseCheck) {
          resolvedCourseId = resolvedTrainingId;
          resolvedTrainingId = courseCheck.trainingProgramId;
          console.log(`[aiQuizRoutes] Detected courseId "${resolvedCourseId}" passed in trainingId parameter. Resolved trainingProgramId: "${resolvedTrainingId}"`);
        } else {
          // If it is indeed a trainingId, resolve its associated Course under the new architecture
          const course = await Course.findOne({ where: { trainingProgramId: resolvedTrainingId } });
          if (course) {
            resolvedCourseId = course.id;
            console.log(`[aiQuizRoutes] Resolved courseId "${resolvedCourseId}" from trainingId "${resolvedTrainingId}"`);
          }
        }
      }

      // Perform validation and authorization
      if (resolvedCourseId) {
        const course = await Course.findByPk(resolvedCourseId);
        if (!course) {
          try { fs.unlinkSync(filePath); } catch (e) {}
          return res.status(400).json({
            success: false,
            error: 'Course not found',
            details: `The selected course (ID: ${resolvedCourseId}) does not exist.`
          });
        }

        // Verify trainer assignment
        const courseAssigned = await CourseTrainerAssignment.findOne({
          where: { courseId: resolvedCourseId, trainerId }
        });
        const hasCourseAccess = course.trainerId === trainerId || courseAssigned !== null;
        if (!hasCourseAccess) {
          try { fs.unlinkSync(filePath); } catch (e) {}
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            details: `You are not authorized to generate quizzes for course (ID: ${resolvedCourseId}).`
          });
        }

        resolvedTrainingId = course.trainingProgramId;
      } else if (resolvedTrainingId) {
        const training = await Training.findByPk(resolvedTrainingId);
        if (!training) {
          try { fs.unlinkSync(filePath); } catch (e) {}
          return res.status(400).json({
            success: false,
            error: 'Training not found',
            details: `The selected training program (ID: ${resolvedTrainingId}) does not exist.`
          });
        }

        // Verify trainer assignment
        const trainingAssigned = await TrainingTrainerAssignment.findOne({
          where: { trainingId: resolvedTrainingId, trainerId }
        });
        const hasTrainingAccess = training.trainerId === trainerId || training.createdBy === trainerId || trainingAssigned !== null;
        if (!hasTrainingAccess) {
          try { fs.unlinkSync(filePath); } catch (e) {}
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            details: `You are not authorized to generate quizzes for training program (ID: ${resolvedTrainingId}).`
          });
        }
      }

      const document = await AIDocument.create({
        trainerId,
        trainingId: resolvedTrainingId,
        title: req.file.originalname,
        content: content.substring(0, 50000),
        fileUrl: `/uploads/ai-docs/${req.file.filename}`,
        fileType: fileType,
        status: 'PROCESSING'
      });

      const quiz = await AIQuiz.create({
        documentId: document.id,
        trainerId,
        trainingId: resolvedTrainingId,
        courseId: resolvedCourseId,
        title: `Quiz: ${req.file.originalname}`,
        numQuestions: parseInt(numQuestions),
        difficulty,
        status: 'DRAFT'
      });

      try {
        // Strip image references that might confuse the AI. Keep newlines and
        // sentence punctuation intact — the Python service does the heavier
        // text normalization, and over-cleaning here was destroying context.
        let cleanContent = content.substring(0, 15000);
        // Remove image filename patterns (image.png, fig1.jpg, etc.)
        cleanContent = cleanContent.replace(/\b(image|img|fig|figure)\d*\.(png|jpg|jpeg|gif|bmp|webp|svg)\b/gi, ' ');
        cleanContent = cleanContent.replace(/\b(image|img|fig|figure)\s*\d+\.(png|jpg|jpeg|gif|bmp|webp|svg)\b/gi, ' ');
        // Remove markdown image tags
        cleanContent = cleanContent.replace(/!\[.*?\]\(.*?\)/g, ' ');
        cleanContent = cleanContent.replace(/\[image:?\s*[^\]]*\]/gi, ' ');
        // Remove "Figure X:" or "Fig. X:" labels
        cleanContent = cleanContent.replace(/\b(figure|fig)\.?\s*\d+[:\-–—]\s*/gi, ' ');
        // Remove file path references to images
        cleanContent = cleanContent.replace(/[C-Z]:\\[^\s]*\.(png|jpg|jpeg|gif|bmp|webp|svg)/gi, ' ');
        cleanContent = cleanContent.replace(/(\/|\\)[^\s]+\.(png|jpg|jpeg|gif|bmp|webp|svg)/gi, ' ');

        console.log('[aiQuizRoutes] Sending', cleanContent.length, 'chars to AI service');
        const result = await aiService.generateQuizFromText(cleanContent, parseInt(numQuestions), difficulty);

        const questions = result.questions || [];
        const quizTitle = result.title || `Quiz: ${req.file.originalname}`;

        // CRITICAL: refuse to save a quiz with zero questions. Previously we
        // happily saved an empty AIQuiz record, leaving the trainer with a
        // useless DRAFT and the participant with "no questions yet" errors.
        if (questions.length === 0) {
          await document.update({ status: 'ERROR' });
          await quiz.destroy();
          return res.status(502).json({
            error: 'AI service returned no questions',
            details: 'The document was processed but the LLM did not produce any usable questions. Please verify the document has enough structured content and that the AI service is reachable.'
          });
        }

        // Update quiz title to whatever the LLM chose
        await quiz.update({ title: quizTitle });

        console.log(`[aiQuizRoutes] Saving ${questions.length} questions for quiz #${quiz.id}...`);
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const saved = await AIQuestion.create({
            quizId: quiz.id,
            questionText: q.questionText,
            questionType: q.questionType || 'MCQ',
            options: q.options || null,
            correctAnswer: String(q.correctAnswer),
            explanation: q.explanation || '',
            difficulty: q.difficulty || difficulty || 'MEDIUM',
            order: i
          });
          console.log(`  ✅ Saved Q${i + 1} (id=${saved.id}) quiz_id=${saved.quizId}: "${q.questionText?.substring(0, 60)}..."`);
        }
        console.log(`[aiQuizRoutes] ✅ All ${questions.length} questions saved for quiz #${quiz.id}`);
        await document.update({ status: 'READY' });
        await quiz.reload({ include: [{ model: AIQuestion, as: 'questions' }] });
        console.log(`[aiQuizRoutes] Quiz reloaded — questions count: ${quiz.questions?.length ?? 0}`);

        res.status(201).json({
          message: `Quiz "${quizTitle}" generated successfully with ${questions.length} questions`,
          quiz
        });
      } catch (err) {
        // Roll the failed quiz back so we don't leak empty DRAFT rows.
        try {
          await document.update({ status: 'ERROR' });
          await quiz.destroy();
          console.warn(`[aiQuizRoutes] Rolled back quiz #${quiz.id} after failure: ${err.message}`);
        } catch (rollbackErr) {
          console.error('[aiQuizRoutes] Rollback failed:', rollbackErr.message);
        }
        return res.status(500).json({ error: 'AI generation failed: ' + err.message });
      }
    } catch (error) {
      console.error('Upload document error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/ai-quiz/trainer/quizzes
router.get('/trainer/quizzes',
  authenticateToken,
  roleMiddleware('TRAINER'),
  async (req, res) => {
    try {
      const quizzes = await AIQuiz.findAll({
        where: { trainerId: req.user.id },
        include: [
          { model: AIQuestion, as: 'questions' },
          { model: AIDocument, as: 'document' },
          { model: Training, as: 'training', attributes: ['id', 'title'] }
        ],
        order: [['created_at', 'DESC']]
      });
      res.json({ quizzes });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// PUT /api/ai-quiz/trainer/quiz/:id
router.put('/trainer/quiz/:id',
  authenticateToken,
  roleMiddleware('TRAINER'),
  async (req, res) => {
    try {
      const quiz = await AIQuiz.findOne({
        where: { id: req.params.id, trainerId: req.user.id }
      });
      if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

      const { title, timeLimit, status } = req.body;
      const update = {};
      if (title) update.title = title;
      if (timeLimit) update.timeLimit = parseInt(timeLimit);
      if (status && ['DRAFT', 'PUBLISHED', 'CLOSED'].includes(status)) update.status = status;

      await quiz.update(update);
      res.json({ message: 'Quiz updated', quiz });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/ai-quiz/participant/start/:quizId
router.post('/participant/start/:quizId',
  authenticateToken,
  roleMiddleware('PARTICIPANT'),
  async (req, res) => {
    try {
      const quiz = await AIQuiz.findOne({
        where: { id: req.params.quizId, status: 'PUBLISHED' },
        include: [{ model: AIQuestion, as: 'questions' }]
      });

      if (!quiz) return res.status(404).json({ error: 'Quiz not found or not available' });

      console.log(`[participant/start] Quiz #${quiz.id} "${quiz.title}" has ${quiz.questions?.length ?? 0} questions`);

      if (!quiz.questions || quiz.questions.length === 0) {
        return res.status(422).json({ error: 'This quiz has no questions yet. Please contact your trainer.' });
      }

      // ── Secure assessment session lock ────────────────────────────────
      // The frontend (new gate flow) supplies deviceFingerprint in the body;
      // legacy / proctoring callers may omit it. We treat a missing
      // fingerprint as "permissive" (skip device-conflict check) so that
      // existing flows aren't broken.
      const crypto = require('crypto');
      const { Op } = require('sequelize');
      const { AssessmentSession } = require('../models');

      const ipAddress = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
      const userAgent = (req.headers['user-agent'] || '').slice(0, 1024);
      const deviceFingerprint = (req.body?.deviceFingerprint || '').toString().slice(0, 512) || null;

      // Compute expiry: timeLimit minutes + 15 min buffer; fallback 3 h.
      const now = new Date();
      const minutes = Number.isFinite(quiz.timeLimit) && quiz.timeLimit > 0 ? quiz.timeLimit : 0;
      const ttlMs = minutes > 0 ? (minutes + 15) * 60_000 : 3 * 60 * 60_000;
      const expiresAt = new Date(now.getTime() + ttlMs);

      // Check existing active session for THIS user + quiz.
      const activeForUser = await AssessmentSession.findOne({
        where: {
          participantId: req.user.id,
          quizId: quiz.id,
          status: 'ACTIVE',
          expiresAt: { [Op.gt]: now },
        },
        order: [['locked_at', 'DESC']],
      });

      // Resume an existing in-progress attempt if one exists.
      const existing = await QuizAttempt.findOne({
        where: { quizId: quiz.id, participantId: req.user.id, status: 'IN_PROGRESS' }
      });

      if (existing) {
        // We're resuming. If a session row exists for this attempt, decide
        // whether the calling device is allowed to use it.
        let session = activeForUser && activeForUser.attemptId === existing.id
          ? activeForUser
          : await AssessmentSession.findOne({ where: { attemptId: existing.id, status: 'ACTIVE' } });

        if (session) {
          const fpMatches =
            !session.deviceFingerprint ||
            !deviceFingerprint ||
            session.deviceFingerprint === deviceFingerprint;
          const ipMatches =
            !session.ipAddress || !ipAddress || session.ipAddress === ipAddress;

          if (fpMatches && ipMatches) {
            console.log(`[participant/start] Resuming attempt #${existing.id} with existing session #${session.id}`);
            return res.json({
              attemptId: existing.id,
              quiz,
              sessionToken: session.sessionToken,
            });
          }

          // Device conflict — only refuse if the caller actually sent a
          // fingerprint (so legacy clients still work).
          if (deviceFingerprint) {
            console.warn(`[participant/start] Device conflict for user #${req.user.id} on quiz #${quiz.id} — refusing with 423`);
            return res.status(423).json({
              error: 'SESSION_LOCKED',
              message:
                'This assessment is already active on another device. Please contact the administrator for device change approval.',
              lockedAt: session.lockedAt,
              sessionId: session.id,
            });
          }
        }

        // No session row yet for the existing attempt — create one now.
        const newToken = crypto.randomBytes(32).toString('hex');
        session = await AssessmentSession.create({
          attemptId: existing.id,
          quizId: quiz.id,
          participantId: req.user.id,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          deviceFingerprint,
          sessionToken: newToken,
          status: 'ACTIVE',
          lockedAt: now,
          expiresAt,
        });
        return res.json({ attemptId: existing.id, quiz, sessionToken: session.sessionToken });
      }

      // No existing attempt — but maybe a session row for a new quiz exists
      // already from another device. Honor the same conflict rule.
      if (activeForUser && deviceFingerprint && activeForUser.deviceFingerprint && activeForUser.deviceFingerprint !== deviceFingerprint) {
        return res.status(423).json({
          error: 'SESSION_LOCKED',
          message:
            'This assessment is already active on another device. Please contact the administrator for device change approval.',
          lockedAt: activeForUser.lockedAt,
          sessionId: activeForUser.id,
        });
      }

      const attempt = await QuizAttempt.create({
        quizId: quiz.id,
        participantId: req.user.id,
        status: 'IN_PROGRESS'
      });

      const sessionToken = crypto.randomBytes(32).toString('hex');
      await AssessmentSession.create({
        attemptId: attempt.id,
        quizId: quiz.id,
        participantId: req.user.id,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        deviceFingerprint,
        sessionToken,
        status: 'ACTIVE',
        lockedAt: now,
        expiresAt,
      });

      console.log(`[participant/start] Created attempt #${attempt.id} + session for quiz #${quiz.id}`);
      res.status(201).json({ attemptId: attempt.id, quiz, sessionToken });
    } catch (error) {
      console.error('[participant/start] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/ai-quiz/participant/submit/:attemptId
// Optional session lock: when X-Assessment-Session header is present we
// validate it via validateAssessmentSession. Legacy callers (proctoring,
// older clients) that don't send the header are unaffected.
const validateAssessmentSession = require('../middleware/validateAssessmentSession');
const optionalAssessmentSession = (req, res, next) => {
  if (req.headers['x-assessment-session'] || req.headers['X-Assessment-Session']) {
    return validateAssessmentSession(req, res, next);
  }
  return next();
};

router.post('/participant/submit/:attemptId',
  authenticateToken,
  roleMiddleware('PARTICIPANT'),
  optionalAssessmentSession,
  async (req, res) => {
    try {
      const { answers } = req.body;
      const attempt = await QuizAttempt.findOne({
        where: { id: req.params.attemptId, participantId: req.user.id }
      });
      if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

      const quiz = await AIQuiz.findByPk(attempt.quizId, {
        include: [{ model: AIQuestion, as: 'questions' }]
      });

      let totalScore = 0;
      const questionsMap = {};
      quiz.questions.forEach(q => { questionsMap[q.id] = q; });

      for (const ans of answers) {
        const question = questionsMap[ans.questionId];
        if (!question) continue;

        let score = 0;
        let feedback = '';
        let isCorrect = false;

        if (['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'MATCHING'].includes(question.questionType)) {
          const result = gradeAnswer(question, {
            selectedOption: ans.selectedOption !== undefined ? ans.selectedOption : null,
            answer: ans.answerText || ans.answer || '',
            answerText: ans.answerText || ans.answer || '',
            matches: ans.matches
          });
          isCorrect = result.isCorrect;
          score = result.score;
          if (question.questionType === 'MATCHING') {
            feedback = `Score: ${score}%. Matched ${result.correctCount} of ${result.total} correctly.`;
          } else {
            feedback = isCorrect ? 'Correct!' : `Incorrect. Correct answer: ${question.correctAnswer}`;
          }
        } else {
          const evaluation = await aiService.evaluateShortAnswer(
            question.questionText,
            question.correctAnswer,
            ans.answerText || ''
          );
          score = evaluation.score || 0;
          feedback = evaluation.feedback || '';
          isCorrect = evaluation.isCorrect || false;
        }

        await QuizAnswer.create({
          attemptId: attempt.id,
          questionId: ans.questionId,
          answerText: ans.answerText || '',
          selectedOption: ans.selectedOption !== undefined ? ans.selectedOption : null,
          isCorrect,
          score,
          feedback,
          evaluatedByAI: true
        });

        totalScore += score;
      }

      const maxScore = quiz.questions.length * 100;
      const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

      // Compute time taken (seconds) if attempt has a startedAt timestamp.
      // The QuizAttempt.timeTaken column already exists but was previously unused.
      const submittedAt = new Date();
      let timeTaken = null;
      try {
        if (attempt.startedAt) {
          timeTaken = Math.max(0, Math.round((submittedAt.getTime() - new Date(attempt.startedAt).getTime()) / 1000));
        }
      } catch (e) { /* non-fatal */ }

      await attempt.update({ status: 'EVALUATED', submittedAt, ...(timeTaken != null ? { timeTaken } : {}) });

      const result = await QuizResult.create({
        attemptId: attempt.id,
        quizId: quiz.id,
        participantId: req.user.id,
        totalScore,
        maxScore,
        percentage,
        evaluatedAt: new Date()
      });

      // ─── Realtime: broadcast updated leaderboards to subscribed clients ────
      // Best-effort emit only — never let socket failures break the response.
      try {
        const io = req.app.get('io');
        if (io) {
          const buildLeaderboard = async (where) => {
            const rows = await QuizResult.findAll({
              where,
              include: [{ model: User, as: 'participant', attributes: ['id', 'name'] }],
              order: [['percentage', 'DESC']]
            });
            return rows.map((r, idx) => ({
              rank: idx + 1,
              userId: r.participantId,
              name: r.participant?.name || 'Unknown',
              score: parseFloat(r.percentage),
              totalScore: parseFloat(r.totalScore),
              maxScore: parseFloat(r.maxScore)
            }));
          };
          // Quiz-scoped
          const quizLb = (await buildLeaderboard({ quizId: quiz.id })).slice(0, 50);
          io.to(`leaderboard:quiz:${quiz.id}`).emit('leaderboard:update', { scope: 'quiz', id: String(quiz.id), leaderboard: quizLb });
          // Training-scoped (if quiz attached to a training)
          if (quiz.trainingId) {
            const trainingQuizIds = (await AIQuiz.findAll({
              where: { trainingId: quiz.trainingId },
              attributes: ['id']
            })).map(q => q.id);
            const trainLb = (await buildLeaderboard({ quizId: trainingQuizIds })).slice(0, 50);
            io.to(`leaderboard:training:${quiz.trainingId}`).emit('leaderboard:update', { scope: 'training', id: String(quiz.trainingId), leaderboard: trainLb });
          }
          // Global
          const globalLb = (await buildLeaderboard({})).slice(0, 50);
          io.to('leaderboard:global').emit('leaderboard:update', { scope: 'global', id: '', leaderboard: globalLb });
        }
      } catch (emitErr) {
        console.warn('[submit] leaderboard emit failed:', emitErr.message);
      }

      // Best-effort: mark the assessment session EXPIRED so the participant
      // is no longer locked to this device. Skipped if no session existed
      // (legacy / proctored flow without X-Assessment-Session).
      try {
        if (req.assessmentSession) {
          await req.assessmentSession.update({ status: 'EXPIRED' });
        }
      } catch (e) {
        console.warn('[submit] session free failed:', e.message);
      }

      res.json({ message: 'Quiz submitted successfully', result });
    } catch (error) {
      console.error('Submit error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/ai-quiz/leaderboard/:quizId
router.get('/leaderboard/:quizId',
  authenticateToken,
  async (req, res) => {
    try {
      const results = await QuizResult.findAll({
        where: { quizId: req.params.quizId },
        include: [
          { model: User, as: 'participant', attributes: ['id', 'name'] }
        ],
        order: [['percentage', 'DESC']]
      });

      const leaderboard = results.map((r, idx) => ({
        rank: idx + 1,
        userId: r.participantId,
        name: r.participant?.name || 'Unknown',
        score: parseFloat(r.percentage),
        totalScore: parseFloat(r.totalScore),
        maxScore: parseFloat(r.maxScore)
      }));

      res.json({ leaderboard: leaderboard.slice(0, 50) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/ai-quiz/participant/quizzes
router.get('/participant/quizzes',
  authenticateToken,
  roleMiddleware('PARTICIPANT'),
  async (req, res) => {
    try {
      const { Op } = require('sequelize');
      const { Enrollment } = require('../models');

      const enrollments = await Enrollment.findAll({
        where: { participantId: req.user.id, status: 'ENROLLED' }
      });
      const courseIds = enrollments.map(e => e.courseId).filter(Boolean);
      const trainingIds = enrollments.map(e => e.trainingId).filter(Boolean);

      console.log(`[participant/quizzes] participantId=${req.user.id}, enrolledCourses=[${courseIds.join(',')}], enrolledTrainings=[${trainingIds.join(',')}]`);

      // Only show PUBLISHED quizzes belonging to a course (or legacy training)
      // the participant is actually enrolled in. No global/unscoped quizzes.
      const orConds = [];
      if (courseIds.length) orConds.push({ courseId: courseIds });
      if (trainingIds.length) orConds.push({ trainingId: trainingIds });
      if (orConds.length === 0) {
        return res.json({ quizzes: [] });
      }
      const whereClause = { status: 'PUBLISHED', [Op.or]: orConds };

      const quizzes = await AIQuiz.findAll({
        where: whereClause,
        include: [
          // CRITICAL: include questions so participants can see the count and take the quiz
          { model: AIQuestion, as: 'questions', attributes: ['id', 'questionText', 'questionType', 'options', 'correctAnswer', 'explanation', 'difficulty', 'order'] },
          { model: Training, as: 'training', attributes: ['id', 'title'] }
        ],
        order: [['created_at', 'DESC']]
      });

      console.log(`[participant/quizzes] Found ${quizzes.length} PUBLISHED quizzes`);
      quizzes.forEach(q => {
        console.log(`  → Quiz #${q.id} "${q.title}" has ${q.questions?.length ?? 0} questions`);
      });

      res.json({ quizzes });
    } catch (error) {
      console.error('[participant/quizzes] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// PARTICIPANT ANALYTICS & GLOBAL LEADERBOARD (additive — student dashboard)
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/ai-quiz/participant/stats
 * Aggregated quiz performance for the authenticated participant.
 * Returns: totalQuizzes, averageScore, bestRank, bestScore, accuracyTrend[], breakdownByQuiz[]
 */
router.get('/participant/stats',
  authenticateToken,
  roleMiddleware('PARTICIPANT'),
  async (req, res) => {
    try {
      const { Op, fn, col, literal } = require('sequelize');
      const userId = req.user.id;

      // All results for this participant (with quiz title)
      const myResults = await QuizResult.findAll({
        where: { participantId: userId },
        include: [{ model: AIQuiz, as: 'quiz', attributes: ['id', 'title', 'trainingId'] }],
        order: [['evaluated_at', 'ASC']]
      });

      const totalQuizzes = myResults.length;
      const averageScore = totalQuizzes > 0
        ? Number((myResults.reduce((s, r) => s + parseFloat(r.percentage), 0) / totalQuizzes).toFixed(2))
        : 0;
      const bestScore = totalQuizzes > 0
        ? Number(Math.max(...myResults.map(r => parseFloat(r.percentage))).toFixed(2))
        : 0;

      // Compute current rank in each quiz the user has taken, then take the lowest (best)
      let bestRank = null;
      const breakdownByQuiz = [];
      const seenQuizIds = new Set();
      for (const r of myResults) {
        if (seenQuizIds.has(r.quizId)) continue;
        seenQuizIds.add(r.quizId);

        // Use the participant's BEST percentage on this quiz when computing rank
        const myBest = Math.max(
          ...myResults.filter(x => x.quizId === r.quizId).map(x => parseFloat(x.percentage))
        );
        const higherCount = await QuizResult.count({
          where: { quizId: r.quizId, percentage: { [Op.gt]: myBest } },
          distinct: true,
          col: 'participantId'
        });
        const rank = higherCount + 1;
        if (bestRank === null || rank < bestRank) bestRank = rank;

        breakdownByQuiz.push({
          quizId: r.quizId,
          title: r.quiz?.title || 'Quiz',
          bestScore: Number(myBest.toFixed(2)),
          rank,
          attempts: myResults.filter(x => x.quizId === r.quizId).length,
        });
      }

      // Accuracy trend — score vs. evaluated date (most recent 14 attempts)
      const trend = myResults
        .slice(-14)
        .map((r) => ({
          date: r.evaluatedAt ? new Date(r.evaluatedAt).toISOString().slice(0, 10) : null,
          score: Number(parseFloat(r.percentage).toFixed(2)),
          quizTitle: r.quiz?.title || 'Quiz',
        }))
        .filter(x => x.date != null);

      res.json({
        stats: {
          totalQuizzes,
          averageScore,
          bestRank,
          bestScore,
          accuracyTrend: trend,
          breakdownByQuiz,
        }
      });
    } catch (error) {
      console.error('[participant/stats] Error:', error.message);
      res.status(500).json({ error: 'Server error fetching stats' });
    }
  }
);

/**
 * GET /api/ai-quiz/participant/global-leaderboard
 *   ?scope=global|training|quiz
 *   &id=<trainingId|quizId>   (required when scope != global)
 *
 * Returns the top-50 participants for that scope, with rank, score (best %),
 * accuracy, time taken (best attempt), and avatar initials.
 */
router.get('/participant/global-leaderboard',
  authenticateToken,
  async (req, res) => {
    try {
      const { Op } = require('sequelize');
      const scope = (req.query.scope || 'global').toLowerCase();
      const id = req.query.id ? String(req.query.id) : null;

      // Build the where-clause for QuizResult
      const where = {};
      if (scope === 'quiz' && id) {
        where.quizId = id;
      } else if (scope === 'training' && id) {
        const trainingQuizzes = await AIQuiz.findAll({
          where: { trainingId: id },
          attributes: ['id']
        });
        const ids = trainingQuizzes.map(q => q.id);
        if (ids.length === 0) return res.json({ leaderboard: [] });
        where.quizId = ids;
      }

      // Pull all results in scope, then group by participant taking their BEST
      const rows = await QuizResult.findAll({
        where,
        include: [
          { model: User, as: 'participant', attributes: ['id', 'name', 'profilePic'] },
          { model: QuizAttempt, as: 'attempt', attributes: ['id', 'timeTaken'], required: false }
        ],
        order: [['percentage', 'DESC']]
      });

      // Aggregate per participant — pick best %, with tie-break on shortest timeTaken
      const byUser = new Map();
      for (const r of rows) {
        const uid = r.participantId;
        const score = parseFloat(r.percentage);
        const timeTaken = r.attempt?.timeTaken ?? null;
        const accuracy = r.maxScore > 0 ? Number(((parseFloat(r.totalScore) / parseFloat(r.maxScore)) * 100).toFixed(1)) : score;
        const existing = byUser.get(uid);
        if (
          !existing ||
          score > existing.score ||
          (score === existing.score && timeTaken != null && (existing.timeTaken == null || timeTaken < existing.timeTaken))
        ) {
          byUser.set(uid, {
            userId: uid,
            name: r.participant?.name || 'Unknown',
            avatar: r.participant?.profilePic || null,
            score: Number(score.toFixed(2)),
            accuracy,
            timeTaken,                       // seconds (or null)
            attempts: (existing?.attempts || 0) + 1
          });
        } else {
          existing.attempts += 1;
        }
      }

      const sorted = Array.from(byUser.values()).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.timeTaken == null && b.timeTaken == null) return 0;
        if (a.timeTaken == null) return 1;
        if (b.timeTaken == null) return -1;
        return a.timeTaken - b.timeTaken;
      });

      const leaderboard = sorted.slice(0, 50).map((entry, idx) => ({
        rank: idx + 1,
        ...entry,
        isCurrentUser: entry.userId === req.user.id,
      }));

      res.json({ scope, id, leaderboard });
    } catch (error) {
      console.error('[participant/global-leaderboard] Error:', error.message);
      res.status(500).json({ error: 'Server error fetching leaderboard' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// ADMIN — assessment session management (locked sessions + reset override)
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/ai-quiz/admin/locked-sessions
 * Returns every ACTIVE session for the admin/trainer panel.
 * Includes participant + quiz lookups for display.
 */
router.get('/admin/locked-sessions',
  authenticateToken,
  roleMiddleware('ADMIN', 'TRAINER'),
  async (req, res) => {
    try {
      const { Op } = require('sequelize');
      const { AssessmentSession } = require('../models');

      const rows = await AssessmentSession.findAll({
        where: {
          status: 'ACTIVE',
          expiresAt: { [Op.gt]: new Date() },
        },
        include: [
          { model: User, as: 'participant', attributes: ['id', 'name', 'email'] },
          { model: AIQuiz, as: 'quiz', attributes: ['id', 'title'] },
        ],
        order: [['locked_at', 'DESC']],
      });

      const sessions = rows.map((s) => ({
        id: s.id,
        attemptId: s.attemptId,
        participantId: s.participantId,
        participantName: s.participant?.name || 'Unknown',
        participantEmail: s.participant?.email || '',
        quizId: s.quizId,
        quizTitle: s.quiz?.title || `Quiz #${s.quizId}`,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        deviceFingerprint: s.deviceFingerprint,
        lockedAt: s.lockedAt,
        expiresAt: s.expiresAt,
        status: s.status,
      }));

      res.json({ sessions });
    } catch (err) {
      console.error('[admin/locked-sessions] Error:', err.message);
      res.status(500).json({ error: 'Server error fetching sessions' });
    }
  }
);

/**
 * POST /api/ai-quiz/admin/reset-session/:sessionId
 * Body: { reason?: string }
 * Marks the session RESET so the participant can restart from a new device.
 */
router.post('/admin/reset-session/:sessionId',
  authenticateToken,
  roleMiddleware('ADMIN', 'TRAINER'),
  async (req, res) => {
    try {
      const { AssessmentSession } = require('../models');
      const id = req.params.sessionId;
      const reason = (req.body?.reason || '').toString().slice(0, 500);

      const session = await AssessmentSession.findByPk(id);
      if (!session) return res.status(404).json({ error: 'Session not found' });

      if (session.status === 'RESET') {
        return res.status(409).json({ error: 'Session has already been reset' });
      }

      await session.update({
        status: 'RESET',
        resetByAdmin: req.user.id,
        resetAt: new Date(),
      });

      console.log(`[admin/reset-session] session #${id} reset by user #${req.user.id}${reason ? ' — reason: ' + reason : ''}`);
      res.json({
        message: 'Session reset successfully. Participant may now restart on a new device.',
        sessionId: session.id,
      });
    } catch (err) {
      console.error('[admin/reset-session] Error:', err.message);
      res.status(500).json({ error: 'Server error resetting session' });
    }
  }
);

module.exports = router;
