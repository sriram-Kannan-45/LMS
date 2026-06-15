const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * AIQuiz
 * ──────
 * Course-scoped after the restructure. A quiz is always tied to one course
 * (course_id); it MAY also be linked to a specific lesson within that course
 * (lesson_id, optional) — when null the quiz is considered course-level.
 *
 * Visibility rule: participants see a quiz only when they are enrolled in the
 * quiz's course. result_status gates whether participants can see their
 * scores after submission.
 *
 * Legacy columns (document_id, time_limit, num_questions, difficulty,
 * is_active, training_id) are kept nullable for backward compatibility with
 * the existing aiQuizRoutes.js / TrainerAIQuiz.jsx flow and will be either
 * dropped or repurposed in a later cleanup pass.
 */
const AIQuiz = sequelize.define('AIQuiz', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true
  },

  // ── New course-centric columns ──
  courseId: {
    type: DataTypes.BIGINT,
    // Nullable while legacy quizzes (trainingId-only) still exist.
    allowNull: true,
    field: 'course_id'
  },
  lessonId: {
    type: DataTypes.BIGINT,
    // Optional — quizzes can live at the course level (no specific lesson).
    allowNull: true,
    field: 'lesson_id'
  },
  resultStatus: {
    type: DataTypes.ENUM('HIDDEN', 'PUBLISHED'),
    allowNull: false,
    defaultValue: 'HIDDEN',
    field: 'result_status'
  },
  isMandatory: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_mandatory'
  },

  // ── Existing columns (preserved for compatibility) ──
  documentId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'document_id'
  },
  trainerId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'trainer_id'
  },
  trainingId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'training_id'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  timeLimit: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 30,
    field: 'time_limit'
  },
  numQuestions: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'num_questions'
  },
  difficulty: {
    type: DataTypes.ENUM('EASY', 'MEDIUM', 'HARD', 'MIXED'),
    allowNull: false,
    defaultValue: 'MIXED'
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'CLOSED'),
    allowNull: false,
    defaultValue: 'DRAFT'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'ai_quizzes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
  // Indexes on course_id / lesson_id / result_status added later by
  // bootstrapCourseSchema.js once the per-model sync has created the
  // columns.
});

module.exports = AIQuiz;
