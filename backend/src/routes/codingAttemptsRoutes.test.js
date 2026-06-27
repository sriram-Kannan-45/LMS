const request = require('supertest');
const express = require('express');

let mockActiveUser;

jest.mock('../middleware/auth', () => {
  return (req, res, next) => {
    req.user = mockActiveUser;
    next();
  };
});

const attempts = [];
const submissions = [];
let nextAttemptId = 1;
let nextSubmissionId = 1;

function resetStore() {
  attempts.length = 0;
  submissions.length = 0;
  nextAttemptId = 1;
  nextSubmissionId = 1;
}

function makeAttempt(data) {
  const attempt = {
    id: nextAttemptId++,
    status: data.status || 'IN_PROGRESS',
    score: data.score || 0,
    totalScore: data.totalScore || 0,
    startedAt: data.startedAt || new Date(),
    submittedAt: data.submittedAt || null,
    assessmentId: data.assessmentId,
    participantId: data.participantId,
    assessment: data.assessment || null,
    submissions: data.submissions || [],
    update: jest.fn(function (updates) {
      Object.assign(this, updates);
      return Promise.resolve(this);
    }),
  };
  attempts.push(attempt);
  return attempt;
}

function makeSubmission(data) {
  const submission = {
    id: nextSubmissionId++,
    attemptId: data.attemptId,
    questionId: data.questionId || 1,
    participantId: data.participantId || 1,
    language: data.language || 'javascript',
    sourceCode: data.sourceCode || '',
    status: data.status || 'PASSED',
    score: data.score || 0,
    isFinal: data.isFinal !== undefined ? data.isFinal : true,
  };
  submissions.push(submission);
  return submission;
}

const assessments = {};

const mockCodingAssessment = {
  findByPk: jest.fn((id) => {
    const assessment = assessments[id] || null;
    if (assessment) {
      assessment.questions = assessment.questions || [];
    }
    return Promise.resolve(assessment);
  }),
};

const mockCodingAttempt = {
  findOne: jest.fn(({ where }) => {
    const found = attempts.find(
      (a) => a.assessmentId === where.assessmentId && a.participantId === where.participantId,
    );
    return Promise.resolve(found || null);
  }),
  findByPk: jest.fn((id, opts) => {
    const found = attempts.find((a) => a.id === Number(id)) || null;
    if (found) {
      found.submissions = submissions.filter((s) => s.attemptId === found.id);
    }
    return Promise.resolve(found);
  }),
  create: jest.fn((data) => {
    const attempt = makeAttempt(data);
    return Promise.resolve(attempt);
  }),
};

const mockCodingSubmission = {
  sum: jest.fn((field, { where }) => {
    const relevant = submissions.filter(
      (s) => s.attemptId === where.attemptId && s.isFinal === where.isFinal,
    );
    const total = relevant.reduce((acc, s) => acc + Number(s.score), 0);
    return Promise.resolve(total);
  }),
};

const mockCodingQuestion = {
  findByPk: jest.fn((id) => Promise.resolve({ id })),
};

const mockTestCase = {
  findByPk: jest.fn((id) => Promise.resolve({ id })),
};

const mockEnrollment = {
  findOne: jest.fn(({ where }) => {
    const found = enrollments.find(
      (e) =>
        e.participantId === where.participantId &&
        e.trainingId === where.trainingId &&
        e.status === where.status,
    );
    return Promise.resolve(found || null);
  }),
};

const mockUser = {
  findByPk: jest.fn((id) => Promise.resolve({ id })),
};

const mockExamSession = {
  findOne: jest.fn(() => Promise.resolve(null)),
  create: jest.fn((data) => Promise.resolve({ ...data, sessionToken: 'mock-session-token' })),
};

const enrollments = [];

jest.mock('../models', () => ({
  CodingAssessment: mockCodingAssessment,
  CodingAttempt: mockCodingAttempt,
  CodingSubmission: mockCodingSubmission,
  CodingQuestion: mockCodingQuestion,
  TestCase: mockTestCase,
  Enrollment: mockEnrollment,
  User: mockUser,
  ExamSession: mockExamSession,
}));

const codingAttemptsRoutes = require('./codingAttemptsRoutes');

describe('Coding Attempts Routes', () => {
  let app;

  function buildApp() {
    const a = express();
    a.use(express.json());
    a.use('/api/coding-attempts', codingAttemptsRoutes);
    return a;
  }

  function addAssessment(id, attrs) {
    assessments[id] = {
      id,
      status: 'PUBLISHED',
      trainingId: 1,
      trainerId: 10,
      title: 'Assessment ' + id,
      ...attrs,
      questions: attrs.questions || [],
    };
  }

  beforeEach(() => {
    resetStore();
    Object.keys(assessments).forEach((key) => delete assessments[key]);
    enrollments.length = 0;
    mockActiveUser = { id: 1, role: 'PARTICIPANT', email: 'participant@test.com' };
    jest.clearAllMocks();

    addAssessment(1, {
      questions: [
        {
          id: 1,
          assessmentId: 1,
          title: 'Q1',
          testCases: [{ id: 1, questionId: 1, input: '1 2', expectedOutput: '3' }],
        },
      ],
    });

    enrollments.push({ participantId: 1, trainingId: 1, status: 'ENROLLED' });
  });

  describe('POST /api/coding-attempts/start', () => {
    it('creates a new attempt when none exists', async () => {
      app = buildApp();
      const res = await request(app)
        .post('/api/coding-attempts/start')
        .send({ assessmentId: 1 });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.attemptId).toBeDefined();
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(attempts).toHaveLength(1);
    });

    it('resumes an existing IN_PROGRESS attempt', async () => {
      makeAttempt({ assessmentId: 1, participantId: 1, status: 'IN_PROGRESS' });
      app = buildApp();
      const res = await request(app)
        .post('/api/coding-attempts/start')
        .send({ assessmentId: 1 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(attempts).toHaveLength(1);
    });

    it('returns 409 when an attempt is already SUBMITTED', async () => {
      makeAttempt({ assessmentId: 1, participantId: 1, status: 'SUBMITTED' });
      app = buildApp();
      const res = await request(app)
        .post('/api/coding-attempts/start')
        .send({ assessmentId: 1 });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toMatch(/Already submitted/i);
    });

    it('returns 409 when an attempt is already AUTO_SUBMITTED', async () => {
      makeAttempt({ assessmentId: 1, participantId: 1, status: 'AUTO_SUBMITTED' });
      app = buildApp();
      const res = await request(app)
        .post('/api/coding-attempts/start')
        .send({ assessmentId: 1 });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toMatch(/Already submitted/i);
    });

    it('returns 422 when assessmentId is missing', async () => {
      app = buildApp();
      const res = await request(app).post('/api/coding-attempts/start').send({});
      expect(res.statusCode).toBe(422);
      expect(res.body.error).toMatch(/assessmentId/);
    });

    it('returns 404 when assessment does not exist', async () => {
      app = buildApp();
      const res = await request(app)
        .post('/api/coding-attempts/start')
        .send({ assessmentId: 999 });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when assessment is not published', async () => {
      addAssessment(2, { status: 'DRAFT' });
      app = buildApp();
      const res = await request(app)
        .post('/api/coding-attempts/start')
        .send({ assessmentId: 2 });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/not published/i);
    });

    it('returns 403 when participant is not enrolled', async () => {
      enrollments.length = 0;
      app = buildApp();
      const res = await request(app)
        .post('/api/coding-attempts/start')
        .send({ assessmentId: 1 });
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/not enrolled/i);
    });
  });

  describe('GET /api/coding-attempts/:id', () => {
    it('returns own attempt for a participant', async () => {
      const attempt = makeAttempt({
        assessmentId: 1,
        participantId: 1,
        status: 'IN_PROGRESS',
        assessment: assessments[1],
      });
      makeSubmission({ attemptId: attempt.id, score: 50, isFinal: true, participantId: 1 });
      app = buildApp();
      const res = await request(app).get(`/api/coding-attempts/${attempt.id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.attempt.id).toBe(attempt.id);
      expect(res.body.attempt.assessment.questions).toHaveLength(1);
      expect(res.body.attempt.assessment.questions[0].testCases).toHaveLength(1);
      expect(res.body.attempt.submissions).toHaveLength(1);
    });

    it('returns 403 when participant views another attempt', async () => {
      const attempt = makeAttempt({
        assessmentId: 1,
        participantId: 2,
        status: 'IN_PROGRESS',
        assessment: assessments[1],
      });
      app = buildApp();
      const res = await request(app).get(`/api/coding-attempts/${attempt.id}`);
      expect(res.statusCode).toBe(403);
    });

    it('returns 404 when attempt does not exist', async () => {
      app = buildApp();
      const res = await request(app).get('/api/coding-attempts/999');
      expect(res.statusCode).toBe(404);
    });

    it('allows trainer to view attempts for own assessment', async () => {
      mockActiveUser = { id: 10, role: 'TRAINER', email: 'trainer@test.com' };
      const attempt = makeAttempt({
        assessmentId: 1,
        participantId: 2,
        status: 'IN_PROGRESS',
        assessment: assessments[1],
      });
      app = buildApp();
      const res = await request(app).get(`/api/coding-attempts/${attempt.id}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.attempt.id).toBe(attempt.id);
    });

    it('returns 403 when trainer views attempt for another assessment', async () => {
      mockActiveUser = { id: 99, role: 'TRAINER', email: 'other@test.com' };
      const attempt = makeAttempt({
        assessmentId: 1,
        participantId: 2,
        status: 'IN_PROGRESS',
        assessment: assessments[1],
      });
      app = buildApp();
      const res = await request(app).get(`/api/coding-attempts/${attempt.id}`);
      expect(res.statusCode).toBe(403);
    });

    it('allows admin to view any attempt', async () => {
      mockActiveUser = { id: 1, role: 'ADMIN', email: 'admin@test.com' };
      const attempt = makeAttempt({
        assessmentId: 1,
        participantId: 2,
        status: 'IN_PROGRESS',
        assessment: assessments[1],
      });
      app = buildApp();
      const res = await request(app).get(`/api/coding-attempts/${attempt.id}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/coding-attempts/:id/submit', () => {
    it('submits own attempt and sums final scores', async () => {
      const attempt = makeAttempt({
        assessmentId: 1,
        participantId: 1,
        status: 'IN_PROGRESS',
        assessment: assessments[1],
      });
      makeSubmission({ attemptId: attempt.id, score: 40, isFinal: true, participantId: 1 });
      makeSubmission({ attemptId: attempt.id, score: 35, isFinal: true, participantId: 1 });
      makeSubmission({ attemptId: attempt.id, score: 10, isFinal: false, participantId: 1 });
      app = buildApp();
      const res = await request(app).post(`/api/coding-attempts/${attempt.id}/submit`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.attempt.status).toBe('SUBMITTED');
      expect(res.body.attempt.totalScore).toBe(75);
    });

    it('returns 409 when attempt is already submitted', async () => {
      const attempt = makeAttempt({
        assessmentId: 1,
        participantId: 1,
        status: 'SUBMITTED',
        assessment: assessments[1],
      });
      app = buildApp();
      const res = await request(app).post(`/api/coding-attempts/${attempt.id}/submit`);
      expect(res.statusCode).toBe(409);
      expect(res.body.error).toMatch(/Already submitted/i);
    });

    it('returns 404 when attempt does not exist', async () => {
      app = buildApp();
      const res = await request(app).post('/api/coding-attempts/999/submit');
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 when submitting another participants attempt', async () => {
      const attempt = makeAttempt({
        assessmentId: 1,
        participantId: 2,
        status: 'IN_PROGRESS',
        assessment: assessments[1],
      });
      app = buildApp();
      const res = await request(app).post(`/api/coding-attempts/${attempt.id}/submit`);
      expect(res.statusCode).toBe(403);
    });
  });
});
