const request = require('supertest');
const express = require('express');

let mockActiveUser;

jest.mock('../middleware/auth', () => {
  return (req, res, next) => {
    req.user = mockActiveUser;
    next();
  };
});

const mockRunTests = jest.fn();
const mockCalculateScore = jest.fn();

jest.mock('../services/codeExecutionService', () => ({
  runTests: mockRunTests,
  calculateScore: mockCalculateScore,
}));

const questions = {};
const attempts = {};
const assessments = {};
const submissions = [];
let nextSubmissionId = 1;

function resetStore() {
  Object.keys(questions).forEach((key) => delete questions[key]);
  Object.keys(attempts).forEach((key) => delete attempts[key]);
  Object.keys(assessments).forEach((key) => delete assessments[key]);
  Object.keys(testCasesByQuestion).forEach((key) => delete testCasesByQuestion[key]);
  submissions.length = 0;
  nextSubmissionId = 1;
}

function addQuestion(id, attrs) {
  questions[id] = {
    id,
    title: 'Q' + id,
    marks: 10,
    assessmentId: 1,
    ...attrs,
  };
}

function addAttempt(id, attrs) {
  attempts[id] = {
    id,
    participantId: 1,
    totalScore: 0,
    assessmentId: 1,
    status: 'IN_PROGRESS',
    ...attrs,
    update: jest.fn(function (updates) {
      Object.assign(this, updates);
      return Promise.resolve(this);
    }),
  };
}

function makeSubmission(data) {
  const submission = {
    id: nextSubmissionId++,
    attemptId: data.attemptId,
    questionId: data.questionId || 1,
    participantId: data.participantId || 1,
    language: data.language || 'javascript',
    code: data.code || '',
    sourceCode: data.sourceCode || '',
    status: data.status || 'PASSED',
    score: data.score || 0,
    testsPassed: data.testsPassed !== undefined ? data.testsPassed : 0,
    testsTotal: data.testsTotal !== undefined ? data.testsTotal : 0,
    passedCount: data.passedCount !== undefined ? data.passedCount : 0,
    totalCount: data.totalCount !== undefined ? data.totalCount : 0,
    isFinal: data.isFinal !== undefined ? data.isFinal : false,
    submittedAt: data.submittedAt || new Date(),
  };
  submissions.push(submission);
  return submission;
}

const testCasesByQuestion = {};

function addTestCase(questionId, attrs) {
  testCasesByQuestion[questionId] = testCasesByQuestion[questionId] || [];
  testCasesByQuestion[questionId].push({
    id: testCasesByQuestion[questionId].length + 1,
    questionId,
    input: '',
    expectedOutput: '',
    isHidden: false,
    order_index: testCasesByQuestion[questionId].length,
    ...attrs,
  });
}

const mockCodingQuestion = {
  findByPk: jest.fn((id) => Promise.resolve(questions[id] || null)),
};

const mockTestCase = {
  findAll: jest.fn(({ where, order }) => {
    let list = (testCasesByQuestion[where.questionId] || []).slice();
    if (where && where.isHidden === false) {
      list = list.filter((tc) => tc.isHidden === false);
    }
    if (order && order[0] && order[0][0] === 'order_index') {
      list.sort((a, b) => a.order_index - b.order_index);
    }
    return Promise.resolve(list);
  }),
};

const mockCodingAttempt = {
  findByPk: jest.fn((id) => Promise.resolve(attempts[id] || null)),
  findOne: jest.fn(({ where }) => {
    const list = Object.values(attempts);
    const found = list.find(
      (a) =>
        a.assessmentId === where.assessmentId &&
        a.participantId === where.participantId &&
        (where.status === undefined || where.status.includes(a.status)),
    );
    return Promise.resolve(found || null);
  }),
};

const mockCodingAssessment = {
  findByPk: jest.fn((id) => Promise.resolve(assessments[id] || { id, status: 'PUBLISHED' })),
};

const mockCodingSubmission = {
  findAll: jest.fn(({ where }) => {
    return Promise.resolve(
      submissions.filter(
        (s) => s.attemptId === where.attemptId && s.isFinal === where.isFinal,
      ),
    );
  }),
  update: jest.fn(({ isFinal }, { where }) => {
    submissions
      .filter(
        (s) =>
          s.attemptId === where.attemptId &&
          s.questionId === where.questionId &&
          s.isFinal === where.isFinal,
      )
      .forEach((s) => {
        s.isFinal = isFinal;
      });
    return Promise.resolve([0]);
  }),
  create: jest.fn((data) => {
    const submission = makeSubmission(data);
    return Promise.resolve(submission);
  }),
};

jest.mock('../models', () => ({
  CodingQuestion: mockCodingQuestion,
  TestCase: mockTestCase,
  CodingAttempt: mockCodingAttempt,
  CodingSubmission: mockCodingSubmission,
  CodingAssessment: mockCodingAssessment,
}));

const codeExecutionRoutes = require('./codeExecutionRoutes');

describe('Code Execution Routes', () => {
  let app;

  function buildApp() {
    const a = express();
    a.use(express.json());
    a.use('/api/code', codeExecutionRoutes);
    return a;
  }

  beforeEach(() => {
    resetStore();
    mockActiveUser = { id: 1, role: 'PARTICIPANT', email: 'participant@test.com' };
    jest.clearAllMocks();

    addQuestion(1, { marks: 10, timeLimitSec: 2, assessmentId: 1 });
    addQuestion(2, { marks: 20, timeLimitSec: 3, assessmentId: 2 });
    addAttempt(1, { participantId: 1, assessmentId: 1, status: 'IN_PROGRESS' });
    addAttempt(2, { participantId: 2, assessmentId: 2, status: 'IN_PROGRESS' });

    addTestCase(1, { input: '1 2', expectedOutput: '3', isHidden: false });
    addTestCase(1, { input: '3 4', expectedOutput: '7', isHidden: true });
    addTestCase(2, { input: '5', expectedOutput: '10', isHidden: false });
  });

  describe('POST /api/code/run', () => {
    it('returns test results for visible test cases', async () => {
      app = buildApp();
      mockRunTests.mockResolvedValueOnce({
        results: [
          { stdin: '1 2', expectedOutput: '3', actualOutput: '3', status: 'OK' },
        ],
        passed: 1,
        total: 1,
      });

      const res = await request(app)
        .post('/api/code/run')
        .send({ code: 'console.log(3)', language: 'javascript', problemId: 1 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.passed).toBe(1);
      expect(res.body.total).toBe(1);
      expect(mockRunTests).toHaveBeenCalledWith({
        code: 'console.log(3)',
        language: 'javascript',
        testCases: [{ stdin: '1 2', expectedOutput: '3' }],
        timeout: 2000,
      });
    });

    it('returns 422 when required fields are missing', async () => {
      app = buildApp();
      const res = await request(app)
        .post('/api/code/run')
        .send({ language: 'javascript', problemId: 1 });

      expect(res.statusCode).toBe(422);
      expect(res.body.error).toMatch(/required/i);
      expect(mockRunTests).not.toHaveBeenCalled();
    });

    it('returns 404 when question does not exist', async () => {
      app = buildApp();
      const res = await request(app)
        .post('/api/code/run')
        .send({ code: 'x', language: 'javascript', problemId: 999 });

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('uses default timeout when timeLimitSec is not set', async () => {
      addQuestion(3, { marks: 5 });
      addTestCase(3, { input: 'a', expectedOutput: 'b', isHidden: false });
      app = buildApp();
      mockRunTests.mockResolvedValueOnce({
        results: [{ stdin: 'a', expectedOutput: 'b', actualOutput: 'b', status: 'OK' }],
        passed: 1,
        total: 1,
      });

      await request(app)
        .post('/api/code/run')
        .send({ code: 'x', language: 'javascript', problemId: 3 });

      expect(mockRunTests).toHaveBeenCalledWith(
        expect.objectContaining({ timeout: 5000 }),
      );
    });
  });

  describe('POST /api/code/submit', () => {
    it('creates a final submission and updates attempt total score', async () => {
      app = buildApp();
      mockRunTests.mockResolvedValueOnce({
        results: [
          { stdin: '1 2', expectedOutput: '3', actualOutput: '3', status: 'OK' },
          { stdin: '3 4', expectedOutput: '7', actualOutput: '7', status: 'OK' },
        ],
        passed: 2,
        total: 2,
      });
      mockCalculateScore.mockReturnValueOnce(10);

      const res = await request(app)
        .post('/api/code/submit')
        .send({
          code: 'console.log(a+b)',
          language: 'javascript',
          problemId: 1,
          attemptId: 1,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.score).toBe(10);
      expect(res.body.hiddenTestsPassed).toBe(1);
      expect(res.body.hiddenTestsTotal).toBe(1);
      expect(res.body.submissionId).toBeDefined();
      expect(res.body.results).toHaveLength(2);
      expect(mockCodingSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptId: 1,
          questionId: 1,
          participantId: 1,
          language: 'javascript',
          code: 'console.log(a+b)',
          sourceCode: 'console.log(a+b)',
          status: 'PASSED',
          score: 10,
          testsPassed: 2,
          testsTotal: 2,
          passedCount: 2,
          totalCount: 2,
          isFinal: true,
        }),
      );
      expect(attempts[1].totalScore).toBe(10);
    });

    it('marks previous final submissions as not final', async () => {
      makeSubmission({ attemptId: 1, questionId: 1, isFinal: true, score: 5 });
      app = buildApp();
      mockRunTests.mockResolvedValueOnce({
        results: [{ stdin: '1 2', expectedOutput: '3', actualOutput: '3', status: 'OK' }],
        passed: 1,
        total: 2,
      });
      mockCalculateScore.mockReturnValueOnce(5);

      await request(app)
        .post('/api/code/submit')
        .send({
          code: 'console.log(3)',
          language: 'javascript',
          problemId: 1,
          attemptId: 1,
        });

      const previous = submissions.find((s) => s.id === 1);
      expect(previous.isFinal).toBe(false);
      expect(mockCodingSubmission.update).toHaveBeenCalledWith(
        { isFinal: false },
        { where: { attemptId: 1, questionId: 1, isFinal: true } },
      );
    });

    it('returns PARTIAL status when some tests pass', async () => {
      app = buildApp();
      mockRunTests.mockResolvedValueOnce({
        results: [
          { stdin: '1 2', expectedOutput: '3', actualOutput: '3', status: 'OK' },
          { stdin: '3 4', expectedOutput: '7', actualOutput: '6', status: 'FAILED' },
        ],
        passed: 1,
        total: 2,
      });
      mockCalculateScore.mockReturnValueOnce(5);

      const res = await request(app)
        .post('/api/code/submit')
        .send({
          code: 'x',
          language: 'javascript',
          problemId: 1,
          attemptId: 1,
        });

      expect(res.statusCode).toBe(200);
      expect(mockCodingSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PARTIAL' }),
      );
      expect(res.body.hiddenTestsPassed).toBe(0);
    });

    it('returns FAILED status when no tests pass', async () => {
      app = buildApp();
      mockRunTests.mockResolvedValueOnce({
        results: [
          { stdin: '1 2', expectedOutput: '3', actualOutput: '0', status: 'FAILED' },
          { stdin: '3 4', expectedOutput: '7', actualOutput: '0', status: 'FAILED' },
        ],
        passed: 0,
        total: 2,
      });
      mockCalculateScore.mockReturnValueOnce(0);

      await request(app)
        .post('/api/code/submit')
        .send({
          code: 'x',
          language: 'javascript',
          problemId: 1,
          attemptId: 1,
        });

      expect(mockCodingSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED' }),
      );
    });

    it('returns 422 when required fields are missing', async () => {
      app = buildApp();
      const res = await request(app)
        .post('/api/code/submit')
        .send({ code: 'x', language: 'javascript', problemId: 1 });

      expect(res.statusCode).toBe(422);
      expect(mockRunTests).not.toHaveBeenCalled();
    });

    it('returns 404 when question does not exist', async () => {
      app = buildApp();
      const res = await request(app)
        .post('/api/code/submit')
        .send({
          code: 'x',
          language: 'javascript',
          problemId: 999,
          attemptId: 1,
        });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when attempt does not exist', async () => {
      app = buildApp();
      const res = await request(app)
        .post('/api/code/submit')
        .send({
          code: 'x',
          language: 'javascript',
          problemId: 1,
          attemptId: 999,
        });

      expect(res.statusCode).toBe(404);
    });

    it('returns 403 when participant submits another attempt', async () => {
      mockActiveUser = { id: 1, role: 'PARTICIPANT', email: 'participant@test.com' };
      app = buildApp();
      const res = await request(app)
        .post('/api/code/submit')
        .send({
          code: 'x',
          language: 'javascript',
          problemId: 1,
          attemptId: 2,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/access denied/i);
    });

    it('allows non-participant roles to bypass ownership check', async () => {
      mockActiveUser = { id: 99, role: 'ADMIN', email: 'admin@test.com' };
      app = buildApp();
      mockRunTests.mockResolvedValueOnce({
        results: [{ stdin: '1 2', expectedOutput: '3', actualOutput: '3', status: 'OK' }],
        passed: 1,
        total: 1,
      });
      mockCalculateScore.mockReturnValueOnce(10);

      const res = await request(app)
        .post('/api/code/submit')
        .send({
          code: 'x',
          language: 'javascript',
          problemId: 2,
          attemptId: 2,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('sums final submissions from multiple questions', async () => {
      makeSubmission({ attemptId: 1, questionId: 2, isFinal: true, score: 8 });
      app = buildApp();
      mockRunTests.mockResolvedValueOnce({
        results: [{ stdin: '1 2', expectedOutput: '3', actualOutput: '3', status: 'OK' }],
        passed: 1,
        total: 1,
      });
      mockCalculateScore.mockReturnValueOnce(10);

      await request(app)
        .post('/api/code/submit')
        .send({
          code: 'x',
          language: 'javascript',
          problemId: 1,
          attemptId: 1,
        });

      expect(attempts[1].totalScore).toBe(18);
    });

    it('returns 500 when test runner throws', async () => {
      app = buildApp();
      mockRunTests.mockRejectedValueOnce(new Error('Execution service down'));

      const res = await request(app)
        .post('/api/code/submit')
        .send({
          code: 'x',
          language: 'javascript',
          problemId: 1,
          attemptId: 1,
        });

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toMatch(/execution service down/i);
    });
  });
});
