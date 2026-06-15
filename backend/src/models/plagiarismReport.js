const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PlagiarismReport = sequelize.define('PlagiarismReport', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  assessmentId: { type: DataTypes.BIGINT, allowNull: false, field: 'assessment_id' },
  questionId: { type: DataTypes.BIGINT, allowNull: false, field: 'question_id' },
  participantAId: { type: DataTypes.BIGINT, allowNull: false, field: 'participant_a_id' },
  participantBId: { type: DataTypes.BIGINT, allowNull: false, field: 'participant_b_id' },
  submissionAId: { type: DataTypes.BIGINT, allowNull: false, field: 'submission_a_id' },
  submissionBId: { type: DataTypes.BIGINT, allowNull: false, field: 'submission_b_id' },
  similarityScore: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, field: 'similarity_score' },
  flagLevel: { type: DataTypes.ENUM('NONE', 'MEDIUM', 'HIGH'), allowNull: false, defaultValue: 'NONE', field: 'flag_level' },
  comparedAt: { type: DataTypes.DATE, allowNull: true, field: 'compared_at' },
}, {
  tableName: 'coding_plagiarism_reports',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

module.exports = PlagiarismReport;
