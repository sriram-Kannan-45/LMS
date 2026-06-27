const express = require('express');
const {
  CodingQuestion,
  TestCase,
  CodingAttempt,
  CodingSubmission,
  CodingAssessment,
} = require('../models');
const authenticateToken = require('../middleware/auth');
const { runTests, calculateScore } = require('../services/codeExecutionService');

const router = express.Router();

router.use(authenticateToken);

async function getTestCases(problemId, testType) {
  const where = { questionId: problemId };
  if (testType === 'sample') where.isHidden = false;
  return TestCase.findAll({ where, order: [['order_index', 'ASC']] });
}

function mapTestCaseInput(testCases) {
  return testCases.map((tc) => ({
    stdin: tc.input || '',
    expectedOutput: tc.expectedOutput || '',
  }));
}

function deriveStatus(passed, total) {
  if (passed === total && total > 0) return 'PASSED';
  if (passed === 0) return 'FAILED';
  return 'PARTIAL';
}

function redactHiddenTestCases(results, testCases) {
  return results.map((r, idx) => {
    const tc = testCases[idx];
    if (tc && tc.isHidden) {
      return {
        isHidden: true,
        passed: r.status === 'OK',
        status: r.status,
        timeMs: r.timeMs,
      };
    }
    return r;
  });
}

async function canExecuteCode(req, question) {
  const role = req.user.role;
  if (role === 'ADMIN' || role === 'TRAINER') return true;

  const assessment = await CodingAssessment.findByPk(question.assessmentId);
  if (!assessment || assessment.status !== 'PUBLISHED') return false;

  const attempt = await CodingAttempt.findOne({
    where: {
      assessmentId: question.assessmentId,
      participantId: req.user.id,
      status: ['IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED'],
    },
  });

  return !!attempt;
}

// POST /api/code/run
router.post('/run', async (req, res) => {
  try {
    const { code, language, problemId } = req.body;

    if (!code || !language || !problemId) {
      return res.status(422).json({ error: 'code, language, and problemId are required' });
    }

    const question = await CodingQuestion.findByPk(problemId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const canRun = await canExecuteCode(req, question);
    if (!canRun) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const testCases = await getTestCases(problemId, 'sample');
    const timeout = (question.timeLimitSec || 5) * 1000;

    const { results, passed, total } = await runTests({
      code,
      language,
      testCases: mapTestCaseInput(testCases),
      timeout,
    });

    return res.json({ success: true, results, passed, total });
  } catch (error) {
    console.error('Error running code:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/code/submit
router.post('/submit', async (req, res) => {
  try {
    const { code, language, problemId, attemptId } = req.body;

    if (!code || !language || !problemId || !attemptId) {
      return res.status(422).json({ error: 'code, language, problemId, and attemptId are required' });
    }

    const question = await CodingQuestion.findByPk(problemId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const attempt = await CodingAttempt.findByPk(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (req.user.role === 'PARTICIPANT' && attempt.participantId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const allTestCases = await getTestCases(problemId, 'all');
    const hiddenTestCases = allTestCases.filter((tc) => tc.isHidden);
    const timeout = (question.timeLimitSec || 5) * 1000;

    const { results, passed, total } = await runTests({
      code,
      language,
      testCases: mapTestCaseInput(allTestCases),
      timeout,
    });

    const score = calculateScore({ passed, total, marks: question.marks || 0 });
    const status = deriveStatus(passed, total);

    await CodingSubmission.update(
      { isFinal: false },
      { where: { attemptId, questionId: problemId, isFinal: true } }
    );

    const submission = await CodingSubmission.create({
      attemptId,
      questionId: problemId,
      participantId: attempt.participantId,
      language,
      code,
      sourceCode: code,
      status,
      score,
      testsPassed: passed,
      testsTotal: total,
      passedCount: passed,
      totalCount: total,
      isFinal: true,
      submittedAt: new Date(),
    });

    const finalSubmissions = await CodingSubmission.findAll({
      where: { attemptId, isFinal: true },
    });
    const totalScore = finalSubmissions.reduce(
      (sum, sub) => sum + Number(sub.score || 0),
      0
    );
    await attempt.update({ totalScore });

    const hiddenPassed = results
      .filter((_, idx) => allTestCases[idx]?.isHidden)
      .filter((r) => r.status === 'OK').length;

    const safeResults = redactHiddenTestCases(results, allTestCases);

    return res.json({
      success: true,
      score,
      results: safeResults,
      hiddenTestsPassed: hiddenPassed,
      hiddenTestsTotal: hiddenTestCases.length,
      submissionId: submission.id,
    });
  } catch (error) {
    console.error('Error submitting code:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
