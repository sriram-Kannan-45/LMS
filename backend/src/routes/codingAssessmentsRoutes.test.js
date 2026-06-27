const request = require('supertest');
const express = require('express');

// Capture the user injected by the mock auth middleware so tests can drive it.
let mockActiveUser;

jest.mock('../middleware/auth', () => {
  return (req, res, next) => {
    req.user = mockActiveUser;
    next();
  };
});

jest.mock('../middleware/roles', () => {
  return () => (req, res, next) => next();
});

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
};

const mockSequelize = {
  transaction: jest.fn(() => Promise.resolve(mockTransaction)),
};

jest.mock('../config/db', () => ({
  sequelize: mockSequelize,
  connectDB: jest.fn(),
}));

const assessments = [];
const questions = [];
const testCases = [];
let nextAssessmentId = 1;
let nextQuestionId = 1;
let nextTestCaseId = 1;

function resetStore() {
  assessments.length = 0;
  questions.length = 0;
  testCases.length = 0;
  participants.length = 0;
  attempts.length = 0;
  submissions.length = 0;
  nextAssessmentId = 1;
  nextQuestionId = 1;
  nextTestCaseId = 1;
  nextAttemptId = 1;
  nextSubmissionId = 1;
}

function makeAssessment(data) {
  const id = nextAssessmentId++;
  const assessment = {
    id,
    ...data,
    status: data.status || 'DRAFT',
    save: jest.fn(function () {
      Object.assign(this, data);
      return Promise.resolve(this);
    }),
    update: jest.fn(function (updates) {
      Object.assign(this, updates);
      return Promise.resolve(this);
    }),
    destroy: jest.fn(function () {
      const idx = assessments.findIndex((a) => a.id === this.id);
      if (idx !== -1) assessments.splice(idx, 1);
      return Promise.resolve();
    }),
    getDataValue: jest.fn(function (key) {
      return this[key];
    }),
  };
  assessments.push(assessment);
  return assessment;
}

const mockTraining = {
  findByPk: jest.fn((id) => {
    if (id === 1 || id === 2) return Promise.resolve({ id, title: 'Training ' + id });
    return Promise.resolve(null);
  }),
};

let participants = [];
const mockUser = {
  findByPk: jest.fn((id) => Promise.resolve({ id, name: 'User ' + id, email: 'user' + id + '@test.com' })),
  findAll: jest.fn(({ where }) => {
    let list = participants;
    if (where && where.id !== undefined) {
      const ids = Array.isArray(where.id) ? where.id : [where.id];
      list = participants.filter((p) => ids.includes(p.id));
    }
    return Promise.resolve(list);
  }),
};

const mockCodingAssessment = {
  create: jest.fn((data, opts) => {
    const a = makeAssessment({ ...data });
    return Promise.resolve(a);
  }),
  findByPk: jest.fn((id, opts) => {
    const a = assessments.find((a) => a.id === Number(id)) || null;
    if (!a) return Promise.resolve(null);
    // Attach child collections for nested includes.
    a.questions = questions
      .filter((q) => q.assessmentId === a.id)
      .sort((x, y) => x.orderIndex - y.orderIndex)
      .map((q) => ({
        ...q,
        testCases: testCases
          .filter((t) => t.questionId === q.id)
          .sort((x, y) => x.orderIndex - y.orderIndex),
      }));
    a.training = { id: a.trainingId, title: 'Training ' + a.trainingId };
    a.trainer = { id: a.trainerId, name: 'Trainer', email: 'trainer@test.com' };
    return Promise.resolve(a);
  }),
  findAll: jest.fn(({ where, include, order }) => {
    let list = assessments;
    if (where && where.trainerId !== undefined) {
      list = assessments.filter((a) => a.trainerId === where.trainerId);
    }
    return Promise.resolve(
      list.map((a) => ({
        ...a,
        training: { id: a.trainingId, title: 'Training ' + a.trainingId },
        trainer: { id: a.trainerId, name: 'Trainer', email: 'trainer@test.com' },
      })),
    );
  }),
};

const mockCodingQuestion = {
  count: jest.fn(({ where }) => {
    return Promise.resolve(questions.filter((q) => q.assessmentId === where.assessmentId).length);
  }),
  create: jest.fn((data, opts) => {
    const q = { id: nextQuestionId++, ...data };
    questions.push(q);
    return Promise.resolve(q);
  }),
  findAll: jest.fn(({ where, transaction }) => {
    return Promise.resolve(questions.filter((q) => q.assessmentId === where.assessmentId));
  }),
  destroy: jest.fn(({ where }) => {
    if (where.assessmentId !== undefined) {
      const toRemove = questions.filter((q) => q.assessmentId === where.assessmentId);
      toRemove.forEach((q) => {
        const idx = testCases.findIndex((t) => t.questionId === q.id);
        if (idx !== -1) testCases.splice(idx, 1);
      });
      for (let i = questions.length - 1; i >= 0; i -= 1) {
        if (questions[i].assessmentId === where.assessmentId) questions.splice(i, 1);
      }
    }
    if (where.id !== undefined) {
      for (let i = questions.length - 1; i >= 0; i -= 1) {
        if (questions[i].id === where.id) questions.splice(i, 1);
      }
    }
    return Promise.resolve(0);
  }),
};

const mockTestCase = {
  create: jest.fn((data, opts) => {
    const t = { id: nextTestCaseId++, ...data };
    testCases.push(t);
    return Promise.resolve(t);
  }),
  destroy: jest.fn(({ where }) => {
    if (where.questionId !== undefined && Array.isArray(where.questionId)) {
      for (let i = testCases.length - 1; i >= 0; i -= 1) {
        if (where.questionId.includes(testCases[i].questionId)) testCases.splice(i, 1);
      }
    }
    return Promise.resolve(0);
  }),
};

let attempts = [];
let submissions = [];
let nextAttemptId = 1;
let nextSubmissionId = 1;

const mockCodingAttempt = {
  findAll: jest.fn(({ where, include, order }) => {
    let list = attempts.filter((a) => a.assessmentId === where.assessmentId);
    list = list.map((a) => ({
      ...a,
      participant: participants.find((p) => p.id === a.participantId) || null,
      submissions: submissions.filter((s) => s.attemptId === a.id && s.isFinal),
    }));
    if (Array.isArray(order) && order[0][0] === 'totalScore' && order[0][1] === 'DESC') {
      list.sort((x, y) => (y.totalScore || 0) - (x.totalScore || 0));
    }
    return Promise.resolve(list);
  }),
};

const mockCodingSubmission = {
  findAll: jest.fn(({ where }) => {
    let list = submissions;
    if (where && where.attemptId !== undefined) {
      const ids = Array.isArray(where.attemptId) ? where.attemptId : [where.attemptId];
      list = submissions.filter((s) => ids.includes(s.attemptId));
    }
    if (where && where.isFinal !== undefined) {
      list = list.filter((s) => s.isFinal === where.isFinal);
    }
    return Promise.resolve(list);
  }),
};

jest.mock('../models', () => ({
  CodingAssessment: mockCodingAssessment,
  CodingAttempt: mockCodingAttempt,
  CodingQuestion: mockCodingQuestion,
  CodingSubmission: mockCodingSubmission,
  TestCase: mockTestCase,
  Training: mockTraining,
  User: mockUser,
}));

const codingAssessmentsRoutes = require('./codingAssessmentsRoutes');

describe('Coding Assessments Routes', () => {
  let app;

  function buildApp() {
    const a = express();
    a.use(express.json());
    a.use('/api/coding-assessments', codingAssessmentsRoutes);
    return a;
  }

  beforeEach(() => {
    resetStore();
    mockActiveUser = { id: 1, role: 'TRAINER', email: 'trainer@test.com' };
    jest.clearAllMocks();
  });

  const sampleProblem = {
    title: 'Sum of Array',
    statement: 'Write a function that returns the sum.',
    inputFormat: 'An array of integers',
    outputFormat: 'Integer sum',
    constraints: '1 <= n <= 1000',
    starterCode: 'function sum(arr) {\n  // your code\n}',
    explanation: 'Use reduce or a loop.',
    difficulty: 'easy',
    marks: 10,
    testCases: [{ input: '[1,2,3]', expectedOutput: '6', isHidden: false }],
  };

  describe('POST /api/coding-assessments', () => {
    it('creates an assessment with nested problems and test cases', async () => {
      app = buildApp();
      const res = await request(app)
        .post('/api/coding-assessments')
        .send({
          trainingId: 1,
          title: 'JS Arrays',
          description: 'Test arrays',
          durationMinutes: 60,
          passingScore: 70,
          difficulty: 'medium',
          language: 'javascript',
          isProctored: true,
          maxViolations: 3,
          problems: [sampleProblem],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.assessment.title).toBe('JS Arrays');
      expect(res.body.assessment.questions).toHaveLength(1);
      expect(res.body.assessment.questions[0].testCases).toHaveLength(1);
      expect(res.body.assessment.questions[0].testCases[0].expectedOutput).toBe('6');
    });

    it('rejects missing title', async () => {
      app = buildApp();
      const res = await request(app)
        .post('/api/coding-assessments')
        .send({ trainingId: 1, problems: [sampleProblem] });
      expect(res.statusCode).toBe(422);
      expect(res.body.error).toMatch(/title/);
    });

    it('rejects missing trainingId', async () => {
      app = buildApp();
      const res = await request(app)
        .post('/api/coding-assessments')
        .send({ title: 'No Training', problems: [sampleProblem] });
      expect(res.statusCode).toBe(422);
      expect(res.body.error).toMatch(/trainingId/);
    });

    it('rejects empty problems', async () => {
      app = buildApp();
      const res = await request(app)
        .post('/api/coding-assessments')
        .send({ trainingId: 1, title: 'Empty', problems: [] });
      expect(res.statusCode).toBe(422);
      expect(res.body.error).toMatch(/problems/);
    });

    it('returns 404 for non-existent training', async () => {
      app = buildApp();
      const res = await request(app)
        .post('/api/coding-assessments')
        .send({ trainingId: 999, title: 'Bad Training', problems: [sampleProblem] });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/coding-assessments', () => {
    it('lists only own assessments for a trainer', async () => {
      makeAssessment({ trainerId: 1, trainingId: 1, title: 'A1', durationMinutes: 60 });
      makeAssessment({ trainerId: 2, trainingId: 1, title: 'A2', durationMinutes: 60 });
      app = buildApp();
      const res = await request(app).get('/api/coding-assessments');
      expect(res.statusCode).toBe(200);
      expect(res.body.assessments).toHaveLength(1);
      expect(res.body.assessments[0].title).toBe('A1');
    });

    it('lists all assessments for an admin', async () => {
      makeAssessment({ trainerId: 1, trainingId: 1, title: 'A1', durationMinutes: 60 });
      makeAssessment({ trainerId: 2, trainingId: 1, title: 'A2', durationMinutes: 60 });
      mockActiveUser = { id: 1, role: 'ADMIN' };
      app = buildApp();
      const res = await request(app).get('/api/coding-assessments');
      expect(res.statusCode).toBe(200);
      expect(res.body.assessments).toHaveLength(2);
    });
  });

  describe('GET /api/coding-assessments/:id', () => {
    it('returns assessment with nested questions and test cases', async () => {
      const a = makeAssessment({ trainerId: 1, trainingId: 1, title: 'A1', durationMinutes: 60 });
      questions.push({ id: nextQuestionId++, assessmentId: a.id, orderIndex: 0, title: 'Q1' });
      testCases.push({ id: nextTestCaseId++, questionId: questions[questions.length - 1].id, orderIndex: 0, expectedOutput: '6' });
      app = buildApp();
      const res = await request(app).get(`/api/coding-assessments/${a.id}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.assessment.questions).toHaveLength(1);
      expect(res.body.assessment.questions[0].testCases).toHaveLength(1);
    });

    it('returns 404 for missing assessment', async () => {
      app = buildApp();
      const res = await request(app).get('/api/coding-assessments/999');
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 when trainer accesses another trainer assessment', async () => {
      const a = makeAssessment({ trainerId: 2, trainingId: 1, title: 'Other', durationMinutes: 60 });
      app = buildApp();
      const res = await request(app).get(`/api/coding-assessments/${a.id}`);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('Unauthorized');
    });
  });

  describe('PUT /api/coding-assessments/:id', () => {
    it('updates a DRAFT assessment and recreates questions', async () => {
      const a = makeAssessment({ trainerId: 1, trainingId: 1, title: 'Old', status: 'DRAFT', durationMinutes: 60 });
      questions.push({ id: nextQuestionId++, assessmentId: a.id, orderIndex: 0, title: 'Old Q' });
      app = buildApp();
      const res = await request(app)
        .put(`/api/coding-assessments/${a.id}`)
        .send({
          title: 'Updated',
          problems: [sampleProblem],
        });
      expect(res.statusCode).toBe(200);
      expect(res.body.assessment.title).toBe('Updated');
      expect(res.body.assessment.questions[0].title).toBe('Sum of Array');
      expect(questions.filter((q) => q.assessmentId === a.id)).toHaveLength(1);
    });

    it('rejects update of non-DRAFT assessment', async () => {
      const a = makeAssessment({ trainerId: 1, trainingId: 1, title: 'Published', status: 'PUBLISHED', durationMinutes: 60 });
      app = buildApp();
      const res = await request(app)
        .put(`/api/coding-assessments/${a.id}`)
        .send({ title: 'New Title' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/DRAFT/);
    });

    it('rejects empty problems array', async () => {
      const a = makeAssessment({ trainerId: 1, trainingId: 1, title: 'Draft', status: 'DRAFT', durationMinutes: 60 });
      app = buildApp();
      const res = await request(app)
        .put(`/api/coding-assessments/${a.id}`)
        .send({ problems: [] });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('DELETE /api/coding-assessments/:id', () => {
    it('deletes assessment and its children', async () => {
      const a = makeAssessment({ trainerId: 1, trainingId: 1, title: 'To Delete', durationMinutes: 60 });
      const q = { id: nextQuestionId++, assessmentId: a.id, orderIndex: 0, title: 'Q' };
      questions.push(q);
      testCases.push({ id: nextTestCaseId++, questionId: q.id, orderIndex: 0, expectedOutput: 'x' });
      app = buildApp();
      const res = await request(app).delete(`/api/coding-assessments/${a.id}`);
      expect(res.statusCode).toBe(200);
      expect(assessments).toHaveLength(0);
    });

    it('returns 403 for other trainer assessment', async () => {
      const a = makeAssessment({ trainerId: 2, trainingId: 1, title: 'Other', durationMinutes: 60 });
      app = buildApp();
      const res = await request(app).delete(`/api/coding-assessments/${a.id}`);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/coding-assessments/:id/publish', () => {
    it('publishes a DRAFT assessment with questions', async () => {
      const a = makeAssessment({ trainerId: 1, trainingId: 1, title: 'Draft', status: 'DRAFT', durationMinutes: 60 });
      questions.push({ id: nextQuestionId++, assessmentId: a.id, orderIndex: 0, title: 'Q' });
      app = buildApp();
      const res = await request(app).post(`/api/coding-assessments/${a.id}/publish`);
      expect(res.statusCode).toBe(200);
      expect(res.body.assessment.status).toBe('PUBLISHED');
    });

    it('rejects publishing without questions', async () => {
      const a = makeAssessment({ trainerId: 1, trainingId: 1, title: 'Empty', status: 'DRAFT', durationMinutes: 60 });
      app = buildApp();
      const res = await request(app).post(`/api/coding-assessments/${a.id}/publish`);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/no problems/);
    });

    it('rejects publishing non-DRAFT assessment', async () => {
      const a = makeAssessment({ trainerId: 1, trainingId: 1, title: 'Closed', status: 'CLOSED', durationMinutes: 60 });
      app = buildApp();
      const res = await request(app).post(`/api/coding-assessments/${a.id}/publish`);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/coding-assessments/:id/close', () => {
    it('closes a PUBLISHED assessment', async () => {
      const a = makeAssessment({ trainerId: 1, trainingId: 1, title: 'Pub', status: 'PUBLISHED', durationMinutes: 60 });
      app = buildApp();
      const res = await request(app).post(`/api/coding-assessments/${a.id}/close`);
      expect(res.statusCode).toBe(200);
      expect(res.body.assessment.status).toBe('CLOSED');
    });

    it('rejects closing non-PUBLISHED assessment', async () => {
      const a = makeAssessment({ trainerId: 1, trainingId: 1, title: 'Draft', status: 'DRAFT', durationMinutes: 60 });
      app = buildApp();
      const res = await request(app).post(`/api/coding-assessments/${a.id}/close`);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/coding-assessments/:id/results', () => {
    it('returns attempts ordered by total score with participants and final submissions', async () => {
      const a = makeAssessment({ trainerId: 1, trainingId: 1, title: 'Result Assessment', durationMinutes: 60 });
      participants.push({ id: 10, name: 'Alice', email: 'alice@test.com' });
      participants.push({ id: 11, name: 'Bob', email: 'bob@test.com' });
      attempts.push({ id: nextAttemptId++, assessmentId: a.id, participantId: 10, totalScore: 80 });
      attempts.push({ id: nextAttemptId++, assessmentId: a.id, participantId: 11, totalScore: 95 });
      submissions.push({ id: nextSubmissionId++, attemptId: attempts[0].id, isFinal: true, score: 80 });
      submissions.push({ id: nextSubmissionId++, attemptId: attempts[1].id, isFinal: true, score: 95 });
      submissions.push({ id: nextSubmissionId++, attemptId: attempts[0].id, isFinal: false, score: 50 });
      app = buildApp();
      const res = await request(app).get(`/api/coding-assessments/${a.id}/results`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.assessment.id).toBe(a.id);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0].totalScore).toBe(95);
      expect(res.body.results[0].participant.email).toBe('bob@test.com');
      expect(res.body.results[0].submissions).toHaveLength(1);
      expect(res.body.results[0].submissions[0].isFinal).toBe(true);
      expect(res.body.results[1].totalScore).toBe(80);
    });

    it('returns 404 for missing assessment', async () => {
      app = buildApp();
      const res = await request(app).get('/api/coding-assessments/999/results');
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 when trainer accesses another trainer assessment', async () => {
      const a = makeAssessment({ trainerId: 2, trainingId: 1, title: 'Other', durationMinutes: 60 });
      app = buildApp();
      const res = await request(app).get(`/api/coding-assessments/${a.id}/results`);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('Unauthorized');
    });
  });

  describe('POST /api/coding-assessments/:id/publish-result', () => {
    it('publishes the assessment result status', async () => {
      const a = makeAssessment({ trainerId: 1, trainingId: 1, title: 'Result Pub', durationMinutes: 60 });
      app = buildApp();
      const res = await request(app).post(`/api/coding-assessments/${a.id}/publish-result`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(a.resultStatus).toBe('PUBLISHED');
    });

    it('returns 404 for missing assessment', async () => {
      app = buildApp();
      const res = await request(app).post('/api/coding-assessments/999/publish-result');
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 when trainer accesses another trainer assessment', async () => {
      const a = makeAssessment({ trainerId: 2, trainingId: 1, title: 'Other', durationMinutes: 60 });
      app = buildApp();
      const res = await request(app).post(`/api/coding-assessments/${a.id}/publish-result`);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('Unauthorized');
    });
  });
});
