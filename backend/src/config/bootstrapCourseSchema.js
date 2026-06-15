/**
 * bootstrapCourseSchema.js
 * ─────────────────────────
 * One-shot, idempotent migration helper called from app.js at boot.
 *
 * Performs the structural changes that `Model.sync({ alter: true })` cannot
 * do safely on its own:
 *
 *   1. Rename `trainings` → `training_programs` if the legacy table is
 *      present and the new one isn't.
 *   2. If both tables exist (e.g. boot crashed mid-rename), drop the empty
 *      `training_programs` and rename. If both are populated, leave alone
 *      and warn loudly — that's a manual-intervention case.
 *
 * After this runs, the per-model `sync({ alter: true })` calls in app.js
 * will add the new columns (course_id, lesson_id, result_status, etc.) and
 * create the new tables (courses, lesson_materials,
 * course_trainer_assignments).
 *
 * Idempotent: every step checks current state via information_schema.
 */
const { sequelize } = require('../config/db');

async function tableExists(name) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ?`,
    { replacements: [name] }
  );
  return rows[0].c > 0;
}

async function rowCount(name) {
  try {
    const [rows] = await sequelize.query(
      `SELECT COUNT(*) AS c FROM "${name}"`
    );
    return rows[0].c;
  } catch {
    return 0;
  }
}

async function bootstrapCourseSchema(logger = console) {
  const hasOld = await tableExists('trainings');
  const hasNew = await tableExists('training_programs');

  // PostgreSQL handles FK dependencies gracefully — no DISABLE/ENABLE needed.
  // The DROP TABLE will cascade where defined, or fail with a clear error.

  if (hasOld && !hasNew) {
    logger.info('[course-schema] renaming trainings → training_programs');
    await sequelize.query('ALTER TABLE trainings RENAME TO training_programs');
    return { renamed: true };
  }

  if (hasOld && hasNew) {
    const oldCount = await rowCount('trainings');
    const newCount = await rowCount('training_programs');

    if (oldCount === 0) {
      logger.info('[course-schema] dropping empty legacy trainings table');
      await sequelize.query('DROP TABLE IF EXISTS trainings');
      return { droppedEmptyLegacy: true };
    }
    if (newCount === 0) {
      logger.info(
        '[course-schema] dropping empty training_programs then renaming legacy table'
      );
      await sequelize.query('DROP TABLE IF EXISTS training_programs');
      await sequelize.query('ALTER TABLE trainings RENAME TO training_programs');
      return { renamed: true };
    }
    logger.warn(
      '[course-schema] BOTH trainings and training_programs are populated. ' +
      'Manual reconciliation required — leaving as-is.'
    );
    return { conflict: true };
  }

  return { noop: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Index helpers — applied AFTER per-model sync({alter:true}) has added the
// new columns. Wrapped in try/catch so re-runs (index already exists) don't
// crash boot.
// ─────────────────────────────────────────────────────────────────────────────

async function indexExists(table, indexName) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ?
        AND indexname = ?`,
    { replacements: [table, indexName] }
  );
  return rows[0].c > 0;
}

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ?
        AND column_name = ?`,
    { replacements: [table, column] }
  );
  return rows[0].c > 0;
}

async function columnIsNullable(table, column) {
  const [rows] = await sequelize.query(
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ?
        AND column_name = ?`,
    { replacements: [table, column] }
  );
  return rows.length > 0 && rows[0].is_nullable === 'YES';
}

/**
 * Pre-sync alters that Sequelize's diff cannot do cleanly.
 *
 * Two passes:
 *   (1) Explicit list — columns that the new model declarations have flipped
 *       from NOT NULL → NULL, but the DB column hasn't been altered yet.
 *       Without this, Sequelize emits ALTER TABLE that races with the FK
 *       constraint update and fails with "Column 'X' cannot be NOT NULL:
 *       needed in a foreign key constraint Y SET NULL".
 *   (2) Generic scan — any FK in the schema with ON DELETE/UPDATE = SET NULL
 *       on a still-NOT-NULL column. Catches inconsistent legacy state.
 *
 * Idempotent and safe to run on every boot.
 */
async function relaxLegacyTrainingIdColumns(logger = console) {
  // (1) Explicit pre-relax targets — see column nullability changes in
  //     models/lesson.js, aiQuiz.js, enrollment.js, training.js.
  const explicitTargets = [
    { table: 'lessons',           column: 'training_id' },
    { table: 'enrollments',       column: 'training_id' },
    { table: 'ai_quizzes',        column: 'training_id' },
    { table: 'ai_quizzes',        column: 'document_id' },
    { table: 'training_programs', column: 'trainer_id'  },
  ];

  for (const { table, column } of explicitTargets) {
    if (!(await tableExists(table))) continue;
    if (!(await columnExists(table, column))) continue;
    if (await columnIsNullable(table, column)) continue;

    try {
      await sequelize.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP NOT NULL`
      );
      logger.info(`[course-schema] relaxed ${table}.${column} → NULL (explicit)`);
    } catch (e) {
      logger.warn(
        `[course-schema] could not relax ${table}.${column}: ${e.message}`
      );
    }
  }

  // (2) Generic scan — any FK with SET NULL action on a still-NOT-NULL column.
  // PostgreSQL stores this in pg_constraint + information_schema.
  const [rows] = await sequelize.query(
    `
    SELECT
      c.conname                          AS "constraintName",
      c.confdeltype                      AS "onDelete",
      c.confupdtype                      AS "onUpdate",
      ta.attname                         AS "columnName",
      cls.relname                        AS "tableName",
      cols.is_nullable                   AS "isNullable"
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_attribute ta ON ta.attrelid = c.conrelid AND ta.attnum = c.conkey[1]
    JOIN information_schema.columns cols
      ON cols.table_name = cls.relname
     AND cols.column_name = ta.attname
     AND cols.table_schema = 'public'
    WHERE c.contype = 'f'
      AND (c.confdeltype = 'n' OR c.confupdtype = 'n')
      AND cols.is_nullable = 'NO'
    `
  );

  for (const r of rows) {
    try {
      await sequelize.query(
        `ALTER TABLE "${r.tableName}" ALTER COLUMN "${r.columnName}" DROP NOT NULL`
      );
      logger.info(
        `[course-schema] relaxed ${r.tableName}.${r.columnName} → NULL ` +
        `(scan: FK ${r.constraintName} ${r.onDelete === 'n' ? 'SET NULL' : '?'}/` +
        `${r.onUpdate === 'n' ? 'SET NULL' : '?'})`
      );
    } catch (e) {
      logger.warn(
        `[course-schema] could not relax ${r.tableName}.${r.columnName}: ${e.message}`
      );
    }
  }
}

async function addIndexIfMissing(table, indexName, columns, { unique = false } = {}, logger = console) {
  for (const col of columns) {
    if (!(await columnExists(table, col))) {
      logger.warn(`[course-schema] skipping index ${indexName}: column ${table}.${col} missing`);
      return false;
    }
  }
  if (await indexExists(table, indexName)) return false;
  const colList = columns.map(c => `"${c}"`).join(', ');
  const sql = `CREATE ${unique ? 'UNIQUE ' : ''}INDEX "${indexName}" ON "${table}" (${colList})`;
  await sequelize.query(sql);
  logger.info(`[course-schema] created index ${indexName} on ${table}`);
  return true;
}

/**
 * Called from app.js AFTER all per-model sync({alter:true}) blocks have run.
 * Adds the indexes that were intentionally left out of the model definitions
 * to avoid the global-sync race.
 */
async function bootstrapCourseIndexes(logger = console) {
  try {
    await addIndexIfMissing('lessons', 'idx_lessons_course_order',
      ['course_id', 'order_index'], {}, logger);
    await addIndexIfMissing('lessons', 'idx_lessons_training',
      ['training_id'], {}, logger);
    await addIndexIfMissing('lessons', 'idx_lessons_trainer',
      ['trainer_id'], {}, logger);

    await addIndexIfMissing('ai_quizzes', 'idx_ai_quizzes_course',
      ['course_id'], {}, logger);
    await addIndexIfMissing('ai_quizzes', 'idx_ai_quizzes_lesson',
      ['lesson_id'], {}, logger);
    await addIndexIfMissing('ai_quizzes', 'idx_ai_quizzes_result_status',
      ['result_status'], {}, logger);

    await addIndexIfMissing('enrollments', 'idx_enrollments_course',
      ['course_id'], {}, logger);
    await addIndexIfMissing('enrollments', 'idx_enrollments_participant',
      ['participant_id'], {}, logger);
    await addIndexIfMissing('enrollments', 'enrollments_course_participant_unique',
      ['course_id', 'participant_id'], { unique: true }, logger);
  } catch (e) {
    logger.warn(`[course-schema] index bootstrap warning: ${e.message}`);
  }
}

module.exports = { bootstrapCourseSchema, bootstrapCourseIndexes, relaxLegacyTrainingIdColumns };
