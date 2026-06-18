const fs = require('fs');
const path = require('path');
const {
  AIDocument,
  AIQuiz,
  AIQuestion,
  AIQuestionOption,
  Training,
  Course,
  CourseTrainerAssignment,
  TrainingTrainerAssignment,
} = require('../models');
const aiService = require('../services/aiService');
const { isImageFile } = require('../middleware/uploadAIQuizMaterial');

function cleanNullable(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text || ['undefined', 'null', 'nan'].includes(text.toLowerCase())) return null;
  return text;
}

async function resolveScope({ trainingId, courseId, trainerId }) {
  let resolvedCourseId = cleanNullable(courseId);
  let resolvedTrainingId = cleanNullable(trainingId);

  if (resolvedTrainingId && !resolvedCourseId) {
    const courseCheck = await Course.findByPk(resolvedTrainingId);
    if (courseCheck) {
      resolvedCourseId = String(courseCheck.id);
      resolvedTrainingId = String(courseCheck.trainingProgramId);
    } else {
      const course = await Course.findOne({ where: { trainingProgramId: resolvedTrainingId } });
      if (course) resolvedCourseId = String(course.id);
    }
  }

  if (resolvedCourseId) {
    const course = await Course.findByPk(resolvedCourseId);
    if (!course) {
      const error = new Error(`The selected course (ID: ${resolvedCourseId}) does not exist.`);
      error.status = 400;
      throw error;
    }
    const courseAssigned = await CourseTrainerAssignment.findOne({
      where: { courseId: resolvedCourseId, trainerId },
    });
    const hasAccess = course.trainerId === trainerId || courseAssigned !== null;
    if (!hasAccess) {
      const error = new Error(`You are not authorized to generate quizzes for course (ID: ${resolvedCourseId}).`);
      error.status = 403;
      throw error;
    }
    return { resolvedCourseId, resolvedTrainingId: String(course.trainingProgramId) };
  }

  if (resolvedTrainingId) {
    const training = await Training.findByPk(resolvedTrainingId);
    if (!training) {
      const error = new Error(`The selected training program (ID: ${resolvedTrainingId}) does not exist.`);
      error.status = 400;
      throw error;
    }
    const trainingAssigned = await TrainingTrainerAssignment.findOne({
      where: { trainingId: resolvedTrainingId, trainerId },
    });
    const hasAccess = training.trainerId === trainerId || training.createdBy === trainerId || trainingAssigned !== null;
    if (!hasAccess) {
      const error = new Error(`You are not authorized to generate quizzes for training program (ID: ${resolvedTrainingId}).`);
      error.status = 403;
      throw error;
    }
  }

  return { resolvedCourseId, resolvedTrainingId };
}

function validateQuestionCount(value) {
  const count = parseInt(value, 10);
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    const error = new Error('numberOfQuestions must be between 1 and 50.');
    error.status = 422;
    throw error;
  }
  return count;
}

function validateUploadedFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (isImageFile(buffer)) {
    const error = new Error('Images are not supported. Please upload PDF, DOCX, PPTX, or TXT files only.');
    error.status = 415;
    throw error;
  }
}

async function saveQuestions(quizId, questions) {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const savedQuestion = await AIQuestion.create({
      quizId,
      questionText: q.questionText,
      questionType: q.questionType || 'MCQ',
      options: q.options || null,
      correctAnswer: String(q.correctAnswer ?? ''),
      acceptableAnswers: q.acceptableAnswers || null,
      pairs: q.pairs || null,
      explanation: q.explanation || '',
      topic: q.topic || null,
      bloomsLevel: q.bloomsLevel || null,
      difficulty: q.difficulty || 'MEDIUM',
      order: i,
    });

    if (Array.isArray(q.options) && q.options.length > 0) {
      const correctIndex = ['0', '1', '2', '3'].includes(String(q.correctAnswer))
        ? parseInt(q.correctAnswer, 10)
        : q.options.findIndex(option => String(option).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase());

      for (let optionIndex = 0; optionIndex < q.options.length; optionIndex++) {
        await AIQuestionOption.create({
          questionId: savedQuestion.id,
          optionText: String(q.options[optionIndex]),
          isCorrect: optionIndex === correctIndex,
          order: optionIndex,
        });
      }
    }
  }
}

async function generateAIQuiz(req, res) {
  let document = null;
  let quiz = null;
  const filePath = req.file ? path.resolve(req.file.path) : null;

  try {
    const trainerId = req.user.id;
    const trainingId = req.body.training_id ?? req.body.trainingId;
    const courseId = req.body.course_id ?? req.body.courseId;
    const difficulty = String(req.body.difficulty || 'MIXED').toUpperCase();
    const numQuestions = validateQuestionCount(req.body.numberOfQuestions ?? req.body.numQuestions ?? 10);
    const questionType = req.body.questionType || req.body.question_type || 'MIXED';
    const url = cleanNullable(req.body.url ?? req.body.source_url);

    if (!req.file && !url) {
      return res.status(400).json({ error: 'A PDF, DOCX, PPTX, TXT file or website URL is required.' });
    }
    if (req.file && url) {
      return res.status(422).json({ error: 'Provide either a file or a URL, not both.' });
    }
    if (req.file) validateUploadedFile(filePath);

    const { resolvedCourseId, resolvedTrainingId } = await resolveScope({
      trainingId,
      courseId,
      trainerId,
    });

    const sourceTitle = req.file?.originalname || url;
    const sourceType = req.file?.mimetype || 'url';
    const sourceLocation = req.file ? `/uploads/ai-docs/${req.file.filename}` : url;

    document = await AIDocument.create({
      trainerId,
      trainingId: resolvedTrainingId,
      title: sourceTitle,
      content: null,
      fileUrl: sourceLocation,
      fileType: sourceType,
      status: 'PROCESSING',
    });

    quiz = await AIQuiz.create({
      documentId: document.id,
      trainerId,
      trainingId: resolvedTrainingId,
      courseId: resolvedCourseId,
      title: `Quiz: ${sourceTitle}`,
      numQuestions,
      difficulty: ['EASY', 'MEDIUM', 'HARD', 'MIXED'].includes(difficulty) ? difficulty : 'MIXED',
      status: 'DRAFT',
    });

    const result = req.file
      ? await aiService.generateQuizFromFile({
        filePath,
        originalName: sourceTitle,
        fileType: sourceType,
        trainingId: resolvedTrainingId,
        courseId: resolvedCourseId,
        numQuestions,
        difficulty,
        questionType,
      })
      : await aiService.generateQuizFromUrl({
        url,
        trainingId: resolvedTrainingId,
        courseId: resolvedCourseId,
        numQuestions,
        difficulty,
        questionType,
      });

    const questions = result.questions || [];
    if (questions.length === 0) {
      await document.update({ status: 'ERROR' });
      await quiz.destroy();
      return res.status(502).json({
        error: 'AI service returned no questions',
        details: 'The RAG pipeline processed the material but produced no usable questions.',
      });
    }

    await quiz.update({ title: result.title || `Quiz: ${sourceTitle}`, numQuestions: questions.length });
    await saveQuestions(quiz.id, questions);
    await document.update({
      status: 'READY',
      content: result.metadata?.cleanTextPreview || null,
    });

    await quiz.reload({ include: [{ model: AIQuestion, as: 'questions' }] });

    return res.status(201).json({
      success: true,
      message: `Quiz "${quiz.title}" generated successfully with ${questions.length} questions`,
      quiz,
      generatedQuiz: result.quizOutput || {
        title: quiz.title,
        difficulty: quiz.difficulty,
        totalQuestions: questions.length,
        questions: [],
      },
      rag: {
        chunkCount: result.metadata?.chunkCount,
        retrievedChunkNumbers: result.metadata?.retrievedChunkNumbers,
        embeddingModel: result.metadata?.embeddingModel,
        faissIndexPath: result.metadata?.faissIndexPath,
      },
    });
  } catch (error) {
    if (document) {
      try { await document.update({ status: 'ERROR' }); } catch (_) {}
    }
    if (quiz) {
      try { await quiz.destroy(); } catch (_) {}
    }
    if (filePath && error.status === 415) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
    console.error('[generateAIQuiz] Error:', error.message);
    return res.status(error.status || 500).json({ error: error.message });
  }
}

module.exports = { generateAIQuiz };
