const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const CodingAssessment = sequelize.define('CodingAssessment', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  courseId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'course_id' },
  lessonId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'lesson_id' },
  trainerId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'trainer_id' },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  timeLimit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60, field: 'time_limit' },
  status: { type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'CLOSED'), allowNull: false, defaultValue: 'DRAFT' },
  resultStatus: { type: DataTypes.ENUM('HIDDEN', 'PUBLISHED'), allowNull: false, defaultValue: 'HIDDEN', field: 'result_status' },
  trainingId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'training_id' },
  durationMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60, field: 'duration_minutes' },
  passingScore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50, field: 'passing_score' },
  difficulty: { type: DataTypes.ENUM('easy', 'medium', 'hard'), allowNull: false, defaultValue: 'medium' },
  language: { type: DataTypes.STRING, allowNull: false, defaultValue: 'javascript' },
  isProctored: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_proctored' },
  maxViolations: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3, field: 'max_violations' },
}, {
  tableName: 'coding_assessments',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

module.exports = CodingAssessment;
