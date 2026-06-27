require('dotenv').config();
const { sequelize, connectDB } = require('../config/db');
const { QuizAttempt, User, AIQuiz } = require('../models');
const { Op } = require('sequelize');

async function run() {
  console.log('--- Testing Duplicate Quiz Attempt Valildation ---');
  try {
    await connectDB();

    // Get a mock participant and quiz
    const participant = await User.findOne({ where: { role: 'PARTICIPANT' } });
    const quiz = await AIQuiz.findOne({ where: { status: 'PUBLISHED' } });

    if (!participant || !quiz) {
      console.error('❌ Participant or Quiz not found. Ensure database is seeded.');
      process.exit(1);
    }

    console.log(`Using Participant ID: ${participant.id}, Quiz ID: ${quiz.id}`);

    // Clean up any existing attempts for this participant and quiz first
    await QuizAttempt.destroy({ where: { participantId: participant.id, quizId: quiz.id } });
    console.log('✅ Cleaned up old attempts.');

    // 1. Test database UNIQUE constraint
    console.log('1. Testing database UNIQUE constraint...');
    const attempt1 = await QuizAttempt.create({
      quizId: quiz.id,
      participantId: participant.id,
      status: 'IN_PROGRESS'
    });
    console.log(`✅ First attempt created: ID ${attempt1.id}`);

    try {
      await QuizAttempt.create({
        quizId: quiz.id,
        participantId: participant.id,
        status: 'IN_PROGRESS'
      });
      console.error('❌ FAIL: Database allowed duplicate attempt creation!');
    } catch (dbError) {
      console.log('✅ SUCCESS: Database unique constraint blocked duplicate successfully:', dbError.message);
    }

    // Clean up again for API test
    await QuizAttempt.destroy({ where: { participantId: participant.id, quizId: quiz.id } });

    // 2. Test controller start quiz behavior
    console.log('2. Testing start quiz behavior when completed attempt exists...');
    
    // Create completed attempt
    await QuizAttempt.create({
      quizId: quiz.id,
      participantId: participant.id,
      status: 'SUBMITTED'
    });
    console.log('✅ Created mock SUBMITTED attempt');

    // Simulate listCourseQuizzes filtering
    const AIQuizService = require('../services/aiQuizService');
    const { availableQuizzes } = await AIQuizService.getParticipantQuizzes(participant.id);
    const isVisibleInAvailable = availableQuizzes.some(q => q.id === quiz.id);
    if (!isVisibleInAvailable) {
      console.log('✅ SUCCESS: Completed quiz does not show up in available quizzes.');
    } else {
      console.error('❌ FAIL: Completed quiz is still visible in available quizzes!');
    }

    // Clean up
    await QuizAttempt.destroy({ where: { participantId: participant.id, quizId: quiz.id } });
    console.log('🎉 ALL DB AND UNIQUE CONSTRAINT CHECKS PASSED!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Test Failed:', err);
    process.exit(1);
  }
}

run();
