const { QuizRecording, User, AIQuiz, QuizResult, QuizAttempt, ExamSession, Violation, CodingAttempt, CodingAssessment } = require('../models');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const STORAGE_ROOT = path.join(__dirname, '..', '..', 'storage', 'recordings');

function ensureStorageDir(quizId) {
  const dir = path.join(STORAGE_ROOT, String(quizId));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function ok(res, data) { return res.json({ success: true, data }); }
function fail(res, status, message) { return res.status(status).json({ success: false, message }); }

exports.upload = async (req, res) => {
  try {
    const assessmentType = req.body.assessment_type === 'coding_assessment' ? 'coding_assessment' : 'quiz';
    const { participantId, sessionId, durationSeconds } = req.body;

    if (!participantId || !sessionId) {
      return fail(res, 400, 'participantId and sessionId are required');
    }
    if (!req.file) {
      return fail(res, 400, 'No recording file uploaded');
    }

    let quizId = null;
    let codingAttemptId = null;
    let trainerId = req.user.id;
    let storageKey;

    if (assessmentType === 'coding_assessment') {
      codingAttemptId = req.body.codingAttemptId;
      if (!codingAttemptId) {
        return fail(res, 400, 'codingAttemptId is required for coding assessment recordings');
      }
      const attempt = await CodingAttempt.findByPk(codingAttemptId, {
        include: [{ model: CodingAssessment, as: 'assessment', attributes: ['id', 'trainerId'] }]
      });
      if (!attempt) return fail(res, 404, 'Coding attempt not found');
      trainerId = attempt.assessment?.trainerId || req.user.id;
      storageKey = `coding_${codingAttemptId}`;
    } else {
      quizId = req.body.quizId;
      if (!quizId) {
        return fail(res, 400, 'quizId is required for quiz recordings');
      }
      const quiz = await AIQuiz.findByPk(quizId);
      if (!quiz) return fail(res, 404, 'Quiz not found');
      trainerId = quiz.trainerId || req.user.id;
      storageKey = quizId;
    }

    const filePath = path.join(ensureStorageDir(storageKey), `${storageKey}_${participantId}_${Date.now()}.webm`);

    fs.renameSync(req.file.path, filePath);

    const fileSizeMb = Math.round((fs.statSync(filePath).size / (1024 * 1024)) * 100) / 100;

    const recording = await QuizRecording.create({
      quizId: assessmentType === 'quiz' ? (quizId || null) : null,
      codingAttemptId: assessmentType === 'coding_assessment' ? (codingAttemptId || null) : null,
      participantId,
      trainerId,
      sessionId,
      filePath,
      fileSizeMb,
      durationSeconds: durationSeconds ? parseInt(durationSeconds, 10) : null,
      assessmentType,
      status: 'ready',
      recordedAt: new Date()
    });

    return ok(res, recording);
  } catch (error) {
    logger.error('[recordingController.upload]', { error: error.message });
    return fail(res, 500, error.message);
  }
};

exports.list = async (req, res) => {
  try {
    const { quiz_id, participant_id, role, status, search, date_from, date_to, type, page = 1, limit = 20 } = req.query;
    const userRole = (req.user.role || '').toUpperCase();
    const userId = req.user.id;

    const where = { isDeleted: false };

    if (type === 'coding') {
      where.assessmentType = 'coding_assessment';
    } else if (type === 'quiz') {
      where.assessmentType = 'quiz';
    }

    if (quiz_id) where.quizId = quiz_id;
    if (participant_id) where.participantId = participant_id;
    if (status) where.status = status;
    if (date_from) where.recordedAt = { ...where.recordedAt, [Op.gte]: new Date(date_from) };
    if (date_to) where.recordedAt = { ...where.recordedAt, [Op.lte]: new Date(date_to) };

    if (userRole === 'TRAINER') {
      where.trainerId = userId;
    } else if (userRole === 'PARTICIPANT') {
      where.participantId = userId;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await QuizRecording.findAndCountAll({
      where,
      include: [
        { model: User, as: 'participant', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'trainer', attributes: ['id', 'name', 'email'] },
        { model: AIQuiz, as: 'quiz', attributes: ['id', 'title'] },
        { model: CodingAttempt, as: 'codingAttempt', attributes: ['id', 'assessmentId', 'participantId'] }
      ],
      order: [['recorded_at', 'DESC']],
      offset,
      limit: parseInt(limit)
    });

    const enhancedRecordings = [];
    for (const rec of rows) {
      const recJson = rec.toJSON();
      let violationCount = 0;
      try {
        const sessionWhere = recJson.assessmentType === 'coding_assessment'
          ? {
              assessmentType: 'coding_assessment',
              assessmentId: recJson.codingAttempt?.assessmentId,
              participantId: recJson.participantId,
            }
          : { quizId: recJson.quizId, participantId: recJson.participantId };
        const sessions = await ExamSession.findAll({
          where: sessionWhere,
          attributes: ['id']
        });
        if (sessions.length > 0) {
          violationCount = await Violation.count({
            where: { sessionId: sessions.map(s => s.id) }
          });
        }
      } catch (e) {
        // Proctoring tables might not exist
      }
      recJson.violationCount = violationCount;
      enhancedRecordings.push(recJson);
    }

    return ok(res, {
      recordings: enhancedRecordings,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('[recordingController.list]', { error: error.message });
    return fail(res, 500, error.message);
  }
};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = (req.user.role || '').toUpperCase();
    const userId = req.user.id;

    const recording = await QuizRecording.findByPk(id, {
      include: [
        { model: User, as: 'participant', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'trainer', attributes: ['id', 'name', 'email'] },
        { model: AIQuiz, as: 'quiz', attributes: ['id', 'title'] },
        {
          model: CodingAttempt,
          as: 'codingAttempt',
          attributes: ['id', 'assessmentId', 'participantId', 'status', 'totalScore', 'startedAt', 'submittedAt'],
          include: [{ model: CodingAssessment, as: 'assessment', attributes: ['id', 'title'] }]
        }
      ]
    });

    if (!recording || recording.isDeleted) {
      return fail(res, 404, 'Recording not found');
    }

    if (userRole === 'TRAINER' && recording.trainerId !== userId) {
      return fail(res, 403, 'Access denied. You can only view recordings from your own sessions.');
    }

    if (userRole === 'PARTICIPANT') {
      return fail(res, 403, 'Access denied. Participants cannot view recordings.');
    }

    const quizResult = await QuizResult.findOne({
      where: { quizId: recording.quizId, participantId: recording.participantId },
      include: [{ model: QuizAttempt, as: 'attempt', attributes: ['timeTaken', 'startedAt', 'submittedAt'] }]
    });

    let violations = [];
    try {
      const sessionWhere = recording.assessmentType === 'coding_assessment'
        ? {
            assessmentType: 'coding_assessment',
            assessmentId: recording.codingAttempt?.assessmentId,
            participantId: recording.participantId,
          }
        : { quizId: recording.quizId, participantId: recording.participantId };
      const sessions = await ExamSession.findAll({
        where: sessionWhere,
        attributes: ['id'],
      });
      if (sessions.length > 0) {
        violations = await Violation.findAll({
          where: { sessionId: sessions.map(s => s.id) },
          order: [['occurredAt', 'ASC']],
          limit: 100,
        });
      }
    } catch (e) {
      // Proctoring tables may not exist; return empty violations
    }

    return ok(res, { recording, quizResult, violations });
  } catch (error) {
    logger.error('[recordingController.getOne]', { error: error.message });
    return fail(res, 500, error.message);
  }
};

exports.stream = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user) {
      const token = req.query.token;
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = decoded;
          if (req.user && typeof req.user.role === 'string') {
            req.user.role = req.user.role.toUpperCase();
          }
        } catch (e) {
          return fail(res, 403, 'Invalid or expired token');
        }
      } else {
        return fail(res, 401, 'Authentication required');
      }
    }
    const userRole = (req.user.role || '').toUpperCase();
    const userId = req.user.id;

    const recording = await QuizRecording.findByPk(id);
    if (!recording || recording.isDeleted) {
      return fail(res, 404, 'Recording not found');
    }

    if (userRole === 'TRAINER' && recording.trainerId !== userId) {
      return fail(res, 403, 'Access denied');
    }

    if (userRole === 'PARTICIPANT' && recording.participantId !== userId) {
      return fail(res, 403, 'Access denied');
    }

    const filePath = recording.filePath;
    if (!fs.existsSync(filePath)) {
      return fail(res, 404, 'Video file not found on disk');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = { '.webm': 'video/webm', '.mp4': 'video/mp4' };
    const contentType = mimeTypes[ext] || 'video/webm';

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    logger.error('[recordingController.stream]', { error: error.message });
    if (!res.headersSent) return fail(res, 500, error.message);
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { durationSeconds, fileSizeMb, status } = req.body;
    const userRole = (req.user.role || '').toUpperCase();
    const userId = req.user.id;

    const recording = await QuizRecording.findByPk(id);
    if (!recording || recording.isDeleted) {
      return fail(res, 404, 'Recording not found');
    }

    if (userRole === 'TRAINER' && recording.trainerId !== userId) {
      return fail(res, 403, 'Access denied');
    }

    if (durationSeconds !== undefined) recording.durationSeconds = durationSeconds;
    if (fileSizeMb !== undefined) recording.fileSizeMb = fileSizeMb;
    if (status !== undefined) recording.status = status;
    await recording.save();

    return ok(res, recording);
  } catch (error) {
    logger.error('[recordingController.update]', { error: error.message });
    return fail(res, 500, error.message);
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = (req.user.role || '').toUpperCase();

    if (userRole !== 'ADMIN') {
      return fail(res, 403, 'Only admins can delete recordings');
    }

    const recording = await QuizRecording.findByPk(id);
    if (!recording || recording.isDeleted) {
      return fail(res, 404, 'Recording not found');
    }

    recording.isDeleted = true;
    await recording.save();

    return ok(res, { message: 'Recording deleted successfully' });
  } catch (error) {
    logger.error('[recordingController.remove]', { error: error.message });
    return fail(res, 500, error.message);
  }
};
