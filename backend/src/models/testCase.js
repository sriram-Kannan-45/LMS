const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const TestCase = sequelize.define('TestCase', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  questionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'question_id' },
  input: { type: DataTypes.TEXT, allowNull: true },
  expectedOutput: { type: DataTypes.TEXT, allowNull: true, field: 'expected_output' },
  isHidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_hidden' },
}, {
  tableName: 'coding_test_cases',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

module.exports = TestCase;
