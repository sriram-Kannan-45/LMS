const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const CodingViolation = sequelize.define('CodingViolation', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  attemptId: { type: DataTypes.BIGINT, allowNull: false, field: 'attempt_id' },
  participantId: { type: DataTypes.BIGINT, allowNull: true, field: 'participant_id' },
  type: { type: DataTypes.ENUM('SCREEN_SHARE_STOP', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'COPY_PASTE', 'OTHER'), allowNull: false, defaultValue: 'OTHER' },
  details: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'coding_violations',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

module.exports = CodingViolation;
