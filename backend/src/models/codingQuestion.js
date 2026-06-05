const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const CodingQuestion = sequelize.define('CodingQuestion', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  assessmentId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'assessment_id' },
  title: { type: DataTypes.STRING, allowNull: false },
  problemDescription: { type: DataTypes.TEXT, allowNull: false, field: 'problem_description' },
  inputFormat: { type: DataTypes.TEXT, allowNull: true, field: 'input_format' },
  outputFormat: { type: DataTypes.TEXT, allowNull: true, field: 'output_format' },
  constraints: { type: DataTypes.TEXT, allowNull: true },
  sampleInput: { type: DataTypes.TEXT, allowNull: true, field: 'sample_input' },
  sampleOutput: { type: DataTypes.TEXT, allowNull: true, field: 'sample_output' },
  explanation: { type: DataTypes.TEXT, allowNull: true },
  difficulty: { type: DataTypes.ENUM('easy', 'medium', 'hard'), allowNull: false, defaultValue: 'medium' },
  marks: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
  tags: { type: DataTypes.JSON, allowNull: true },
  order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'coding_questions',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

module.exports = CodingQuestion;
