/**
 * SEQUELIZE DATABASE CONFIGURATION — Supabase / PostgreSQL
 * 
 * Connects to Supabase using DATABASE_URL from .env.
 * Schema is pre-created via dbscript.sql — sync is disabled.
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL;

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    freezeTableName: true
  }
});

const connectDB = async () => {
  try {
    console.log('🔍 DEBUG: DATABASE_URL exists:', !!DATABASE_URL);
    console.log('🔍 DEBUG: DATABASE_URL prefix:', DATABASE_URL ? DATABASE_URL.substring(0, 30) + '...' : 'MISSING');
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    // Schema is managed via manual SQL migrations (dbscript.sql).
    // sequelize.sync is disabled to avoid accidental schema changes.
    // Uncomment below only if you want Sequelize to manage the schema.
    //
    // await sequelize.sync({ alter: false, force: false });
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('🔍 DEBUG: Error name:', error.name);
    console.error('🔍 DEBUG: Error code:', error.code);
    console.error('🔍 DEBUG: Error stack:', error.stack);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };