require('dotenv').config();
const { sequelize } = require('../config/db');
const AIQuizService = require('../services/aiQuizService');
const { Course, Training, Enrollment, User, AIQuiz } = require('../models');

async function main() {
  console.log('--- Testing AI Quiz Service Layer ---');
  
  try {
    // 1. Authenticate DB
    await sequelize.authenticate();
    console.log('✅ DB Connected');

    // 2. Fetch a Trainer & Course/Training
    const trainer = await User.findOne({ where: { role: 'TRAINER' } });
    if (!trainer) {
      console.log('❌ No Trainer found. Please seed the DB first.');
      process.exit(1);
    }
    console.log(`✅ Using Trainer: ${trainer.name} (ID: ${trainer.id})`);

    const course = await Course.findOne();
    if (!course) {
      console.log('❌ No Course found. Please seed the DB first.');
      process.exit(1);
    }
    console.log(`✅ Using Course: "${course.title}" (ID: ${course.id}), trainingProgramId: ${course.trainingProgramId}`);

    // 3. Mock Questions
    const mockQuestions = [
      {
        questionText: 'What is the default value of local variables in Java?',
        questionType: 'MCQ',
        options: ['Null', '0', 'Not initialized / compilation error', 'Depends on type'],
        correctAnswer: 'Not initialized / compilation error',
        explanation: 'Local variables in Java must be initialized before use, otherwise a compilation error occurs.'
      },
      {
        questionText: 'Which keyword is used to refer to the parent class object in Java?',
        questionType: 'MCQ',
        options: ['this', 'super', 'parent', 'extends'],
        correctAnswer: 'super',
        explanation: 'The super keyword is used to refer to parent class elements or constructor.'
      }
    ];

    // 4. Save Quiz Header
    const quiz = await AIQuizService.saveQuiz({
      courseId: course.id,
      trainingId: course.trainingProgramId,
      trainerId: trainer.id,
      title: 'Java OOP Fundamentals Mock Test',
      description: 'Auto-verified test run for AI Quiz Service',
      difficulty: 'MEDIUM',
      questionCount: mockQuestions.length,
      status: 'PUBLISHED',
      published: true
    });
    console.log(`✅ AI Quiz Saved successfully. ID: ${quiz.id}, quiz_id column value: ${quiz.quizId}`);

    if (String(quiz.quizId) !== String(quiz.id)) {
      throw new Error(`quiz_id column (${quiz.quizId}) does not match primary key ID (${quiz.id})!`);
    }

    // 5. Save Questions & Options
    await AIQuizService.saveQuestions(quiz.id, mockQuestions);
    console.log('✅ Questions & Options saved successfully.');

    // 6. Test participant quizzes retrieval
    const participant = await User.findOne({ where: { role: 'PARTICIPANT' } });
    if (participant) {
      console.log(`✅ Using Participant: ${participant.name} (ID: ${participant.id})`);
      
      // Make sure participant is enrolled in the course
      let enrollment = await Enrollment.findOne({
        where: { participantId: participant.id, courseId: course.id }
      });
      if (!enrollment) {
        enrollment = await Enrollment.create({
          participantId: participant.id,
          courseId: course.id,
          trainingId: course.trainingProgramId,
          status: 'ENROLLED'
        });
        console.log('✅ Created mock enrollment for participant.');
      } else if (enrollment.status !== 'ENROLLED') {
        await enrollment.update({ status: 'ENROLLED' });
        console.log('✅ Updated enrollment status to ENROLLED.');
      }

      const { availableQuizzes, completedQuizzes } = await AIQuizService.getParticipantQuizzes(participant.id);
      const allQuizzes = [...availableQuizzes, ...completedQuizzes];
      console.log(`✅ Participant Quizzes fetched. Count: ${allQuizzes.length}`);
      
      const found = allQuizzes.find(q => q.id === quiz.id);
      if (found) {
        console.log(`🎉 SUCCESS: Generated quiz "${found.title}" is visible to participant!`);
        console.log(`  → isAI flag: ${found.isAI}`);
        console.log(`  → questionCount: ${found.questionCount}`);
        console.log(`  → training title: ${found.training?.title || found.course?.title}`);
      } else {
        throw new Error('Generated quiz is not visible in getParticipantQuizzes!');
      }
    } else {
      console.log('⚠️ No Participant found in DB. Skipping participant visibility check.');
    }

    console.log('🎉 ALL SERVICE TESTS PASSED!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Service Test Failed:', err);
    process.exit(1);
  }
}

main();
