const express = require('express');
const { sequelize } = require('../config/db');
const {
  CodingAssessment,
  CodingAttempt,
  CodingQuestion,
  CodingSubmission,
  TestCase,
  Training,
  User,
  Enrollment,
} = require('../models');
const authenticateToken = require('../middleware/auth');
const roleMiddleware = require('../middleware/roles');

const router = express.Router();

// All endpoints require authentication and TRAINER/ADMIN role.
router.use(authenticateToken);

// GET /api/coding-assessments/:id/participant
// Participant-safe read endpoint: visible test cases only, published + enrolled.
router.get('/:id/participant', async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const userId = req.user.id;

    const assessment = await CodingAssessment.findByPk(assessmentId, {
      attributes: [
        'id',
        'title',
        'description',
        'durationMinutes',
        'passingScore',
        'difficulty',
        'language',
        'isProctored',
        'maxViolations',
        'status',
        'trainingId',
      ],
      include: [
        {
          model: CodingQuestion,
          as: 'questions',
          order: [['order_index', 'ASC']],
          include: [
            {
              model: TestCase,
              as: 'testCases',
              where: { isHidden: false },
              required: false,
              order: [['order_index', 'ASC']],
            },
          ],
        },
      ],
    });

    if (!assessment || assessment.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const enrollment = await Enrollment.findOne({
      where: {
        participantId: userId,
        trainingId: assessment.trainingId,
        status: 'ENROLLED',
      },
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'You are not enrolled in this training' });
    }

    return res.json({ assessment });
  } catch (error) {
    console.error('Error fetching participant coding assessment:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.use(roleMiddleware('TRAINER', 'ADMIN'));

async function verifyTrainerAccess(req, res, assessment) {
  const trainerId = req.user.id;
  const role = req.user.role;
  if (role === 'ADMIN') return true;
  if (assessment.trainerId === trainerId) return true;
  res.status(403).json({ error: 'Unauthorized' });
  return false;
}

function pickAssessmentFields(body) {
  return {
    trainingId: body.trainingId,
    title: body.title,
    description: body.description,
    durationMinutes: body.durationMinutes,
    passingScore: body.passingScore,
    difficulty: body.difficulty,
    language: body.language,
    isProctored: body.isProctored,
    maxViolations: body.maxViolations,
  };
}

function normalizeQuestionPayload(p, index) {
  const statement = p.statement || p.problemDescription || '';
  return {
    title: p.title,
    problemDescription: statement,
    statement,
    inputFormat: p.inputFormat,
    outputFormat: p.outputFormat,
    constraints: p.constraints,
    starterCode: p.starterCode,
    explanation: p.explanation,
    difficulty: p.difficulty,
    marks: p.marks,
    sampleInput: p.sampleInput,
    sampleOutput: p.sampleOutput,
    tags: Array.isArray(p.tags) ? p.tags : [],
    orderIndex: index,
  };
}

function normalizeTestCasePayload(t, qIndex, tcIndex) {
  return {
    input: t.input,
    expectedOutput: t.expectedOutput,
    isHidden: !!t.isHidden,
    orderIndex: tcIndex,
  };
}

async function createQuestionsAndTestCases(assessmentId, problems, transaction) {
  const createdQuestions = [];
  for (let qIndex = 0; qIndex < problems.length; qIndex += 1) {
    const p = problems[qIndex];
    const question = await CodingQuestion.create(
      {
        assessmentId,
        ...normalizeQuestionPayload(p, qIndex),
      },
      { transaction },
    );

    const testCases = Array.isArray(p.testCases) ? p.testCases : [];
    const createdTestCases = [];
    for (let tcIndex = 0; tcIndex < testCases.length; tcIndex += 1) {
      const t = testCases[tcIndex];
      const tc = await TestCase.create(
        {
          questionId: question.id,
          ...normalizeTestCasePayload(t, qIndex, tcIndex),
        },
        { transaction },
      );
      createdTestCases.push(tc);
    }
    createdQuestions.push({ question, testCases: createdTestCases });
  }
  return createdQuestions;
}

// POST /api/coding-assessments
router.post('/', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { trainingId, title, problems } = req.body;
    if (!title) {
      await transaction.rollback();
      return res.status(422).json({ error: 'title is required' });
    }
    if (!trainingId) {
      await transaction.rollback();
      return res.status(422).json({ error: 'trainingId is required' });
    }
    if (!Array.isArray(problems) || problems.length === 0) {
      await transaction.rollback();
      return res.status(422).json({ error: 'problems array is required and must not be empty' });
    }

    const training = await Training.findByPk(trainingId, { transaction });
    if (!training) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Training not found' });
    }

    const assessment = await CodingAssessment.create(
      {
        ...pickAssessmentFields(req.body),
        trainerId: req.user.id,
        status: 'DRAFT',
      },
      { transaction },
    );

    await createQuestionsAndTestCases(assessment.id, problems, transaction);

    await transaction.commit();

    const fullAssessment = await CodingAssessment.findByPk(assessment.id, {
      include: [
        {
          model: CodingQuestion,
          as: 'questions',
          order: [['order_index', 'ASC']],
          include: [
            {
              model: TestCase,
              as: 'testCases',
              order: [['order_index', 'ASC']],
            },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.status(201).json({ assessment: fullAssessment });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating coding assessment:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/coding-assessments
router.get('/', async (req, res) => {
  try {
    const where = req.user.role === 'ADMIN' ? {} : { trainerId: req.user.id };
    const assessments = await CodingAssessment.findAll({
      where,
      include: [
        {
          model: Training,
          as: 'training',
          attributes: ['id', 'title'],
        },
        {
          model: User,
          as: 'trainer',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json({ assessments });
  } catch (error) {
    console.error('Error listing coding assessments:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/coding-assessments/:id
router.get('/:id', async (req, res) => {
  try {
    const assessment = await CodingAssessment.findByPk(req.params.id, {
      include: [
        {
          model: CodingQuestion,
          as: 'questions',
          order: [['order_index', 'ASC']],
          include: [
            {
              model: TestCase,
              as: 'testCases',
              order: [['order_index', 'ASC']],
            },
          ],
        },
        {
          model: Training,
          as: 'training',
          attributes: ['id', 'title'],
        },
        {
          model: User,
          as: 'trainer',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const hasAccess = await verifyTrainerAccess(req, res, assessment);
    if (!hasAccess) return;

    res.json({ assessment });
  } catch (error) {
    console.error('Error fetching coding assessment:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/coding-assessments/:id
router.put('/:id', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const assessment = await CodingAssessment.findByPk(req.params.id, { transaction });
    if (!assessment) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const hasAccess = await verifyTrainerAccess(req, res, assessment);
    if (!hasAccess) {
      await transaction.rollback();
      return;
    }

    if (assessment.status !== 'DRAFT') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Only DRAFT assessments can be updated' });
    }

    const { title, problems, trainingId } = req.body;
    if (title !== undefined && !title) {
      await transaction.rollback();
      return res.status(422).json({ error: 'title cannot be empty' });
    }
    if (problems !== undefined && (!Array.isArray(problems) || problems.length === 0)) {
      await transaction.rollback();
      return res.status(422).json({ error: 'problems must be a non-empty array' });
    }

    if (trainingId !== undefined) {
      const training = await Training.findByPk(trainingId, { transaction });
      if (!training) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Training not found' });
      }
    }

    const updateData = pickAssessmentFields(req.body);
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    await assessment.update(updateData, { transaction });

    if (Array.isArray(problems)) {
      const existingQuestions = await CodingQuestion.findAll({
        where: { assessmentId: assessment.id },
        transaction,
      });
      const existingQuestionIds = existingQuestions.map((q) => q.id);
      if (existingQuestionIds.length > 0) {
        await TestCase.destroy({
          where: { questionId: existingQuestionIds },
          transaction,
        });
        await CodingQuestion.destroy({
          where: { assessmentId: assessment.id },
          transaction,
        });
      }
      await createQuestionsAndTestCases(assessment.id, problems, transaction);
    }

    await transaction.commit();

    const fullAssessment = await CodingAssessment.findByPk(assessment.id, {
      include: [
        {
          model: CodingQuestion,
          as: 'questions',
          order: [['order_index', 'ASC']],
          include: [
            {
              model: TestCase,
              as: 'testCases',
              order: [['order_index', 'ASC']],
            },
          ],
        },
      ],
    });

    res.json({ assessment: fullAssessment });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating coding assessment:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/coding-assessments/:id
router.delete('/:id', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const assessment = await CodingAssessment.findByPk(req.params.id, { transaction });
    if (!assessment) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const hasAccess = await verifyTrainerAccess(req, res, assessment);
    if (!hasAccess) {
      await transaction.rollback();
      return;
    }

    const questions = await CodingQuestion.findAll({
      where: { assessmentId: assessment.id },
      transaction,
    });
    const questionIds = questions.map((q) => q.id);
    if (questionIds.length > 0) {
      await TestCase.destroy({ where: { questionId: questionIds }, transaction });
    }
    await CodingQuestion.destroy({ where: { assessmentId: assessment.id }, transaction });
    await assessment.destroy({ transaction });

    await transaction.commit();
    res.json({ message: 'Assessment deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting coding assessment:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/coding-assessments/:id/publish
router.post('/:id/publish', async (req, res) => {
  try {
    const assessment = await CodingAssessment.findByPk(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const hasAccess = await verifyTrainerAccess(req, res, assessment);
    if (!hasAccess) return;

    if (assessment.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT assessments can be published' });
    }

    const questionCount = await CodingQuestion.count({ where: { assessmentId: assessment.id } });
    if (questionCount === 0) {
      return res.status(400).json({ error: 'Cannot publish an assessment with no problems' });
    }

    await assessment.update({ status: 'PUBLISHED' });

    const fullAssessment = await CodingAssessment.findByPk(assessment.id, {
      include: [
        {
          model: CodingQuestion,
          as: 'questions',
          order: [['order_index', 'ASC']],
          include: [
            {
              model: TestCase,
              as: 'testCases',
              order: [['order_index', 'ASC']],
            },
          ],
        },
      ],
    });

    res.json({ message: 'Assessment published successfully', assessment: fullAssessment });
  } catch (error) {
    console.error('Error publishing coding assessment:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/coding-assessments/:id/close
router.post('/:id/close', async (req, res) => {
  try {
    const assessment = await CodingAssessment.findByPk(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const hasAccess = await verifyTrainerAccess(req, res, assessment);
    if (!hasAccess) return;

    if (assessment.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'Only PUBLISHED assessments can be closed' });
    }

    await assessment.update({ status: 'CLOSED' });

    const fullAssessment = await CodingAssessment.findByPk(assessment.id, {
      include: [
        {
          model: CodingQuestion,
          as: 'questions',
          order: [['order_index', 'ASC']],
          include: [
            {
              model: TestCase,
              as: 'testCases',
              order: [['order_index', 'ASC']],
            },
          ],
        },
      ],
    });

    res.json({ message: 'Assessment closed successfully', assessment: fullAssessment });
  } catch (error) {
    console.error('Error closing coding assessment:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/coding-assessments/:id/results
router.get('/:id/results', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  try {
    const assessment = await CodingAssessment.findByPk(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const hasAccess = await verifyTrainerAccess(req, res, assessment);
    if (!hasAccess) return;

    const attempts = await CodingAttempt.findAll({
      where: { assessmentId: assessment.id },
      include: [
        {
          model: User,
          as: 'participant',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: CodingSubmission,
          as: 'submissions',
          where: { isFinal: true },
          required: false,
        },
      ],
      order: [['totalScore', 'DESC']],
    });

    res.json({ success: true, results: attempts, assessment });
  } catch (error) {
    console.error('Error fetching coding assessment results:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/coding-assessments/:id/publish-result
router.post('/:id/publish-result', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  try {
    const assessment = await CodingAssessment.findByPk(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const hasAccess = await verifyTrainerAccess(req, res, assessment);
    if (!hasAccess) return;

    await assessment.update({ resultStatus: 'PUBLISHED' });

    res.json({ success: true });
  } catch (error) {
    console.error('Error publishing coding assessment results:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
