const express = require('express');
const {
  CodingAssessment, CodingQuestion, TestCase, CodingAttempt,
  CodingSubmission, SubmissionResult, CodingViolation, PlagiarismReport, User,
} = require('../models');
const authenticateToken = require('../middleware/auth');
const roleMiddleware = require('../middleware/roles');
const codingAI = require('../services/codingAIService');
const { runTestCases } = require('../services/codeExecutionService');
const { compareCode } = require('../services/plagiarismService');

const router = express.Router();
router.use(authenticateToken);

const TRAINER = roleMiddleware('TRAINER');
const PARTICIPANT = roleMiddleware('PARTICIPANT');

// Load an assessment owned by the requesting trainer, else null (sends response).
async function ownedAssessment(req, res) {
  const a = await CodingAssessment.findByPk(req.params.id);
  if (!a) { res.status(404).json({ error: 'Assessment not found' }); return null; }
  if (String(a.trainerId) !== String(req.user.id)) { res.status(403).json({ error: 'Not your assessment' }); return null; }
  return a;
}

// Load an attempt owned by the requesting participant, else null (sends response).
async function ownedAttempt(req, res, attemptId) {
  const at = await CodingAttempt.findByPk(attemptId);
  if (!at) { res.status(404).json({ error: 'Attempt not found' }); return null; }
  if (String(at.participantId) !== String(req.user.id)) { res.status(403).json({ error: 'Not your attempt' }); return null; }
  return at;
}

// ──────────────── TRAINER ────────────────
router.post('/assessments', TRAINER, async (req, res) => {
  try {
    const { title, description, courseId, lessonId, timeLimit } = req.body;
    if (!title) return res.status(422).json({ error: 'title is required' });
    const a = await CodingAssessment.create({
      title, description, courseId: courseId || null, lessonId: lessonId || null,
      timeLimit: timeLimit || 60, trainerId: req.user.id,
    });
    res.status(201).json({ assessment: a });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

router.get('/assessments', TRAINER, async (req, res) => {
  try {
    const list = await CodingAssessment.findAll({ where: { trainerId: req.user.id }, order: [['created_at', 'DESC']] });
    res.json({ assessments: list });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/assessments/:id', TRAINER, async (req, res) => {
  try {
    const a = await ownedAssessment(req, res); if (!a) return;
    const questions = await CodingQuestion.findAll({
      where: { assessmentId: a.id }, order: [['order', 'ASC']],
      include: [{ model: TestCase, as: 'testCases' }],
    });
    res.json({ assessment: a, questions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/assessments/:id', TRAINER, async (req, res) => {
  try {
    const a = await ownedAssessment(req, res); if (!a) return;
    const { title, description, timeLimit, status, resultStatus } = req.body;
    await a.update({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(timeLimit !== undefined && { timeLimit }),
      ...(status && ['DRAFT', 'PUBLISHED', 'CLOSED'].includes(status) && { status }),
      ...(resultStatus && ['HIDDEN', 'PUBLISHED'].includes(resultStatus) && { resultStatus }),
    });
    res.json({ assessment: a });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Add a question manually (+ its test cases)
router.post('/assessments/:id/questions', TRAINER, async (req, res) => {
  try {
    const a = await ownedAssessment(req, res); if (!a) return;
    const q = req.body || {};
    if (!q.title || !q.problemDescription) return res.status(422).json({ error: 'title and problemDescription required' });
    const count = await CodingQuestion.count({ where: { assessmentId: a.id } });
    const question = await CodingQuestion.create({
      assessmentId: a.id, title: q.title, problemDescription: q.problemDescription,
      inputFormat: q.inputFormat, outputFormat: q.outputFormat, constraints: q.constraints,
      sampleInput: q.sampleInput, sampleOutput: q.sampleOutput, explanation: q.explanation,
      difficulty: q.difficulty || 'medium', marks: q.marks || 10, tags: q.tags || [], order: count,
    });
    const tcs = Array.isArray(q.testCases) ? q.testCases : [];
    const testCases = await TestCase.bulkCreate(tcs.map(t => ({
      questionId: question.id, input: t.input, expectedOutput: t.expectedOutput ?? t.expected_output, isHidden: !!(t.isHidden ?? t.is_hidden),
    })));
    res.status(201).json({ question, testCases });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// MODULE A — AI question generator
router.post('/assessments/:id/generate-question', TRAINER, async (req, res) => {
  try {
    const a = await ownedAssessment(req, res); if (!a) return;
    const { topic, difficulty, language } = req.body;
    if (!topic) return res.status(422).json({ error: 'topic is required' });
    const gen = await codingAI.generateQuestion({ topic, difficulty: difficulty || 'medium', language });
    const count = await CodingQuestion.count({ where: { assessmentId: a.id } });
    const question = await CodingQuestion.create({
      assessmentId: a.id, title: gen.title, problemDescription: gen.problem_description,
      inputFormat: gen.input_format, outputFormat: gen.output_format, constraints: gen.constraints,
      sampleInput: gen.sample_input, sampleOutput: gen.sample_output, explanation: gen.explanation,
      difficulty: ['easy', 'medium', 'hard'].includes(gen.difficulty) ? gen.difficulty : 'medium',
      marks: gen.marks || 10, tags: gen.tags || [], order: count,
    });
    const testCases = await TestCase.bulkCreate((gen.test_cases || []).map(t => ({
      questionId: question.id, input: t.input, expectedOutput: t.expected_output, isHidden: !!t.is_hidden,
    })));
    res.status(201).json({ question, testCases });
  } catch (e) {
    console.error('[generate-question]', e.message);
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// MODULE C — plagiarism check
router.post('/assessments/:id/plagiarism-check', TRAINER, async (req, res) => {
  try {
    const a = await ownedAssessment(req, res); if (!a) return;
    const questions = await CodingQuestion.findAll({ where: { assessmentId: a.id }, attributes: ['id'] });
    const subs = await CodingSubmission.findAll({
      where: { questionId: questions.map(q => q.id), isFinal: true },
      order: [['created_at', 'DESC']],
    });
    // latest final submission per (questionId, participantId)
    const latest = new Map();
    for (const s of subs) {
      const k = `${s.questionId}:${s.participantId}`;
      if (!latest.has(k)) latest.set(k, s);
    }
    const byQuestion = new Map();
    for (const s of latest.values()) {
      if (!byQuestion.has(s.questionId)) byQuestion.set(s.questionId, []);
      byQuestion.get(s.questionId).push(s);
    }
    await PlagiarismReport.destroy({ where: { assessmentId: a.id } });
    const rows = [];
    let high = 0, medium = 0;
    for (const [questionId, group] of byQuestion) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const { score, flag } = compareCode(group[i].sourceCode, group[j].sourceCode);
          if (flag === 'HIGH') high++; else if (flag === 'MEDIUM') medium++;
          rows.push({
            assessmentId: a.id, questionId,
            participantAId: group[i].participantId, participantBId: group[j].participantId,
            submissionAId: group[i].id, submissionBId: group[j].id,
            similarityScore: score, flagLevel: flag, comparedAt: new Date(),
          });
        }
      }
    }
    if (rows.length) await PlagiarismReport.bulkCreate(rows);
    res.json({ summary: { total_pairs: rows.length, high_count: high, medium_count: medium } });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

router.get('/assessments/:id/plagiarism-reports', TRAINER, async (req, res) => {
  try {
    const a = await ownedAssessment(req, res); if (!a) return;
    const reports = await PlagiarismReport.findAll({
      where: { assessmentId: a.id },
      include: [
        { model: User, as: 'participantA', attributes: ['id', 'name'] },
        { model: User, as: 'participantB', attributes: ['id', 'name'] },
        { model: CodingQuestion, as: 'question', attributes: ['id', 'title'] },
      ],
      order: [['similarity_score', 'DESC']],
    });
    res.json({ reports });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trainer results overview
router.get('/assessments/:id/results', TRAINER, async (req, res) => {
  try {
    const a = await ownedAssessment(req, res); if (!a) return;
    const attempts = await CodingAttempt.findAll({
      where: { assessmentId: a.id },
      include: [{ model: User, as: 'participant', attributes: ['id', 'name'] }],
      order: [['score', 'DESC']],
    });
    res.json({ attempts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────── PARTICIPANT ────────────────
// List published assessments available to the participant
router.get('/participant/assessments', PARTICIPANT, async (req, res) => {
  try {
    const list = await CodingAssessment.findAll({
      where: { status: 'PUBLISHED' },
      attributes: ['id', 'title', 'description', 'timeLimit'],
      order: [['created_at', 'DESC']],
    });
    res.json({ assessments: list });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Fetch assessment to take — only visible test cases exposed
router.get('/participant/assessments/:id', PARTICIPANT, async (req, res) => {
  try {
    const a = await CodingAssessment.findByPk(req.params.id);
    if (!a || a.status !== 'PUBLISHED') return res.status(404).json({ error: 'Assessment not available' });
    const questions = await CodingQuestion.findAll({
      where: { assessmentId: a.id }, order: [['order', 'ASC']],
      include: [{ model: TestCase, as: 'testCases', where: { isHidden: false }, required: false }],
    });
    res.json({ assessment: a, questions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Start (or resume) an attempt
router.post('/participant/assessments/:id/start', PARTICIPANT, async (req, res) => {
  try {
    const a = await CodingAssessment.findByPk(req.params.id);
    if (!a || a.status !== 'PUBLISHED') return res.status(404).json({ error: 'Assessment not available' });
    let attempt = await CodingAttempt.findOne({ where: { assessmentId: a.id, participantId: req.user.id, status: 'IN_PROGRESS' } });
    if (!attempt) attempt = await CodingAttempt.create({ assessmentId: a.id, participantId: req.user.id });
    res.json({ attempt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Helper: run a solution for a question against given test cases
async function executeForQuestion(question, language, sourceCode, onlyVisible) {
  const where = { questionId: question.id };
  if (onlyVisible) where.isHidden = false;
  const testCases = await TestCase.findAll({ where, order: [['id', 'ASC']] });
  return runTestCases({ language, sourceCode, testCases });
}

// /run — visible test cases only, not persisted as final
router.post('/participant/attempts/:attemptId/run', PARTICIPANT, async (req, res) => {
  try {
    const attempt = await ownedAttempt(req, res, req.params.attemptId); if (!attempt) return;
    const { questionId, language, sourceCode } = req.body;
    const question = await CodingQuestion.findByPk(questionId);
    if (!question || String(question.assessmentId) !== String(attempt.assessmentId)) return res.status(404).json({ error: 'Question not found' });
    const { results, passedCount, totalCount } = await executeForQuestion(question, language, sourceCode, true);
    res.json({ results, passedCount, totalCount });
  } catch (e) { console.error('[run]', e.message); res.status(500).json({ error: 'Execution failed: ' + e.message }); }
});

// /submit — all test cases, persists submission + results, updates score
router.post('/participant/attempts/:attemptId/submit', PARTICIPANT, async (req, res) => {
  try {
    const attempt = await ownedAttempt(req, res, req.params.attemptId); if (!attempt) return;
    const { questionId, language, sourceCode } = req.body;
    const question = await CodingQuestion.findByPk(questionId);
    if (!question || String(question.assessmentId) !== String(attempt.assessmentId)) return res.status(404).json({ error: 'Question not found' });

    const { results, passedCount, totalCount } = await executeForQuestion(question, language, sourceCode, false);
    const score = totalCount ? (question.marks * passedCount) / totalCount : 0;
    const status = passedCount === totalCount && totalCount > 0 ? 'PASSED' : (passedCount > 0 ? 'PARTIAL' : 'FAILED');

    const submission = await CodingSubmission.create({
      attemptId: attempt.id, questionId: question.id, participantId: req.user.id,
      language, sourceCode, status, score, passedCount, totalCount, isFinal: true,
    });
    await SubmissionResult.bulkCreate(results.map(r => ({
      submissionId: submission.id, testCaseId: r.testCaseId, status: r.status === 'PASSED' ? 'PASSED' : (['TLE', 'CE', 'RE', 'MLE'].includes(r.status) ? r.status : 'FAILED'),
      runtimeMs: r.runtimeMs, memoryKb: r.memoryKb,
      actualOutput: r.isHidden ? null : r.actualOutput, errorMessage: r.errorMessage, isHidden: r.isHidden,
    })));

    // recompute attempt score = sum of latest final submission score per question
    const allFinal = await CodingSubmission.findAll({
      where: { attemptId: attempt.id, isFinal: true }, order: [['created_at', 'DESC']],
    });
    const best = new Map();
    for (const s of allFinal) if (!best.has(String(s.questionId))) best.set(String(s.questionId), s.score);
    const total = [...best.values()].reduce((a, b) => a + b, 0);
    await attempt.update({ score: total });

    // mask hidden outputs in the response
    const safeResults = results.map(r => r.isHidden
      ? { testCaseId: r.testCaseId, isHidden: true, status: r.status }
      : r);
    res.json({ submission: { id: submission.id, status, score, passedCount, totalCount }, results: safeResults });
  } catch (e) { console.error('[submit]', e.message); res.status(500).json({ error: 'Submission failed: ' + e.message }); }
});

// MODULE B — AI code review (cached on the submission)
router.post('/participant/submissions/:submissionId/review', PARTICIPANT, async (req, res) => {
  try {
    const submission = await CodingSubmission.findByPk(req.params.submissionId, {
      include: [{ model: CodingQuestion, as: 'question', attributes: ['id', 'title'] }],
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (String(submission.participantId) !== String(req.user.id)) return res.status(403).json({ error: 'Not your submission' });
    if (submission.aiReview) return res.json({ review: submission.aiReview });

    const review = await codingAI.reviewCode({
      title: submission.question?.title || 'Problem', language: submission.language,
      code: submission.sourceCode, passed: submission.passedCount, total: submission.totalCount,
    });
    await submission.update({ aiReview: review });
    res.json({ review });
  } catch (e) {
    console.error('[review]', e.message);
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// MODULE D1 — violation logging
router.post('/participant/attempts/:attemptId/violation', PARTICIPANT, async (req, res) => {
  try {
    const attempt = await ownedAttempt(req, res, req.params.attemptId); if (!attempt) return;
    const { type, details } = req.body;
    const allowed = ['SCREEN_SHARE_STOP', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'COPY_PASTE', 'OTHER'];
    await CodingViolation.create({
      attemptId: attempt.id, participantId: req.user.id,
      type: allowed.includes(type) ? type : 'OTHER', details: details || null,
    });
    await attempt.increment('violationCount');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
