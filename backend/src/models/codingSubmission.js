const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const CodingSubmission = sequelize.define('CodingSubmission', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  attemptId: { type: DataTypes.BIGINT, allowNull: false, field: 'attempt_id' },
  questionId: { type: DataTypes.BIGINT, allowNull: false, field: 'question_id' },
  participantId: { type: DataTypes.BIGINT, allowNull: false, field: 'participant_id' },
  language: { type: DataTypes.STRING, allowNull: false },
  sourceCode: { type: DataTypes.TEXT('long'), allowNull: false, field: 'source_code' },
  status: { type: DataTypes.ENUM('PENDING', 'PASSED', 'FAILED', 'PARTIAL', 'CE', 'RE', 'TLE', 'MLE'), allowNull: false, defaultValue: 'PENDING' },
  score: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  passedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'passed_count' },
  totalCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'total_count' },
  isFinal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_final' },
  aiReview: { type: DataTypes.JSON, allowNull: true, field: 'ai_review' },
}, {
  tableName: 'coding_submissions',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

module.exports = CodingSubmission;
