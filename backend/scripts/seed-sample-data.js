require('dotenv').config();
const { sequelize } = require('../src/config/db');
const {
  User, Training, Course, Lesson,
  LessonMaterial, Enrollment
} = require('../src/models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    const admin = await User.findOne({ where: { email: 'admin@test.com' } });
    if (!admin) {
      console.log('No admin found. Start the backend first to create admin user.');
      process.exit(1);
    }

    // 1. Training Program
    const [program] = await Training.findOrCreate({
      where: { title: 'Full Stack Web Development' },
      defaults: {
        description: 'A comprehensive program covering frontend and backend development with modern frameworks.',
        createdBy: admin.id
      }
    });
    console.log('Program:', program.title);

    // 2. Courses
    const [reactCourse] = await Course.findOrCreate({
      where: { title: 'React.js Mastery' },
      defaults: {
        trainingProgramId: program.id,
        trainerId: admin.id,
        description: 'Deep dive into React.js including hooks, state management, and performance optimization.',
        status: 'PUBLISHED'
      }
    });
    console.log('Course:', reactCourse.title);

    const [nodeCourse] = await Course.findOrCreate({
      where: { title: 'Node.js Backend Development' },
      defaults: {
        trainingProgramId: program.id,
        trainerId: admin.id,
        description: 'Build scalable REST APIs with Express.js, Sequelize, and PostgreSQL.',
        status: 'PUBLISHED'
      }
    });
    console.log('Course:', nodeCourse.title);

    // 3. Lessons — React
    await Lesson.findOrCreate({
      where: { title: 'Introduction to React', courseId: reactCourse.id },
      defaults: { trainerId: admin.id, description: 'Learn what React is and why it is used.', content: 'React is a JavaScript library for building user interfaces.', orderIndex: 1 }
    });
    await Lesson.findOrCreate({
      where: { title: 'Components & Props', courseId: reactCourse.id },
      defaults: { trainerId: admin.id, description: 'Understanding components and how to pass data with props.', content: 'Components are the building blocks of any React application.', orderIndex: 2 }
    });
    await Lesson.findOrCreate({
      where: { title: 'State & Hooks', courseId: reactCourse.id },
      defaults: { trainerId: admin.id, description: 'Master useState, useEffect, and custom hooks.', content: 'Hooks let you use state and other React features without writing a class.', orderIndex: 3 }
    });
    console.log('React lessons created');

    // 4. Lessons — Node
    await Lesson.findOrCreate({
      where: { title: 'Setting Up Express.js', courseId: nodeCourse.id },
      defaults: { trainerId: admin.id, description: 'Initialize an Express server and create your first route.', content: 'Express.js is a minimal and flexible Node.js web application framework.', orderIndex: 1 }
    });
    await Lesson.findOrCreate({
      where: { title: 'Database with Sequelize', courseId: nodeCourse.id },
      defaults: { trainerId: admin.id, description: 'Connect your app to PostgreSQL using Sequelize ORM.', content: 'Sequelize is a promise-based Node.js ORM for PostgreSQL, MySQL, and more.', orderIndex: 2 }
    });
    console.log('Node lessons created');

    // 5. Materials
    const introLesson = await Lesson.findOne({ where: { title: 'Introduction to React', courseId: reactCourse.id } });
    if (introLesson) {
      await LessonMaterial.findOrCreate({
        where: { lessonId: introLesson.id, title: 'React Overview' },
        defaults: { materialType: 'NOTE', content: 'React uses a virtual DOM to efficiently update the UI. It follows a component-based architecture.', orderIndex: 1 }
      });
      await LessonMaterial.findOrCreate({
        where: { lessonId: introLesson.id, title: 'React Official Docs' },
        defaults: { materialType: 'LINK', linkUrl: 'https://react.dev', content: 'Official React documentation and tutorials.', orderIndex: 2 }
      });
      console.log('Materials created');
    }

    // 6. Enrollment
    await Enrollment.findOrCreate({
      where: { participantId: admin.id, courseId: reactCourse.id },
      defaults: { status: 'ENROLLED', progressPercent: 0.00 }
    });
    console.log('Enrollment created');

    console.log('\n✅ Seed data inserted successfully!');
    console.log('Check Supabase Table Editor to see the data.');
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    await sequelize.close();
  }
}

seed();
