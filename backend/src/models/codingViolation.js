const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const CodingViolation = sequelize.define('CodingViolation', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  attemptId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'attempt_id' },
  participantId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'participant_id' },
  type: { type: DataTypes.ENUM('SCREEN_SHARE_STOP', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'COPY_PASTE', 'OTHER'), allowNull: false, defaultValue: 'OTHER' },
  details: { type: DataTypes.TEXT, allowNull: true },
  message: { type: DataTypes.TEXT, allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
  occurredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'occurred_at' },
}, {
  tableName: 'coding_violations',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

module.exports = CodingViolation;
