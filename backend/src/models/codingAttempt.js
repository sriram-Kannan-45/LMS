const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const CodingAttempt = sequelize.define('CodingAttempt', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  assessmentId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'assessment_id' },
  participantId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'participant_id' },
  status: { type: DataTypes.ENUM('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'EXPIRED'), allowNull: false, defaultValue: 'IN_PROGRESS' },
  score: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  violationCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'violation_count' },
  submittedAt: { type: DataTypes.DATE, allowNull: true, field: 'submitted_at' },
}, {
  tableName: 'coding_attempts',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

module.exports = CodingAttempt;
