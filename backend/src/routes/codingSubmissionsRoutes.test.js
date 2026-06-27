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
const assessments = [];
const submissions = [];
const questions = [];
const results = [];
const testCases = [];

function resetStore() {
  attempts.length = 0;
  assessments.length = 0;
  submissions.length = 0;
  questions.length = 0;
  results.length = 0;
  testCases.length = 0;
}

function makeAssessment(attrs) {
  const a = { id: attrs.id || assessments.length + 1, trainerId: attrs.trainerId ?? 10, title: attrs.title || 'Assessment', ...attrs };
  assessments.push(a);
  return a;
}

function makeAttempt(attrs) {
  const a = { id: attrs.id || attempts.length + 1, assessmentId: attrs.assessmentId, participantId: attrs.participantId || 1, totalScore: attrs.totalScore ?? 0, status: attrs.status || 'SUBMITTED', ...attrs };
  attempts.push(a);
  return a;
}

function makeQuestion(attrs) {
  const q = { id: attrs.id || questions.length + 1, assessmentId: attrs.assessmentId, title: attrs.title || 'Problem', ...attrs };
  questions.push(q);
  return q;
}

function makeSubmission(attrs) {
  const s = { id: attrs.id || submissions.length + 1, attemptId: attrs.attemptId, questionId: attrs.questionId || 1, language: attrs.language || 'javascript', sourceCode: attrs.sourceCode || '', score: attrs.score ?? 0, isFinal: attrs.isFinal !== false, ...attrs };
  submissions.push(s);
  return s;
}

function makeResult(attrs) {
  const r = { id: attrs.id || results.length + 1, submissionId: attrs.submissionId, status: attrs.status || 'PASSED', actualOutput: attrs.actualOutput || '', errorMessage: attrs.errorMessage || '', testCaseId: attrs.testCaseId, ...attrs };
  results.push(r);
  return r;
}

function makeTestCase(attrs) {
  const t = { id: attrs.id || testCases.length + 1, questionId: attrs.questionId || 1, input: attrs.input || '', expectedOutput: attrs.expectedOutput || '', orderIndex: attrs.orderIndex ?? 0, ...attrs };
  testCases.push(t);
  return t;
}

const mockCodingSubmission = {
  findAll: jest.fn(({ where, include }) => {
    let list = submissions.filter((s) => s.attemptId === Number(where.attemptId));
    if (where.isFinal !== undefined) {
      list = list.filter((s) => s.isFinal === where.isFinal);
    }
    return Promise.resolve(
      list.map((s) => {
        const copy = { ...s };
        copy.question = questions.find((q) => q.id === s.questionId) || null;
        copy.results = results.filter((r) => r.submissionId === s.id).map((r) => {
          const rc = { ...r };
          rc.testCase = testCases.find((t) => t.id === r.testCaseId) || null;
          return rc;
        });
        return copy;
      })
    );
  }),
};

const mockCodingAttempt = {
  findByPk: jest.fn((id) => {
    const found = attempts.find((a) => a.id === Number(id)) || null;
    return Promise.resolve(found);
  }),
};

const mockCodingAssessment = {
  findByPk: jest.fn((id) => {
    const found = assessments.find((a) => a.id === Number(id)) || null;
    return Promise.resolve(found);
  }),
};

jest.mock('../models', () => ({
  CodingSubmission: mockCodingSubmission,
  CodingQuestion: jest.fn(),
  CodingAttempt: mockCodingAttempt,
  CodingAssessment: mockCodingAssessment,
  SubmissionResult: jest.fn(),
  TestCase: jest.fn(),
}));

const codingSubmissionsRoutes = require('./codingSubmissionsRoutes');

describe('Coding Submissions Routes', () => {
  let app;

  function buildApp() {
    const a = express();
    a.use(express.json());
    a.use('/api/coding-submissions', codingSubmissionsRoutes);
    return a;
  }

  beforeEach(() => {
    resetStore();
    mockActiveUser = { id: 10, role: 'TRAINER' };
    jest.clearAllMocks();

    makeAssessment({ id: 1, trainerId: 10, title: 'Demo Assessment' });
    makeAttempt({ id: 1, assessmentId: 1, participantId: 5, totalScore: 80, status: 'SUBMITTED' });
    makeQuestion({ id: 1, assessmentId: 1, title: 'Two Sum' });
    makeTestCase({ id: 1, questionId: 1, input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', orderIndex: 0 });
    makeSubmission({ id: 1, attemptId: 1, questionId: 1, language: 'javascript', sourceCode: 'function twoSum() {}', score: 80, isFinal: true });
    makeResult({ id: 1, submissionId: 1, status: 'PASSED', actualOutput: '[0,1]', testCaseId: 1 });
  });

  describe('GET /api/coding-submissions/:attemptId', () => {
    it('returns final submissions for the trainer owner', async () => {
      app = buildApp();
      const res = await request(app).get('/api/coding-submissions/1');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.submissions).toHaveLength(1);
      expect(res.body.submissions[0].question.title).toBe('Two Sum');
      expect(res.body.submissions[0].results).toHaveLength(1);
      expect(res.body.submissions[0].results[0].status).toBe('PASSED');
    });

    it('allows admin to access any attempt', async () => {
      mockActiveUser = { id: 99, role: 'ADMIN' };
      app = buildApp();
      const res = await request(app).get('/api/coding-submissions/1');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.submissions).toHaveLength(1);
    });

    it('returns 403 when a different trainer tries to access', async () => {
      mockActiveUser = { id: 20, role: 'TRAINER' };
      app = buildApp();
      const res = await request(app).get('/api/coding-submissions/1');
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/Unauthorized/i);
    });

    it('returns 404 when attempt does not exist', async () => {
      app = buildApp();
      const res = await request(app).get('/api/coding-submissions/999');
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toMatch(/Not found/i);
    });

    it('returns 404 when assessment does not exist', async () => {
      attempts[0].assessmentId = 999;
      app = buildApp();
      const res = await request(app).get('/api/coding-submissions/1');
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toMatch(/Assessment not found/i);
    });

    it('rejects non-trainer non-admin users', async () => {
      mockActiveUser = { id: 5, role: 'PARTICIPANT' };
      app = buildApp();
      const res = await request(app).get('/api/coding-submissions/1');
      expect(res.statusCode).toBe(403);
    });

    it('filters only final submissions', async () => {
      makeSubmission({ id: 2, attemptId: 1, questionId: 1, isFinal: false, sourceCode: 'draft' });
      app = buildApp();
      const res = await request(app).get('/api/coding-submissions/1');
      expect(res.statusCode).toBe(200);
      expect(res.body.submissions).toHaveLength(1);
      expect(res.body.submissions[0].id).toBe(1);
    });
  });
});
