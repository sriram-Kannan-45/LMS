const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SubmissionResult = sequelize.define('SubmissionResult', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  submissionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'submission_id' },
  testCaseId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'test_case_id' },
  status: { type: DataTypes.ENUM('PASSED', 'FAILED', 'TLE', 'CE', 'RE', 'MLE'), allowNull: false, defaultValue: 'FAILED' },
  runtimeMs: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'runtime_ms' },
  memoryKb: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'memory_kb' },
  actualOutput: { type: DataTypes.TEXT, allowNull: true, field: 'actual_output' },
  errorMessage: { type: DataTypes.TEXT, allowNull: true, field: 'error_message' },
  isHidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_hidden' },
}, {
  tableName: 'coding_submission_results',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

module.exports = SubmissionResult;
