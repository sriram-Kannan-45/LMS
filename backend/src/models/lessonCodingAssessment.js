const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const LessonCodingAssessment = sequelize.define('LessonCodingAssessment', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  lessonId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'lesson_id' },
  assessmentId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'assessment_id' },
  isMandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_mandatory' },
  resultStatus: { type: DataTypes.ENUM('HIDDEN', 'PUBLISHED'), allowNull: false, defaultValue: 'HIDDEN', field: 'result_status' },
  publishedAt: { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
}, {
  tableName: 'lesson_coding_assessments',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

module.exports = LessonCodingAssessment;
