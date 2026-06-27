const express = require('express');
const {
  CodingAssessment,
  CodingAttempt,
  CodingSubmission,
  CodingQuestion,
  TestCase,
  Enrollment,
  User,
} = require('../models');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

function isSubmitted(status) {
  return status === 'SUBMITTED' || status === 'AUTO_SUBMITTED';
}

async function canViewAttempt(req, attempt) {
  const userId = req.user.id;
  const role = req.user.role;

  if (role === 'ADMIN') return true;
  if (attempt.participantId === userId) return true;
  if (role === 'TRAINER' && attempt.assessment && attempt.assessment.trainerId === userId) return true;
  return false;
}

function sanitizeParticipantAttempt(attempt) {
  const plain = attempt.get ? attempt.get({ plain: true }) : attempt;

  if (plain.assessment && Array.isArray(plain.assessment.questions)) {
    plain.assessment.questions = plain.assessment.questions.map((q) => ({
      ...q,
      testCases: Array.isArray(q.testCases)
        ? q.testCases.filter((tc) => tc.isHidden !== true)
        : q.testCases,
    }));
  }

  if (Array.isArray(plain.submissions)) {
    plain.submissions = plain.submissions.filter((s) => s.isFinal === true);
  }

  return plain;
}

// POST /api/coding-attempts/start
router.post('/start', async (req, res) => {
  try {
    const { assessmentId } = req.body;
    const participantId = req.user.id;

    if (!assessmentId) {
      return res.status(422).json({ error: 'assessmentId is required' });
    }

    const assessment = await CodingAssessment.findByPk(assessmentId);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (assessment.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'Assessment is not published' });
    }

    const enrollment = await Enrollment.findOne({
      where: {
        participantId,
        trainingId: assessment.trainingId,
        status: 'ENROLLED',
      },
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'You are not enrolled in this training' });
    }

    const existingAttempt = await CodingAttempt.findOne({
      where: { assessmentId, participantId },
    });

    if (existingAttempt) {
      if (isSubmitted(existingAttempt.status)) {
        return res.status(409).json({ error: 'Already submitted' });
      }
      return res.json({
        success: true,
        attemptId: existingAttempt.id,
        status: existingAttempt.status,
      });
    }

    const attempt = await CodingAttempt.create({
      assessmentId,
      participantId,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      attemptId: attempt.id,
      status: attempt.status,
    });
  } catch (error) {
    console.error('Error starting coding attempt:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/coding-attempts/:id
router.get('/:id', async (req, res) => {
  try {
    const attempt = await CodingAttempt.findByPk(req.params.id, {
      include: [
        {
          model: CodingAssessment,
          as: 'assessment',
          include: [
            {
              model: CodingQuestion,
              as: 'questions',
              include: [
                {
                  model: TestCase,
                  as: 'testCases',
                },
              ],
            },
          ],
        },
        {
          model: CodingSubmission,
          as: 'submissions',
        },
      ],
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const hasAccess = await canViewAttempt(req, attempt);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const isParticipantOwner = req.user.role === 'PARTICIPANT' && attempt.participantId === req.user.id;
    const responseAttempt = isParticipantOwner
      ? sanitizeParticipantAttempt(attempt)
      : attempt;

    return res.json({ attempt: responseAttempt });
  } catch (error) {
    console.error('Error fetching coding attempt:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/coding-attempts/:id/submit
router.post('/:id/submit', async (req, res) => {
  try {
    const attempt = await CodingAttempt.findByPk(req.params.id, {
      include: [
        {
          model: CodingAssessment,
          as: 'assessment',
        },
      ],
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.participantId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (isSubmitted(attempt.status)) {
      return res.status(409).json({ error: 'Already submitted' });
    }

    const totalScore = await CodingSubmission.sum('score', {
      where: { attemptId: attempt.id, isFinal: true },
    }) || 0;

    await attempt.update({
      status: 'SUBMITTED',
      submittedAt: new Date(),
      totalScore,
    });

    return res.json({ success: true, attempt });
  } catch (error) {
    console.error('Error submitting coding attempt:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
