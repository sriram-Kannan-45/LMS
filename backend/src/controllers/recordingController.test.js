const path = require('path');

jest.mock('../models', () => ({
  QuizRecording: {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
  },
  User: {},
  AIQuiz: {
    findByPk: jest.fn(),
  },
  QuizResult: {},
  QuizAttempt: {},
  ExamSession: {
    findAll: jest.fn(),
  },
  Violation: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  CodingAttempt: {
    findByPk: jest.fn(),
  },
  CodingAssessment: {},
}));

jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  renameSync: jest.fn(),
  statSync: jest.fn(),
  createReadStream: jest.fn(),
}));

const {
  QuizRecording,
  AIQuiz,
  CodingAttempt,
  ExamSession,
  Violation,
} = require('../models');
const fs = require('fs');
const recordingController = require('./recordingController');

describe('recordingController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue({ size: 2 * 1024 * 1024 });
  });

  function mockRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.writeHead = jest.fn(() => res);
    res.pipe = jest.fn();
    res.headersSent = false;
    return res;
  }

  describe('upload', () => {
    it('creates a quiz recording with default assessment_type', async () => {
      const req = {
        body: {
          quizId: '1',
          participantId: '10',
          sessionId: 'session-1',
          durationSeconds: '120',
        },
        file: { path: '/tmp/uploaded' },
        user: { id: 100 },
      };
      const res = mockRes();

      AIQuiz.findByPk.mockResolvedValue({ id: 1, trainerId: 200 });
      QuizRecording.create.mockResolvedValue({
        id: 1,
        quizId: 1,
        codingAttemptId: null,
        assessmentType: 'quiz',
      });

      await recordingController.upload(req, res);

      expect(AIQuiz.findByPk).toHaveBeenCalledWith('1');
      expect(QuizRecording.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quizId: '1',
          codingAttemptId: null,
          participantId: '10',
          trainerId: 200,
          sessionId: 'session-1',
          assessmentType: 'quiz',
          status: 'ready',
          durationSeconds: 120,
          fileSizeMb: expect.any(Number),
        })
      );
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Object) })
      );
    });

    it('creates a coding assessment recording when assessment_type is coding_assessment', async () => {
      const req = {
        body: {
          assessment_type: 'coding_assessment',
          codingAttemptId: '5',
          participantId: '10',
          sessionId: 'session-2',
          durationSeconds: '180',
        },
        file: { path: '/tmp/uploaded' },
        user: { id: 100 },
      };
      const res = mockRes();

      CodingAttempt.findByPk.mockResolvedValue({
        id: 5,
        assessment: { id: 2, trainerId: 300 },
      });
      QuizRecording.create.mockResolvedValue({
        id: 2,
        quizId: null,
        codingAttemptId: 5,
        assessmentType: 'coding_assessment',
      });

      await recordingController.upload(req, res);

      expect(CodingAttempt.findByPk).toHaveBeenCalledWith('5', expect.any(Object));
      expect(QuizRecording.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quizId: null,
          codingAttemptId: '5',
          participantId: '10',
          trainerId: 300,
          sessionId: 'session-2',
          assessmentType: 'coding_assessment',
          status: 'ready',
          durationSeconds: 180,
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('returns 400 if participantId or sessionId is missing', async () => {
      const req = { body: { quizId: '1' }, file: { path: '/tmp/uploaded' }, user: { id: 1 } };
      const res = mockRes();

      await recordingController.upload(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('participantId and sessionId') })
      );
    });

    it('returns 400 if no file is uploaded', async () => {
      const req = {
        body: { quizId: '1', participantId: '10', sessionId: 'session-1' },
        user: { id: 1 },
      };
      const res = mockRes();

      await recordingController.upload(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('No recording file') })
      );
    });

    it('returns 400 if quizId is missing for quiz assessment', async () => {
      const req = {
        body: { assessment_type: 'quiz', participantId: '10', sessionId: 'session-1' },
        file: { path: '/tmp/uploaded' },
        user: { id: 1 },
      };
      const res = mockRes();

      await recordingController.upload(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('quizId') })
      );
    });

    it('returns 400 if codingAttemptId is missing for coding assessment', async () => {
      const req = {
        body: { assessment_type: 'coding_assessment', participantId: '10', sessionId: 'session-1' },
        file: { path: '/tmp/uploaded' },
        user: { id: 1 },
      };
      const res = mockRes();

      await recordingController.upload(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('codingAttemptId') })
      );
    });

    it('returns 404 if quiz is not found', async () => {
      const req = {
        body: { quizId: '999', participantId: '10', sessionId: 'session-1' },
        file: { path: '/tmp/uploaded' },
        user: { id: 1 },
      };
      const res = mockRes();
      AIQuiz.findByPk.mockResolvedValue(null);

      await recordingController.upload(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('Quiz not found') })
      );
    });

    it('returns 404 if coding attempt is not found', async () => {
      const req = {
        body: { assessment_type: 'coding_assessment', codingAttemptId: '999', participantId: '10', sessionId: 'session-1' },
        file: { path: '/tmp/uploaded' },
        user: { id: 1 },
      };
      const res = mockRes();
      CodingAttempt.findByPk.mockResolvedValue(null);

      await recordingController.upload(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('Coding attempt not found') })
      );
    });

    it('falls back to req.user.id when quiz trainerId is absent', async () => {
      const req = {
        body: { quizId: '1', participantId: '10', sessionId: 'session-1' },
        file: { path: '/tmp/uploaded' },
        user: { id: 100 },
      };
      const res = mockRes();

      AIQuiz.findByPk.mockResolvedValue({ id: 1 });
      QuizRecording.create.mockResolvedValue({ id: 3 });

      await recordingController.upload(req, res);

      expect(QuizRecording.create).toHaveBeenCalledWith(
        expect.objectContaining({ trainerId: 100 })
      );
    });

    it('stores durationSeconds as null when omitted', async () => {
      const req = {
        body: { quizId: '1', participantId: '10', sessionId: 'session-1' },
        file: { path: '/tmp/uploaded' },
        user: { id: 100 },
      };
      const res = mockRes();

      AIQuiz.findByPk.mockResolvedValue({ id: 1, trainerId: 200 });
      QuizRecording.create.mockResolvedValue({ id: 4 });

      await recordingController.upload(req, res);

      expect(QuizRecording.create).toHaveBeenCalledWith(
        expect.objectContaining({ durationSeconds: null })
      );
    });
  });

  describe('list', () => {
    function mockListResponse(count, rows) {
      QuizRecording.findAndCountAll.mockResolvedValue({ count, rows });
      ExamSession.findAll.mockResolvedValue([]);
      Violation.count.mockResolvedValue(0);
    }

    it('lists all recordings when no type filter is provided', async () => {
      const req = {
        query: {},
        user: { id: 1, role: 'ADMIN' },
      };
      const res = mockRes();
      const rows = [{ toJSON: () => ({ id: 1, quizId: 1, participantId: 10 }) }];
      mockListResponse(1, rows);

      await recordingController.list(req, res);

      expect(QuizRecording.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isDeleted: false }),
        })
      );
      const callArg = QuizRecording.findAndCountAll.mock.calls[0][0];
      expect(callArg.where.assessmentType).toBeUndefined();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Object) })
      );
    });

    it('filters quiz recordings when type=quiz', async () => {
      const req = {
        query: { type: 'quiz' },
        user: { id: 1, role: 'ADMIN' },
      };
      const res = mockRes();
      const rows = [{ toJSON: () => ({ id: 1, assessmentType: 'quiz' }) }];
      mockListResponse(1, rows);

      await recordingController.list(req, res);

      const callArg = QuizRecording.findAndCountAll.mock.calls[0][0];
      expect(callArg.where.assessmentType).toBe('quiz');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('filters coding recordings when type=coding', async () => {
      const req = {
        query: { type: 'coding' },
        user: { id: 1, role: 'ADMIN' },
      };
      const res = mockRes();
      const rows = [{ toJSON: () => ({ id: 2, assessmentType: 'coding_assessment' }) }];
      mockListResponse(1, rows);

      await recordingController.list(req, res);

      const callArg = QuizRecording.findAndCountAll.mock.calls[0][0];
      expect(callArg.where.assessmentType).toBe('coding_assessment');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('restricts trainers to their own recordings', async () => {
      const req = {
        query: { type: 'quiz' },
        user: { id: 5, role: 'TRAINER' },
      };
      const res = mockRes();
      const rows = [{ toJSON: () => ({ id: 1 }) }];
      mockListResponse(1, rows);

      await recordingController.list(req, res);

      const callArg = QuizRecording.findAndCountAll.mock.calls[0][0];
      expect(callArg.where.trainerId).toBe(5);
      expect(callArg.where.assessmentType).toBe('quiz');
    });

    it('restricts participants to their own recordings', async () => {
      const req = {
        query: { type: 'coding' },
        user: { id: 7, role: 'PARTICIPANT' },
      };
      const res = mockRes();
      const rows = [{ toJSON: () => ({ id: 1 }) }];
      mockListResponse(1, rows);

      await recordingController.list(req, res);

      const callArg = QuizRecording.findAndCountAll.mock.calls[0][0];
      expect(callArg.where.participantId).toBe(7);
      expect(callArg.where.assessmentType).toBe('coding_assessment');
    });

    it('supports pagination with defaults', async () => {
      const req = {
        query: {},
        user: { id: 1, role: 'ADMIN' },
      };
      const res = mockRes();
      const rows = [];
      mockListResponse(0, rows);

      await recordingController.list(req, res);

      const callArg = QuizRecording.findAndCountAll.mock.calls[0][0];
      expect(callArg.limit).toBe(20);
      expect(callArg.offset).toBe(0);
    });
  });
});
