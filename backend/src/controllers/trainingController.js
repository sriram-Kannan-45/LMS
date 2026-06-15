const { Training, User, Enrollment, Notification } = require('../models');
const { Op, fn, col } = require('sequelize');
const logger = require('../utils/logger');
const cacheService = require('../services/cacheService');

const createTraining = async (req, res) => {
  try {
    const { title, description, trainerId, startDate, endDate, capacity } = req.body;

    if (!title) return res.status(422).json({ error: 'Title is required' });
    if (!trainerId) return res.status(422).json({ error: 'Trainer ID is required' });
    if (!startDate || !endDate) return res.status(422).json({ error: 'Start and end dates are required' });

    const trainer = await User.findOne({ where: { id: trainerId, role: 'TRAINER' } });
    if (!trainer) return res.status(400).json({ error: 'Invalid trainer ID or user is not a TRAINER' });

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) return res.status(422).json({ error: 'Invalid start date format' });
    if (isNaN(end.getTime())) return res.status(422).json({ error: 'Invalid end date format' });
    if (end <= start) return res.status(422).json({ error: 'End date must be after start date' });

    const training = await Training.create({
      title, description: description || null,
      trainerId: parseInt(trainerId), startDate: start, endDate: end,
      capacity: capacity ? parseInt(capacity) : null, createdBy: req.user.id,
    });

    await Notification.create({
      userId: trainer.id,
      message: `You have been assigned as the instructor for training: ${training.title}`,
      isRead: false,
    });

    // Invalidate cache so new training appears immediately
    await cacheService.invalidatePattern('admin:training*');

    res.status(201).json({
      id: training.id, title: training.title, description: training.description,
      trainerId: training.trainerId, trainerName: trainer.name,
      startDate: training.startDate, endDate: training.endDate,
      capacity: training.capacity, message: 'Training created successfully',
    });
  } catch (error) {
    logger.error('Create training error', { error: error.message });
    res.status(500).json({ error: 'Server error creating training' });
  }
};

const getAllTrainings = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const trainings = await Training.findAll({
      attributes: ['id', 'title', 'description', 'trainerId', 'startDate', 'endDate', 'capacity'],
      include: [{
        model: User, as: 'trainer', attributes: ['id', 'name', 'email'], required: false,
      }],
      order: [['id', 'DESC']],
      limit: 100,
    });

    // Batch enrollment counts for all trainings in one query
    const trainingIds = trainings.map(t => t.id);
    const enrollmentCounts = await Enrollment.findAll({
      where: { trainingId: trainingIds, status: 'ENROLLED' },
      attributes: ['trainingId', [fn('COUNT', col('id')), 'count']],
      group: ['trainingId'],
      raw: true,
    });
    const enrollMap = Object.fromEntries(enrollmentCounts.map(e => [e.trainingId, parseInt(e.count, 10)]));

    let userEnrollments = [];
    if (userId && userRole === 'PARTICIPANT') {
      userEnrollments = await Enrollment.findAll({
        where: { participantId: userId, trainingId: trainingIds, status: 'ENROLLED' },
        attributes: ['trainingId'],
        raw: true,
      });
    }
    const enrolledSet = new Set(userEnrollments.map(e => e.trainingId));

    const formatted = trainings.map(t => {
      const enrolledCount = enrollMap[t.id] || 0;
      return {
        id: t.id, title: t.title, description: t.description,
        trainerId: t.trainerId, trainerName: t.trainer?.name || null,
        trainerEmail: t.trainer?.email || null,
        startDate: t.startDate, endDate: t.endDate, capacity: t.capacity,
        enrolledCount, availableSeats: t.capacity ? t.capacity - enrolledCount : null,
        isEnrolled: enrolledSet.has(t.id),
        isFull: t.capacity ? enrolledCount >= t.capacity : false,
      };
    });

    res.json(formatted);
  } catch (error) {
    logger.error('Get trainings error', { error: error.message });
    res.status(500).json({ error: 'Server error fetching trainings' });
  }
};

const getTrainingById = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id, {
      attributes: ['id', 'title', 'description', 'trainerId', 'startDate', 'endDate', 'capacity'],
      include: [{ model: User, as: 'trainer', attributes: ['id', 'name', 'email'], required: false }],
    });
    if (!training) return res.status(404).json({ error: 'Training not found' });

    const enrolledCount = await Enrollment.count({
      where: { trainingId: training.id, status: 'ENROLLED' },
    });

    res.json({
      ...training.toJSON(), enrolledCount,
      availableSeats: training.capacity ? training.capacity - enrolledCount : null,
    });
  } catch (error) {
    logger.error('Get training by ID error', { error: error.message });
    res.status(500).json({ error: 'Server error fetching training' });
  }
};

const updateTraining = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);
    if (!training) return res.status(404).json({ error: 'Training not found' });

    const { title, description, trainerId, startDate, endDate, capacity } = req.body;
    await training.update({
      title: title || training.title,
      description: description !== undefined ? description : training.description,
      trainerId: trainerId || training.trainerId,
      startDate: startDate || training.startDate,
      endDate: endDate || training.endDate,
      capacity: capacity !== undefined ? capacity : training.capacity,
    });

    await cacheService.invalidatePattern('admin:training*');
    res.json({ message: 'Training updated successfully', training });
  } catch (error) {
    logger.error('Update training error', { error: error.message });
    res.status(500).json({ error: 'Server error updating training' });
  }
};

const deleteTraining = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);
    if (!training) return res.status(404).json({ error: 'Training not found' });

    await Enrollment.destroy({ where: { trainingId: training.id } });
    await training.destroy();

    await cacheService.invalidatePattern('admin:training*');
    res.json({ message: 'Training deleted successfully' });
  } catch (error) {
    logger.error('Delete training error', { error: error.message });
    res.status(500).json({ error: 'Server error deleting training' });
  }
};

module.exports = { createTraining, getAllTrainings, getTrainingById, updateTraining, deleteTraining };
