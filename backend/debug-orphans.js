const { sequelize, Training } = require('./src/models');

async function test() {
  try {
    await sequelize.authenticate();
    
    // Check all tables in the database
    const [tables] = await sequelize.query('SHOW TABLES');
    console.log('Tables in DB:');
    console.log(JSON.stringify(tables, null, 2));
    
    // Check training_programs
    const [trainings] = await sequelize.query('SELECT id, title, trainerId FROM training_programs');
    console.log('Training Programs:');
    console.log(JSON.stringify(trainings, null, 2));
    
    // Check training_trainer_assignments
    try {
      const [assignments] = await sequelize.query('SELECT * FROM training_trainer_assignments');
      console.log('TrainingTrainerAssignments:');
      console.log(JSON.stringify(assignments, null, 2));
    } catch (e) {
      console.error('training_trainer_assignments error:', e.message);
    }
    
    // Check courses
    try {
      const [courses] = await sequelize.query('SELECT id, trainerId, trainingProgramId FROM courses');
      console.log('Courses:');
      console.log(JSON.stringify(courses, null, 2));
    } catch (e) {
      console.error('courses error:', e.message);
    }
    
    // Check for orphaned assignments
    try {
      const [orphans] = await sequelize.query(
        'SELECT tta.* FROM training_trainer_assignments tta LEFT JOIN training_programs tp ON tp.id = tta.trainingId WHERE tp.id IS NULL'
      );
      console.log('Orphaned assignments:');
      console.log(JSON.stringify(orphans, null, 2));
    } catch (e) {
      console.error('orphans error:', e.message);
    }
    
    // Check for orphaned course references
    try {
      const [courseOrphans] = await sequelize.query(
        'SELECT c.id, c.trainerId, c.trainingProgramId FROM courses c LEFT JOIN training_programs tp ON tp.id = c.trainingProgramId WHERE tp.id IS NULL'
      );
      console.log('Orphaned courses:');
      console.log(JSON.stringify(courseOrphans, null, 2));
    } catch (e) {
      console.error('course orphans error:', e.message);
    }
    
    await sequelize.close();
  } catch(e) { console.error('Fatal Error:', e.stack); }
}
test();
