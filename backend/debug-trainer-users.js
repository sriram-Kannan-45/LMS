const { sequelize } = require('./src/models');
async function main() {
  try {
    await sequelize.authenticate();
    const [users] = await sequelize.query("SELECT id, email, role, name FROM users WHERE role = 'trainer'");
    console.log('Trainer users:');
    console.log(JSON.stringify(users, null, 2));
    
    // Also check what trainer/trainings returns for trainer 44
    const [trainings] = await sequelize.query("SELECT id, title, trainer_id FROM training_programs WHERE trainer_id = 44");
    console.log('Trainings for trainer 44:');
    console.log(JSON.stringify(trainings, null, 2));
    
    const [assignments] = await sequelize.query("SELECT * FROM training_trainer_assignments WHERE trainer_id = 44");
    console.log('TrainingTrainerAssignments for trainer 44:');
    console.log(JSON.stringify(assignments, null, 2));
    
    await sequelize.close();
  } catch (e) {
    console.error(e.stack);
  }
}
main();
