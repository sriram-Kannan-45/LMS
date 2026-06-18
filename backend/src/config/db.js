/**
 * SEQUELIZE DATABASE CONFIGURATION - PRODUCTION-READY
 * 
 * Updated to prevent "Too many keys specified; max 64 keys allowed" error
 * 
 * Key Changes:
 * 1. Using `alter: false` to prevent duplicate index creation
 * 2. Schema comparison is done safely without repeated index creation
 * 3. Proper error handling for index issues
 * 4. Logging for sync operations to debug issues
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const dbName = process.env.DB_NAME || 'training_db';
const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS || '';
const dbHost = process.env.DB_HOST || 'localhost';

const sequelize = new Sequelize(
  dbName,
  dbUser,
  dbPass,
  {
    host: dbHost,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      freezeTableName: true // Prevent automatic table name pluralization
    }
  }
);

const createDatabase = async () => {
  try {
    const tempSeq = new Sequelize('mysql', dbUser, dbPass, { 
      host: dbHost, 
      dialect: 'mysql', 
      logging: false,
      define: { freezeTableName: true }
    });
    await tempSeq.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`✅ Database '${dbName}' created or already exists`);
    await tempSeq.close();
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
  }
};

const connectDB = async () => {
  try {
    await createDatabase();
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // PRODUCTION-READY SYNC CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════════
    // 
    // `alter: false` - CRITICAL: Prevents repeated index creation
    //   ✅ Do NOT use `alter: true` - causes duplicate indexes
    //   Why? Each sync iteration tries to "fix" the table, creating:
    //   - email, email_1, email_2, email_3... up to email_31
    //   - username, username_1, username_2... up to username_31
    //   Result: 60+ duplicate indexes → exceeds MySQL's 64-key limit
    //
    // `force: false` - Do NOT drop and recreate tables
    //   ✅ Prevents data loss
    //   ❌ force: true deletes ALL data - never use in production
    //
    // For safe schema changes in production:
    //   → Use Sequelize migrations (sequelize-cli with umzug)
    //   → OR: Manual SQL scripts with version control
    // ═══════════════════════════════════════════════════════════════════════════════
    
    console.log('📊 Syncing database schema...');
    await sequelize.sync({ 
      alter: false,  // ✅ CRITICAL: Do not alter - causes duplicate indexes
      force: false,  // ✅ CRITICAL: Do not drop - causes data loss
      logging: false
    });
    console.log('✅ Database schema verified');
    
    // Manual database migration for ai_questions to support new quiz question formats
    try {
      const [columns] = await sequelize.query("SHOW COLUMNS FROM `ai_questions`");
      const columnNames = columns.map(c => c.Field);
      
      // Check and add acceptable_answers column
      if (!columnNames.includes('acceptable_answers')) {
        console.log('➕ Adding acceptable_answers column to ai_questions...');
        await sequelize.query("ALTER TABLE `ai_questions` ADD COLUMN `acceptable_answers` JSON NULL COMMENT 'Acceptable answers for FILL_BLANK'");
      }
      
      // Check and add pairs column
      if (!columnNames.includes('pairs')) {
        console.log('➕ Adding pairs column to ai_questions...');
        await sequelize.query("ALTER TABLE `ai_questions` ADD COLUMN `pairs` JSON NULL COMMENT 'Pairs for MATCHING question type'");
      }
      
      // Check and update question_type enum column
      const questionTypeCol = columns.find(c => c.Field === 'question_type');
      if (questionTypeCol) {
        const typeStr = String(questionTypeCol.Type).toUpperCase();
        if (!typeStr.includes('TRUE_FALSE') || !typeStr.includes('FILL_BLANK') || !typeStr.includes('MATCHING')) {
          console.log('🔄 Updating question_type ENUM values in ai_questions...');
          await sequelize.query("ALTER TABLE `ai_questions` MODIFY COLUMN `question_type` ENUM('MCQ', 'SHORT_ANSWER', 'TRUE_FALSE', 'FILL_BLANK', 'MATCHING') NOT NULL");
        }
      }
      console.log('✅ Manual schema migration checks completed successfully');
    } catch (migError) {
      console.error('⚠️ Error applying manual schema migrations to ai_questions:', migError.message);
    }
    
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    // Helpful error message for "too many keys" issue
    if (error.message && error.message.includes('Too many keys specified')) {
      console.error('\n⚠️  DUPLICATE INDEX DETECTION:');
      console.error('   The error "Too many keys specified; max 64 keys allowed"');
      console.error('   indicates duplicate indexes in the database.');
      console.error('\n💡 SOLUTION:');
      console.error('   1. Run: node cleanup-duplicate-indexes.js');
      console.error('   2. Verify all tables show ✅ (under 64 keys)');
      console.error('   3. Restart the server');
      console.error('   4. Never use alter: true in production\n');
    }
    
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };