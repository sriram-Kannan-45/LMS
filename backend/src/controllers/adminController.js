const { Op, fn, col, literal } = require('sequelize');
const { Training, Enrollment, Feedback, User, Notification, Course, Lesson, LiveSession, AIQuiz, AIDocument, Note, SurveyQuestion, LessonMaterial, LessonQuiz, LessonAssessment, AssessmentSubmission, LessonProgress, QuizProgress, AIQuestion, QuizAttempt, QuizResult, CourseTrainerAssignment } = require('../models');
const ActivityService = require('../services/activityService');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

/**
 * GET /api/admin/stats — Aggregated dashboard statistics
 * Cached for 2 minutes to reduce DB load on dashboard refresh.
 * Uses a single parallelized query pattern instead of N sequential queries.
 */
const getStats = async (req, res) => {
  try {
    const cacheKey = 'admin:stats';

    const stats = await cacheService.getOrSet(cacheKey, async () => {
      // Parallelize all independent count/aggregate queries
      const [
        totalTrainings,
        totalTrainers,
        totalParticipants,
        totalEnrollments,
        totalFeedbacks,
        pendingParticipants,
        completedTrainings,
      ] = await Promise.all([
        Training.count(),
        User.count({ where: { role: 'TRAINER' } }),
        User.count({ where: { role: 'PARTICIPANT' } }),
        Enrollment.count({ where: { status: 'ENROLLED' } }),
        Feedback.count(),
        User.count({ where: { role: 'PARTICIPANT', status: 'PENDING' } }),
        Training.count({
          where: { endDate: { [Op.lt]: new Date() } }
        }),
      ]);

      // Single aggregate query for ratings instead of loading all rows
      const ratingStats = await Feedback.findAll({
        attributes: [
          [fn('AVG', col('trainerRating')), 'avgTrainerRating'],
          [fn('AVG', col('subjectRating')), 'avgSubjectRating'],
          [fn('COUNT', col('id')), 'count'],
        ],
        raw: true,
      });

      const avgTrainerRating = ratingStats[0]?.avgTrainerRating
        ? parseFloat(ratingStats[0].avgTrainerRating).toFixed(1)
        : 0;
      const avgSubjectRating = ratingStats[0]?.avgSubjectRating
        ? parseFloat(ratingStats[0].avgSubjectRating).toFixed(1)
        : 0;
      const satisfactionScore = ((parseFloat(avgTrainerRating) + parseFloat(avgSubjectRating)) / 2).toFixed(1);

      // Optimized rating distribution using GROUP BY
      const distribution = await Feedback.findAll({
        attributes: ['trainerRating', [fn('COUNT', col('id')), 'count']],
        group: ['trainerRating'],
        raw: true,
      });

      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      distribution.forEach(r => {
        ratingDistribution[r.trainerRating] = parseInt(r.count, 10);
      });

      const activeTrainings = totalTrainings - completedTrainings;
      const enrollmentRate = totalParticipants > 0
        ? ((totalEnrollments / totalParticipants) * 100).toFixed(1)
        : 0;

      const { Note } = require('../models');
      const pendingNotes = await Note.count({ where: { status: 'PENDING' } });

      return {
        totalTrainings, completedTrainings, activeTrainings,
        totalTrainers, totalParticipants, pendingParticipants,
        totalEnrollments, totalFeedbacks, pendingNotes,
        avgTrainerRating, avgSubjectRating, satisfactionScore,
        ratingDistribution, enrollmentRate,
      };
    }, 120); // Cache for 2 minutes

    res.json({ success: true, ...stats, data: stats });
  } catch (error) {
    logger.error('Get stats error', { error: error.message });
    res.status(500).json({ success: false, error: 'Server error fetching stats' });
  }
};

const getParticipants = async (req, res) => {
  try {
    const { search = '', status = '', limit = 50, offset = 0 } = req.query;
    const where = { role: 'PARTICIPANT' };

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const [participants, total] = await Promise.all([
      User.findAll({
        where,
        attributes: { exclude: ['password'] },
        order: [['created_at', 'DESC']],
        limit: Math.min(parseInt(limit), 100),
        offset: parseInt(offset),
      }),
      User.count({ where }),
    ]);

    const formattedParticipants = participants.map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      username: p.username,
      status: p.status,
      joinedAt: p.createdAt || p.dataValues?.created_at,
    }));

    res.json({
      success: true,
      participants: formattedParticipants,
      total,
      hasMore: parseInt(offset) + parseInt(limit) < total,
    });
  } catch (error) {
    logger.error('Get participants error', { error: error.message });
    res.status(500).json({ success: false, error: 'Server error fetching participants' });
  }
};

const getTrainingStats = async (req, res) => {
  try {
    const cacheKey = 'admin:training-stats';
    const result = await cacheService.getOrSet(cacheKey, async () => {
      const trainings = await Training.findAll({
        include: [{ model: User, as: 'trainer', attributes: ['name'], required: false }],
        order: [['id', 'DESC']],
      });

      // Batch all enrollment and feedback counts
      const trainingIds = trainings.map(t => t.id);

      const [enrollmentCounts, feedbackCounts, feedbackRatings] = await Promise.all([
        Enrollment.findAll({
          where: { trainingId: trainingIds, status: 'ENROLLED' },
          attributes: ['trainingId', [fn('COUNT', col('id')), 'count']],
          group: ['trainingId'],
          raw: true,
        }),
        Feedback.findAll({
          where: { trainingId: trainingIds },
          attributes: ['trainingId', [fn('COUNT', col('id')), 'count']],
          group: ['trainingId'],
          raw: true,
        }),
        Feedback.findAll({
          where: { trainingId: trainingIds },
          attributes: [
            'trainingId',
            [fn('AVG', col('trainerRating')), 'avgTrainer'],
            [fn('AVG', col('subjectRating')), 'avgSubject'],
          ],
          group: ['trainingId'],
          raw: true,
        }),
      ]);

      const enrollMap = Object.fromEntries(enrollmentCounts.map(e => [e.trainingId, parseInt(e.count, 10)]));
      const feedbackMap = Object.fromEntries(feedbackCounts.map(f => [f.trainingId, parseInt(f.count, 10)]));
      const ratingMap = Object.fromEntries(feedbackRatings.map(r => [r.trainingId, r]));

      return trainings.map(t => {
        const now = new Date();
        const start = new Date(t.startDate);
        const end = new Date(t.endDate);
        const status = now < start ? 'Upcoming' : now > end ? 'Completed' : 'Ongoing';
        const ratings = ratingMap[t.id] || {};

        return {
          id: t.id, title: t.title, trainerName: t.trainer?.name || 'Unassigned',
          startDate: t.startDate, endDate: t.endDate, capacity: t.capacity,
          enrolledCount: enrollMap[t.id] || 0,
          feedbackCount: feedbackMap[t.id] || 0,
          avgTrainerRating: ratings.avgTrainer ? parseFloat(ratings.avgTrainer).toFixed(1) : null,
          avgSubjectRating: ratings.avgSubject ? parseFloat(ratings.avgSubject).toFixed(1) : null,
          status,
        };
      });
    }, 120);

    res.json({ trainings: result });
  } catch (error) {
    logger.error('Training stats error', { error: error.message });
    res.status(500).json({ error: 'Server error fetching training stats' });
  }
};

// ─── Unchanged functions below (no performance regression) ────────────

const updateTraining = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, trainerId, startDate, endDate, capacity } = req.body;

    const training = await Training.findByPk(id);
    if (!training) return res.status(404).json({ error: 'Training not found' });

    if (trainerId) {
      const trainer = await User.findOne({ where: { id: trainerId, role: 'TRAINER' } });
      if (!trainer) return res.status(400).json({ error: 'Invalid trainer ID' });
    }

    await training.update({
      title: title || training.title,
      description: description !== undefined ? description : training.description,
      trainerId: trainerId ? parseInt(trainerId) : training.trainerId,
      startDate: startDate ? new Date(startDate) : training.startDate,
      endDate: endDate ? new Date(endDate) : training.endDate,
      capacity: capacity !== undefined ? (capacity ? parseInt(capacity) : null) : training.capacity,
    });

    // Invalidate training caches
    await cacheService.invalidatePattern('admin:training*');

    const updatedTraining = await Training.findByPk(id, {
      include: [{ model: User, as: 'trainer', attributes: ['id', 'name'], required: false }],
    });

    res.json({
      message: 'Training updated successfully',
      training: {
        id: updatedTraining.id,
        title: updatedTraining.title,
        description: updatedTraining.description,
        trainerId: updatedTraining.trainerId,
        trainerName: updatedTraining.trainer?.name,
        startDate: updatedTraining.startDate,
        endDate: updatedTraining.endDate,
        capacity: updatedTraining.capacity,
      },
    });
  } catch (error) {
    logger.error('Update training error', { error: error.message });
    res.status(500).json({ error: 'Server error updating training' });
  }
};

const deleteTraining = async (req, res) => {
  try {
    const { id } = req.params;
    const training = await Training.findByPk(id);
    if (!training) return res.status(404).json({ error: 'Training not found' });

    // Delete courses (and their cascade: lessons, materials, quizzes, etc.)
    const courses = await Course.findAll({ where: { trainingProgramId: id }, attributes: ['id'] });
    const courseIds = courses.map(c => c.id);

    if (courseIds.length > 0) {
      const lessons = await Lesson.findAll({ where: { courseId: { [Op.in]: courseIds } }, attributes: ['id'] });
      const lessonIds = lessons.map(l => l.id);
      const quizzes = await AIQuiz.findAll({ where: { courseId: { [Op.in]: courseIds } }, attributes: ['id'] });
      const quizIds = quizzes.map(q => q.id);
      const assessments = lessonIds.length === 0 ? [] : await LessonAssessment.findAll({
        where: { lessonId: { [Op.in]: lessonIds } }, attributes: ['id'],
      });
      const assessmentIds = assessments.map(a => a.id);

      if (assessmentIds.length > 0) {
        await AssessmentSubmission.destroy({ where: { assessmentId: { [Op.in]: assessmentIds } } });
      }
      if (lessonIds.length > 0) {
        await Promise.all([
          LessonMaterial.destroy({   where: { lessonId: { [Op.in]: lessonIds } } }),
          LessonAssessment.destroy({ where: { lessonId: { [Op.in]: lessonIds } } }),
          LessonProgress.destroy({   where: { lessonId: { [Op.in]: lessonIds } } }),
          LessonQuiz.destroy({       where: { lessonId: { [Op.in]: lessonIds } } }),
        ]);
      }
      if (quizIds.length > 0) {
        const attempts = await QuizAttempt.findAll({ where: { quizId: { [Op.in]: quizIds } }, attributes: ['id'] });
        const attemptIds = attempts.map(a => a.id);
        if (attemptIds.length > 0) {
          const { QuizAnswer } = require('../models');
          await QuizAnswer.destroy({ where: { attemptId: { [Op.in]: attemptIds } } });
          await QuizResult.destroy({ where: { attemptId: { [Op.in]: attemptIds } } });
        }
        await Promise.all([
          QuizAttempt.destroy({ where: { quizId: { [Op.in]: quizIds } } }),
          AIQuestion.destroy({  where: { quizId: { [Op.in]: quizIds } } }),
          LessonQuiz.destroy({  where: { quizId: { [Op.in]: quizIds } } }),
        ]);
      }

      await Promise.all([
        Lesson.destroy({       where: { courseId: { [Op.in]: courseIds } } }),
        AIQuiz.destroy({       where: { courseId: { [Op.in]: courseIds } } }),
        Enrollment.destroy({   where: { courseId: { [Op.in]: courseIds } } }),
        CourseTrainerAssignment.destroy({ where: { courseId: { [Op.in]: courseIds } } }),
      ]);
      await Course.destroy({ where: { id: { [Op.in]: courseIds } } });
    }

    // Delete legacy training-scoped records
    await Promise.all([
      Feedback.destroy({      where: { trainingId: id } }),
      Enrollment.destroy({    where: { trainingId: id } }),
      Lesson.destroy({        where: { trainingId: id } }),
      LiveSession.destroy({   where: { trainingId: id } }),
      AIQuiz.destroy({        where: { trainingId: id } }),
      AIDocument.destroy({    where: { trainingId: id } }),
      Note.destroy({          where: { trainingId: id } }),
      SurveyQuestion.destroy({ where: { trainingId: id } }),
    ]);

    await Training.destroy({ where: { id } });

    await cacheService.invalidatePattern('admin:training*');
    await cacheService.invalidatePattern('admin:stats');

    res.json({ message: 'Training deleted successfully' });
  } catch (error) {
    logger.error('Delete training error', { error: error.message });
    res.status(500).json({ error: 'Server error deleting training' });
  }
};

const updateTrainer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    const trainer = await User.findOne({ where: { id, role: 'TRAINER' } });
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

    if (email && email !== trainer.email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) return res.status(400).json({ error: 'Email already in use' });
    }

    await trainer.update({ name: name || trainer.name, email: email || trainer.email });

    res.json({
      message: 'Trainer updated successfully',
      trainer: { id: trainer.id, name: trainer.name, email: trainer.email, username: trainer.username },
    });
  } catch (error) {
    logger.error('Update trainer error', { error: error.message });
    res.status(500).json({ error: 'Server error updating trainer' });
  }
};

const deleteTrainer = async (req, res) => {
  try {
    const { id } = req.params;
    const trainer = await User.findOne({ where: { id, role: 'TRAINER' } });
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

    await Training.update({ trainerId: null }, { where: { trainerId: id } });
    await User.destroy({ where: { id } });

    res.json({ message: 'Trainer deleted successfully' });
  } catch (error) {
    logger.error('Delete trainer error', { error: error.message });
    res.status(500).json({ error: 'Server error deleting trainer' });
  }
};

const sendReminders = async (req, res) => {
  try {
    const { trainingId } = req.params;
    const training = await Training.findByPk(trainingId);
    if (!training) return res.status(404).json({ error: 'Training not found' });

    const enrollments = await Enrollment.findAll({
      where: { trainingId, status: 'ENROLLED' },
      attributes: ['participantId'],
    });

    const participantIds = enrollments.map(e => e.participantId);
    const feedbacks = await Feedback.findAll({
      where: { trainingId },
      attributes: ['participantId'],
    });
    const submittedIds = feedbacks.map(f => f.participantId);
    const pendingIds = participantIds.filter(id => !submittedIds.includes(id));

    if (pendingIds.length === 0) {
      return res.json({ message: 'No pending feedbacks for this training.' });
    }

    const notifications = pendingIds.map(userId => ({
      userId,
      message: `Reminder: Please submit your feedback for the training "${training.title}".`,
      isRead: false,
    }));

    await Notification.bulkCreate(notifications);
    res.json({ message: `Sent ${notifications.length} reminders.` });
  } catch (error) {
    logger.error('Send reminders error', { error: error.message });
    res.status(500).json({ error: 'Server error sending reminders' });
  }
};

const deleteParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const participant = await User.findOne({ where: { id, role: 'PARTICIPANT' } });
    if (!participant) return res.status(404).json({ error: 'Participant not found' });
    await Enrollment.destroy({ where: { participantId: id } });
    await Feedback.destroy({ where: { participantId: id } });
    await User.destroy({ where: { id } });
    res.json({ message: 'Participant removed successfully' });
  } catch (error) {
    logger.error('Delete participant error', { error: error.message });
    res.status(500).json({ error: 'Server error deleting participant' });
  }
};

const exportFeedbacksCSV = async (req, res) => {
  try {
    const feedbacks = await Feedback.findAll({
      include: [
        { model: Training, as: 'training', attributes: ['id', 'title'], include: [{ model: User, as: 'trainer', attributes: ['name'] }] },
        { model: User, as: 'participant', attributes: ['id', 'name', 'email'] },
      ],
      order: [['submitted_at', 'DESC']],
    });

    const rows = [
      ['ID', 'Training', 'Trainer', 'Participant', 'Trainer Rating', 'Subject Rating', 'Comments', 'Anonymous', 'Date'].join(','),
    ];
    feedbacks.forEach(f => {
      const pName = f.anonymous ? 'Anonymous' : (f.participant?.name || '');
      const row = [
        f.id,
        `"${f.training?.title || ''}"`,
        `"${f.training?.trainer?.name || ''}"`,
        `"${pName}"`,
        f.trainerRating,
        f.subjectRating,
        `"${(f.comments || '').replace(/"/g, "'")}"`,
        f.anonymous ? 'Yes' : 'No',
        f.submitted_at ? new Date(f.submitted_at).toLocaleDateString('en-IN') : '',
      ].join(',');
      rows.push(row);
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="feedback_export.csv"');
    res.send(rows.join('\n'));
  } catch (error) {
    logger.error('Export CSV error', { error: error.message });
    res.status(500).json({ error: 'Server error exporting feedbacks' });
  }
};

const getPendingParticipants = async (req, res) => {
  try {
    const pendingParticipants = await User.findAll({
      where: { role: 'PARTICIPANT', status: 'PENDING' },
      attributes: { exclude: ['password'] },
      order: [['id', 'DESC']],
    });

    const formattedParticipants = pendingParticipants.map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      username: p.username,
      appliedAt: p.createdAt,
    }));

    res.json({ participants: formattedParticipants, total: formattedParticipants.length });
  } catch (error) {
    logger.error('Get pending participants error', { error: error.message });
    res.status(500).json({ error: 'Server error fetching pending participants' });
  }
};

const approveParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const participant = await User.findOne({ where: { id, role: 'PARTICIPANT', status: 'PENDING' } });

    if (!participant) {
      return res.status(404).json({ error: 'Pending participant not found' });
    }

    await participant.update({ status: 'APPROVED' });

    const io = req.app.get('io');
    await ActivityService.logActivity({
      userId: req.user.id,
      userName: req.user.name || 'Admin',
      action: 'USER_APPROVED',
      entityType: 'User',
      entityId: participant.id,
      details: { targetUserName: participant.name },
    }, io);

    await Notification.create({
      userId: participant.id,
      message: 'Your account has been approved. You can now log in.',
      type: 'APPROVAL',
      isRead: false,
    });

    res.json({
      message: 'Participant approved successfully',
      participant: {
        id: participant.id,
        name: participant.name,
        email: participant.email,
        status: participant.status,
      },
    });
  } catch (error) {
    logger.error('Approve participant error', { error: error.message });
    res.status(500).json({ error: 'Server error approving participant' });
  }
};

const rejectParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const participant = await User.findOne({ where: { id, role: 'PARTICIPANT', status: 'PENDING' } });

    if (!participant) {
      return res.status(404).json({ error: 'Pending participant not found' });
    }

    await Enrollment.destroy({ where: { participantId: id } });
    await Feedback.destroy({ where: { participantId: id } });
    await User.destroy({ where: { id } });

    res.json({ message: 'Participant rejected and removed successfully' });
  } catch (error) {
    logger.error('Reject participant error', { error: error.message });
    res.status(500).json({ error: 'Server error rejecting participant' });
  }
};

module.exports = {
  updateTraining, deleteTraining, updateTrainer, deleteTrainer,
  getStats, getParticipants, sendReminders, deleteParticipant,
  exportFeedbacksCSV, getTrainingStats, getPendingParticipants,
  approveParticipant, rejectParticipant,
};
