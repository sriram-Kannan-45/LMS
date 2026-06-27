const express = require('express');
const { CodingSubmission, CodingQuestion, CodingAttempt, CodingAssessment, SubmissionResult, TestCase } = require('../models');
const authenticateToken = require('../middleware/auth');
const roleMiddleware = require('../middleware/roles');
const router = express.Router();
router.use(authenticateToken);

router.get('/:attemptId', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  try {
    const attempt = await CodingAttempt.findByPk(req.params.attemptId);
    if (!attempt) return res.status(404).json({ error: 'Not found' });
    const assessment = await CodingAssessment.findByPk(attempt.assessmentId);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (req.user.role !== 'ADMIN' && assessment.trainerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const submissions = await CodingSubmission.findAll({
      where: { attemptId: req.params.attemptId, isFinal: true },
      include: [
        { model: CodingQuestion, as: 'question' },
        {
          model: SubmissionResult,
          as: 'results',
          include: [{ model: TestCase, as: 'testCase' }],
        },
      ],
      order: [['submitted_at', 'DESC']],
    });
    res.json({ success: true, submissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
