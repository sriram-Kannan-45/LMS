const { Training, User, Enrollment, Notification, TrainingTrainerAssignment, Course, CourseTrainerAssignment } = require('../models');
const { Op } = require('sequelize');

const createTraining = async (req, res) => {
  try {
    const { title, description, trainerId, trainerIds, startDate, endDate, capacity, sequentialLearning } = req.body;

    if (!title) return res.status(422).json({ error: 'Title is required' });
    if (!trainerId && (!trainerIds || trainerIds.length === 0)) {
      return res.status(422).json({ error: 'Trainer ID or Trainer IDs is required' });
    }
    if (!startDate || !endDate) return res.status(422).json({ error: 'Start and end dates are required' });

    let finalTrainerIds = [];
    if (Array.isArray(trainerIds)) {
      finalTrainerIds = trainerIds.map(id => parseInt(id));
    } else if (trainerId) {
      finalTrainerIds = [parseInt(trainerId)];
    }

    const trainers = await User.findAll({ where: { id: finalTrainerIds, role: 'TRAINER' } });
    if (trainers.length !== finalTrainerIds.length) {
      return res.status(400).json({ error: 'One or more trainer IDs are invalid' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) return res.status(422).json({ error: 'Invalid start date format' });
    if (isNaN(end.getTime())) return res.status(422).json({ error: 'Invalid end date format' });
    if (end <= start) return res.status(422).json({ error: 'End date must be after start date' });

    const primaryTrainerId = finalTrainerIds[0] || null;

    const training = await Training.create({
      title,
      description: description || null,
      trainerId: primaryTrainerId,
      startDate: start,
      endDate: end,
      capacity: capacity ? parseInt(capacity) : null,
      sequentialLearning: !!sequentialLearning,
      createdBy: req.user.id
    });

    // Create many-to-many trainer assignments
    const assignments = finalTrainerIds.map(tId => ({
      trainingId: training.id,
      trainerId: tId
    }));
    await TrainingTrainerAssignment.bulkCreate(assignments);

    // Automatically create a corresponding Course with 'PUBLISHED' status
    const course = await Course.create({
      trainingProgramId: training.id,
      trainerId: primaryTrainerId,
      title: training.title,
      description: training.description || null,
      status: 'PUBLISHED'
    });

    // Sync trainer assignments in CourseTrainerAssignment
    const courseAssignments = finalTrainerIds.map(tId => ({
      courseId: course.id,
      trainerId: tId
    }));
    await CourseTrainerAssignment.bulkCreate(courseAssignments);

    // Notify Trainers
    const io = req.app.get('io');
    for (const trainer of trainers) {
      await Notification.create({
        userId: trainer.id,
        message: `You have been assigned as the instructor for training: ${training.title}`,
        isRead: false
      });
      if (io) {
        io.to(`user_${trainer.id}`).emit('notification:new', {
          message: `You have been assigned as the instructor for training: ${training.title}`
        });
      }
    }

    console.log('✅ Training saved:', training.id, '-', training.title);

    res.status(201).json({
      id: training.id,
      title: training.title,
      description: training.description,
      trainerId: training.trainerId,
      trainerIds: finalTrainerIds,
      trainerName: trainers.map(t => t.name).join(', '),
      startDate: training.startDate,
      endDate: training.endDate,
      capacity: training.capacity,
      message: 'Training created successfully'
    });
  } catch (error) {
    console.error('Create training error:', error.message);
    res.status(500).json({ error: 'Server error creating training' });
  }
};

const getAllTrainings = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    console.log('📋 getAllTrainings called, user:', userId, 'role:', userRole);

    const trainings = await Training.findAll({
      include: [
        {
          model: User,
          as: 'trainer',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: TrainingTrainerAssignment,
          as: 'trainerAssignments',
          include: [{ model: User, as: 'trainer', attributes: ['id', 'name', 'email'] }]
        }
      ],
      order: [['id', 'DESC']]
    });

    console.log('📋 Raw trainings from DB:', trainings.length);

    const formattedTrainings = await Promise.all(trainings.map(async t => {
      let enrolledCount = 0;
      try {
        enrolledCount = await Enrollment.count({
          where: { trainingId: t.id, status: 'ENROLLED' }
        });
      } catch (e) {
        console.error('Count error for training', t.id, e.message);
      }

      let isEnrolled = false;
      if (userId && userRole === 'PARTICIPANT') {
        try {
          const enrollment = await Enrollment.findOne({
            where: { participantId: userId, trainingId: t.id, status: 'ENROLLED' }
          });
          isEnrolled = !!enrollment;
        } catch (e) {
          console.error('Enrollment check error:', e.message);
        }
      }

      const assignedTrainers = (t.trainerAssignments || []).map(ta => ta.trainer).filter(Boolean);
      const trainerNames = assignedTrainers.length > 0 ? assignedTrainers.map(tr => tr.name).join(', ') : (t.trainer ? t.trainer.name : null);
      const trainerIds = assignedTrainers.length > 0 ? assignedTrainers.map(tr => tr.id) : (t.trainerId ? [t.trainerId] : []);

      return {
        id: t.id,
        title: t.title,
        description: t.description,
        trainerId: t.trainerId,
        trainerIds,
        trainerName: trainerNames,
        trainerEmail: t.trainer ? t.trainer.email : null,
        startDate: t.startDate,
        endDate: t.endDate,
        capacity: t.capacity,
        enrolledCount,
        availableSeats: t.capacity ? (t.capacity - enrolledCount) : null,
        isEnrolled,
        isFull: t.capacity ? enrolledCount >= t.capacity : false,
        sequentialLearning: t.sequentialLearning || false
      };
    }));

    console.log('📋 Returning', formattedTrainings.length, 'trainings');
    res.json(formattedTrainings);
  } catch (error) {
    console.error('Get trainings error:', error.message, error.stack);
    res.status(500).json({ error: 'Server error fetching trainings' });
  }
};

const getTrainingById = async (req, res) => {
  try {
    const { id } = req.params;

    const training = await Training.findByPk(id, {
      include: [
        { model: User, as: 'trainer', attributes: ['id', 'name', 'email'], required: false },
        {
          model: TrainingTrainerAssignment,
          as: 'trainerAssignments',
          include: [{ model: User, as: 'trainer', attributes: ['id', 'name', 'email'] }]
        }
      ]
    });

    if (!training) return res.status(404).json({ error: 'Training not found' });

    const assignedTrainers = (training.trainerAssignments || []).map(ta => ta.trainer).filter(Boolean);
    const trainerNames = assignedTrainers.length > 0 ? assignedTrainers.map(tr => tr.name).join(', ') : (training.trainer ? training.trainer.name : null);
    const trainerIds = assignedTrainers.length > 0 ? assignedTrainers.map(tr => tr.id) : (training.trainerId ? [training.trainerId] : []);

    res.json({
      id: training.id,
      title: training.title,
      description: training.description,
      trainerId: training.trainerId,
      trainerIds,
      trainerName: trainerNames,
      startDate: training.startDate,
      endDate: training.endDate,
      capacity: training.capacity,
      sequentialLearning: training.sequentialLearning || false
    });
  } catch (error) {
    console.error('Get training by ID error:', error.message);
    res.status(500).json({ error: 'Server error fetching training' });
  }
};

module.exports = { createTraining, getAllTrainings, getTrainingById };