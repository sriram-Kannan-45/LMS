/**
 * SEQUELIZE DATABASE CONFIGURATION — Supabase / PostgreSQL
 *
 * Optimized for high-concurrency workloads (10,000+ concurrent users).
 * Connection pooling tuned for:
 *   - Max 50 connections (Supabase Pro tier supports 60)
 *   - 15s acquire timeout (don't wait forever for a connection)
 *   - 5s idle timeout (release unused connections quickly)
 *   - SSL required for cloud connections
 *
 * Schema is pre-created via dbscript.sql — sync is disabled.
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const DATABASE_URL = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
    // Optimize for high throughput
    application_name: 'waveinit_lms',
    // Keep idle connections alive
    keepAlive: true,
  },
  pool: {
    max: isProduction ? 50 : 10,       // Max connections in pool
    min: isProduction ? 5 : 0,          // Keep minimum connections warm
    acquire: 15000,                      // Timeout if connection cannot be acquired
    idle: 5000,                          // Close idle connections after 5s
    evict: 10000,                        // Recheck idle connections every 10s
  },
  define: {
    freezeTableName: true,
    // Don't add timestamps automatically — we manage them explicitly
    timestamps: true,
    underscored: true,
  },
  // Retry configuration for transient failures
  retry: {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeConnectionTimedOutError/,
      /SequelizeDatabaseError/,
    ],
  },
});

// ─── Connection health monitoring ──────────────────────────────────
let lastHealthCheck = Date.now();
let healthCheckInterval = null;

async function checkConnectionHealth() {
  try {
    await sequelize.authenticate();
    lastHealthCheck = Date.now();
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return false;
  }
}

// Run health check every 30 seconds
function startHealthMonitoring() {
  if (healthCheckInterval) return;
  healthCheckInterval = setInterval(() => {
    checkConnectionHealth().catch(() => {});
  }, 30000).unref();
}

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connected successfully', {
      pool: {
        max: sequelize.config.pool.max,
        min: sequelize.config.pool.min,
      },
    });

    // Start health monitoring in production
    if (isProduction) {
      startHealthMonitoring();
    }

    return sequelize;
  } catch (error) {
    logger.error('Database connection failed', {
      error: error.message,
      code: error.code,
    });
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB, checkConnectionHealth };
