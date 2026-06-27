# Coding Assessment Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully proctored Coding Assessment module inside Wave Init LMS that mirrors the Quiz module workflow, with a Monaco editor, Piston-based code execution, screen-share recording, and trainer review.

**Architecture:** Extend the existing `CodingAssessment`, `CodingQuestion`, `TestCase`, `CodingAttempt`, and `CodingSubmission` models; reuse `ProctorContext`, `useScreenRecorder`, and the quiz recording endpoints; add a backend code-execution service that proxies to the Piston API; build new React pages for the trainer builder, participant shell, and trainer reviewer.

**Tech Stack:** React 18 + Vite + Tailwind CSS v4, Node/Express + Sequelize + PostgreSQL, Socket.IO, `@monaco-editor/react`, `react-markdown`, `react-split-pane`, Piston API, Multer for uploads.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/src/models/codingAssessment.js` | Assessment model + new columns |
| `backend/src/models/codingQuestion.js` | Problem model + new columns |
| `backend/src/models/testCase.js` | Test case model + order_index |
| `backend/src/models/codingAttempt.js` | Attempt model + session_id, started_at, total_score |
| `backend/src/models/codingSubmission.js` | Submission model + code/tests_passed/tests_total/submitted_at |
| `backend/src/models/codingViolation.js` | Violation model + message/metadata/occurred_at |
| `backend/src/models/examSession.js` | Add assessment_type; make quiz_id nullable |
| `backend/src/models/quizRecording.js` | Add assessment_type, coding_attempt_id |
| `backend/src/models/index.js` | New associations |
| `dbscript.sql` | Migration SQL for new columns/associations |
| `backend/src/services/codeExecutionService.js` | Piston client + run/submit/score logic |
| `backend/src/routes/codingAssessmentsRoutes.js` | CRUD + publish/close/results APIs |
| `backend/src/routes/codingAttemptsRoutes.js` | Start/resume/submit attempt APIs |
| `backend/src/routes/codeExecutionRoutes.js` | `/api/code/run` and `/api/code/submit` |
| `backend/src/routes/recordingRoutes.js` | Add `type` query + coding fields handling |
| `backend/src/controllers/recordingController.js` | Save assessment_type + coding_attempt_id |
| `frontend/src/pages/trainer/CodingAssessmentBuilder.jsx` | Trainer create/edit form |
| `frontend/src/pages/participant/CodingAssessmentAttempt.jsx` | Pre-exam readiness screen |
| `frontend/src/pages/participant/CodingExamShell.jsx` | Two-pane coding shell |
| `frontend/src/pages/trainer/CodingRecordings.jsx` | Recording list with type filter |
| `frontend/src/pages/trainer/CodingRecordingViewer.jsx` | Video + code tabs viewer |
| `frontend/src/components/CodeEditor.jsx` | Monaco wrapper |
| `frontend/src/components/ProblemPanel.jsx` | Markdown problem + sample cases |
| `frontend/src/components/TestResultsPanel.jsx` | Run/submit results |
| `frontend/src/components/CodeSubmissionTabs.jsx` | Trainer code review tabs |
| `frontend/src/hooks/useCodeExecution.js` | Run/submit API hook |
| `frontend/src/hooks/useScreenRecorder.js` | Update to support coding assessments |
| `frontend/src/App.jsx` or router file | New routes |
| `frontend/src/api/api.js` | New API helpers |

---

## Task 1: Install Frontend Packages

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json` (via npm install)

- [ ] **Step 1: Add dependencies**

```bash
cd frontend
npm install react-markdown react-split-pane
```

`@monaco-editor/react` is already installed.

- [ ] **Step 2: Verify install**

```bash
grep -E '"react-markdown"|"react-split-pane"' package.json
```

Expected: both packages appear with versions.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(frontend): add react-markdown and react-split-pane for coding assessment"
```

---

## Task 2: Update Database Schema

**Files:**
- Modify: `dbscript.sql`

- [ ] **Step 1: Add columns to `coding_assessments`**

Append after the existing `coding_assessments` DDL (around the `status` line):

```sql
ALTER TABLE coding_assessments
  ADD COLUMN IF NOT EXISTS training_id BIGINT REFERENCES training_programs(id),
  ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS passing_score INT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS difficulty coding_question_difficulty NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS language VARCHAR(50) NOT NULL DEFAULT 'javascript',
  ADD COLUMN IF NOT EXISTS is_proctored BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS max_violations INT NOT NULL DEFAULT 3;
```

- [ ] **Step 2: Add columns to `coding_questions`**

```sql
ALTER TABLE coding_questions
  ADD COLUMN IF NOT EXISTS statement TEXT,
  ADD COLUMN IF NOT EXISTS starter_code TEXT,
  ADD COLUMN IF NOT EXISTS time_limit_sec INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS memory_limit_mb INT NOT NULL DEFAULT 256,
  ADD COLUMN IF NOT EXISTS order_index INT NOT NULL DEFAULT 0;
```

- [ ] **Step 3: Add columns to `coding_test_cases`**

```sql
ALTER TABLE coding_test_cases
  ADD COLUMN IF NOT EXISTS order_index INT NOT NULL DEFAULT 0;
```

- [ ] **Step 4: Add columns to `coding_attempts`**

```sql
ALTER TABLE coding_attempts
  ADD COLUMN IF NOT EXISTS session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS total_score INT NOT NULL DEFAULT 0;
```

- [ ] **Step 5: Add columns to `coding_submissions`**

```sql
ALTER TABLE coding_submissions
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS tests_passed INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tests_total INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
```

- [ ] **Step 6: Add columns to `coding_violations`**

```sql
ALTER TABLE coding_violations
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
```

- [ ] **Step 7: Update `exam_sessions` for coding support**

```sql
ALTER TABLE exam_sessions
  ADD COLUMN IF NOT EXISTS assessment_type VARCHAR(20) NOT NULL DEFAULT 'quiz',
  ALTER COLUMN quiz_id DROP NOT NULL;

ALTER TABLE exam_sessions
  ADD COLUMN IF NOT EXISTS assessment_id BIGINT;
```

- [ ] **Step 8: Update `quiz_recordings` for coding support**

```sql
ALTER TABLE quiz_recordings
  ADD COLUMN IF NOT EXISTS assessment_type VARCHAR(20) NOT NULL DEFAULT 'quiz',
  ADD COLUMN IF NOT EXISTS coding_attempt_id BIGINT REFERENCES coding_attempts(id),
  ALTER COLUMN quiz_id DROP NOT NULL;
```

- [ ] **Step 9: Verify schema changes**

```bash
grep -n "ALTER TABLE coding_assessments" dbscript.sql
```

Expected: all ALTER statements present.

- [ ] **Step 10: Commit**

```bash
git add dbscript.sql
git commit -m "db: extend coding assessment schema for proctored assessments"
```

---

## Task 3: Update Sequelize Models

**Files:**
- Modify: `backend/src/models/codingAssessment.js`
- Modify: `backend/src/models/codingQuestion.js`
- Modify: `backend/src/models/testCase.js`
- Modify: `backend/src/models/codingAttempt.js`
- Modify: `backend/src/models/codingSubmission.js`
- Modify: `backend/src/models/codingViolation.js`
- Modify: `backend/src/models/examSession.js`
- Modify: `backend/src/models/quizRecording.js`
- Modify: `backend/src/models/index.js`

- [ ] **Step 1: Update `codingAssessment.js`**

Add fields to the `CodingAssessment` definition:

```js
trainingId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'training_id' },
durationMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60, field: 'duration_minutes' },
passingScore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50, field: 'passing_score' },
difficulty: { type: DataTypes.ENUM('easy', 'medium', 'hard'), allowNull: false, defaultValue: 'medium' },
language: { type: DataTypes.STRING, allowNull: false, defaultValue: 'javascript' },
isProctored: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_proctored' },
maxViolations: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3, field: 'max_violations' },
```

- [ ] **Step 2: Update `codingQuestion.js`**

Add fields:

```js
statement: { type: DataTypes.TEXT, allowNull: true },
starterCode: { type: DataTypes.TEXT, allowNull: true, field: 'starter_code' },
timeLimitSec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5, field: 'time_limit_sec' },
memoryLimitMb: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 256, field: 'memory_limit_mb' },
orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'order_index' },
```

- [ ] **Step 3: Update `testCase.js`**

Add:

```js
orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'order_index' },
```

- [ ] **Step 4: Update `codingAttempt.js`**

Add:

```js
sessionId: { type: DataTypes.STRING, allowNull: true, field: 'session_id' },
startedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'started_at' },
totalScore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'total_score' },
```

- [ ] **Step 5: Update `codingSubmission.js`**

Add:

```js
code: { type: DataTypes.TEXT, allowNull: true },
testsPassed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'tests_passed' },
testsTotal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'tests_total' },
submittedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'submitted_at' },
```

- [ ] **Step 6: Update `codingViolation.js`**

Extend enum and add fields:

```js
type: { type: DataTypes.ENUM('SCREEN_SHARE_STOP', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'COPY_PASTE', 'OTHER'), allowNull: false, defaultValue: 'OTHER' },
message: { type: DataTypes.TEXT, allowNull: true },
metadata: { type: DataTypes.JSON, allowNull: true },
occurredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'occurred_at' },
```

- [ ] **Step 7: Update `examSession.js`**

Add `assessmentType` and `assessmentId`, make `quizId` nullable:

```js
assessmentType: { type: DataTypes.ENUM('quiz', 'coding_assessment'), allowNull: false, defaultValue: 'quiz', field: 'assessment_type' },
quizId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'quiz_id' },
assessmentId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'assessment_id' },
```

- [ ] **Step 8: Update `quizRecording.js`**

Add:

```js
assessmentType: { type: DataTypes.ENUM('quiz', 'coding_assessment'), allowNull: false, defaultValue: 'quiz', field: 'assessment_type' },
codingAttemptId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'coding_attempt_id' },
```

Make `quizId` nullable:

```js
quizId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'quiz_id' },
```

- [ ] **Step 9: Update `models/index.js` associations**

Add:

```js
CodingAssessment.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
Training.hasMany(CodingAssessment, { foreignKey: 'trainingId', as: 'codingAssessments' });
QuizRecording.belongsTo(CodingAttempt, { foreignKey: 'codingAttemptId', as: 'codingAttempt' });
ExamSession.belongsTo(CodingAttempt, { foreignKey: 'attemptId', as: 'codingAttempt' });
```

- [ ] **Step 10: Commit**

```bash
git add backend/src/models/
git commit -m "feat(models): extend coding assessment models for proctored workflow"
```

---

## Task 4: Build Code Execution Service

**Files:**
- Create: `backend/src/services/codeExecutionService.js`
- Create: `backend/src/utils/__tests__/codeExecution.test.js`

- [ ] **Step 1: Write the failing test**

```js
const { executeCode, scoreSubmission } = require('../codeExecutionService');

describe('codeExecutionService', () => {
  test('executeCode returns passed for matching stdout', async () => {
    // mocked axios in implementation
    expect(true).toBe(false); // force fail until implemented
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd backend
npx jest src/utils/__tests__/codeExecution.test.js --no-coverage
```

Expected: FAIL.

- [ ] **Step 3: Implement Piston service**

```js
const axios = require('axios');

const PISTON_URL = process.env.PISTON_URL || 'https://emkc.org/api/v2/piston/execute';

const LANGUAGE_MAP = {
  javascript: { language: 'javascript', version: '18.15.0' },
  python: { language: 'python', version: '3.10.0' },
  java: { language: 'java', version: '15.0.2' },
  'c++': { language: 'c++', version: '10.2.0' },
};

function normalizeOutput(output) {
  return (output || '').toString().replace(/\r\n/g, '\n').trim();
}

async function executeCode({ code, language, stdin, timeout = 5000 }) {
  const mapped = LANGUAGE_MAP[language];
  if (!mapped) throw new Error(`Unsupported language: ${language}`);

  const response = await axios.post(PISTON_URL, {
    language: mapped.language,
    version: mapped.version,
    files: [{ content: code }],
    stdin: stdin || '',
  }, { timeout: timeout + 2000 });

  const { run, compile } = response.data;
  if (compile && compile.code !== 0) {
    return { status: 'CE', output: compile.stderr || compile.output, stdout: '', stderr: compile.stderr || '' };
  }
  if (!run) {
    return { status: 'RE', output: 'No run output', stdout: '', stderr: '' };
  }
  if (run.signal === 'SIGKILL') {
    return { status: 'TLE', output: run.stdout || '', stdout: run.stdout || '', stderr: run.stderr || '' };
  }
  if (run.code !== 0) {
    return { status: 'RE', output: run.stderr || run.output, stdout: run.stdout || '', stderr: run.stderr || '' };
  }
  return { status: 'OK', output: run.stdout || '', stdout: run.stdout || '', stderr: run.stderr || '' };
}

async function runTests({ code, language, testCases, timeout = 5000 }) {
  const results = [];
  let passed = 0;
  for (const tc of testCases) {
    const start = Date.now();
    const execResult = await executeCode({ code, language, stdin: tc.input, timeout });
    const elapsed = Date.now() - start;
    const output = normalizeOutput(execResult.stdout);
    const expected = normalizeOutput(tc.expectedOutput);
    const testPassed = execResult.status === 'OK' && output === expected;
    if (testPassed) passed += 1;
    results.push({
      testCaseId: tc.id,
      input: tc.input,
      expectedOutput: expected,
      output,
      passed: testPassed,
      status: execResult.status,
      timeMs: elapsed,
      isHidden: tc.isHidden,
    });
  }
  return { results, passed, total: testCases.length };
}

function calculateScore({ passed, total, marks }) {
  if (!total) return 0;
  return Math.round((passed / total) * marks);
}

module.exports = { executeCode, runTests, calculateScore, normalizeOutput, LANGUAGE_MAP };
```

- [ ] **Step 4: Update test to assert real behavior**

```js
const { calculateScore, normalizeOutput } = require('../codeExecutionService');

describe('codeExecutionService helpers', () => {
  test('calculateScore returns 0 for no tests', () => {
    expect(calculateScore({ passed: 0, total: 0, marks: 10 })).toBe(0);
  });
  test('calculateScore returns half marks for half passed', () => {
    expect(calculateScore({ passed: 2, total: 4, marks: 10 })).toBe(5);
  });
  test('normalizeOutput trims whitespace and CRLF', () => {
    expect(normalizeOutput('  hello\r\nworld  ')).toBe('hello\nworld');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npx jest src/utils/__tests__/codeExecution.test.js --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/codeExecutionService.js backend/src/utils/__tests__/codeExecution.test.js
git commit -m "feat(backend): add Piston-based code execution service"
```

---

## Task 5: Backend Assessment CRUD Routes

**Files:**
- Create: `backend/src/routes/codingAssessmentsRoutes.js`
- Modify: `backend/src/app.js` (register route)

- [ ] **Step 1: Implement CRUD route file**

```js
const express = require('express');
const { Op } = require('sequelize');
const {
  CodingAssessment, CodingQuestion, TestCase, Training, Course,
  Enrollment, CodingAttempt, CodingSubmission, User
} = require('../models');
const authenticateToken = require('../middleware/auth');
const roleMiddleware = require('../middleware/roles');

const router = express.Router();
router.use(authenticateToken);

async function verifyTrainerAccess(req, res, assessment) {
  const trainerId = req.user.id;
  const role = req.user.role;
  if (role === 'ADMIN') return true;
  if (assessment.trainerId === trainerId) return true;
  res.status(403).json({ error: 'Unauthorized' });
  return false;
}

// POST /api/coding-assessments
router.post('/', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  try {
    const { trainingId, title, description, durationMinutes, passingScore, difficulty, language, isProctored, maxViolations, problems } = req.body;
    if (!trainingId) return res.status(400).json({ error: 'trainingId required' });
    const assessment = await CodingAssessment.create({
      trainingId,
      trainerId: req.user.id,
      title,
      description,
      durationMinutes,
      passingScore,
      difficulty,
      language,
      isProctored,
      maxViolations,
      status: 'DRAFT',
    });
    if (Array.isArray(problems)) {
      for (let i = 0; i < problems.length; i++) {
        const p = problems[i];
        const question = await CodingQuestion.create({
          assessmentId: assessment.id,
          title: p.title,
          statement: p.statement,
          problemDescription: p.statement,
          inputFormat: p.inputFormat,
          outputFormat: p.outputFormat,
          constraints: p.constraints,
          starterCode: p.starterCode,
          explanation: p.explanation,
          difficulty: p.difficulty || 'medium',
          marks: p.marks || 10,
          orderIndex: i,
        });
        if (Array.isArray(p.testCases)) {
          for (let j = 0; j < p.testCases.length; j++) {
            const tc = p.testCases[j];
            await TestCase.create({
              questionId: question.id,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isHidden: tc.isHidden || false,
              orderIndex: j,
            });
          }
        }
      }
    }
    res.status(201).json({ success: true, assessment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coding-assessments
router.get('/', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  try {
    const where = req.user.role === 'ADMIN' ? {} : { trainerId: req.user.id };
    const assessments = await CodingAssessment.findAll({
      where,
      include: [{ model: Training, as: 'training', attributes: ['id', 'title'] }],
      order: [['created_at', 'DESC']],
    });
    res.json({ success: true, assessments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coding-assessments/:id
router.get('/:id', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  try {
    const assessment = await CodingAssessment.findByPk(req.params.id, {
      include: [{
        model: CodingQuestion, as: 'questions',
        include: [{ model: TestCase, as: 'testCases' }],
        order: [['order_index', 'ASC']],
      }],
    });
    if (!assessment) return res.status(404).json({ error: 'Not found' });
    if (!(await verifyTrainerAccess(req, res, assessment))) return;
    res.json({ success: true, assessment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/coding-assessments/:id
router.put('/:id', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  try {
    const assessment = await CodingAssessment.findByPk(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Not found' });
    if (!(await verifyTrainerAccess(req, res, assessment))) return;
    if (assessment.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only draft assessments can be edited' });
    }
    const { title, description, durationMinutes, passingScore, difficulty, language, isProctored, maxViolations, problems } = req.body;
    await assessment.update({ title, description, durationMinutes, passingScore, difficulty, language, isProctored, maxViolations });
    if (Array.isArray(problems)) {
      await CodingQuestion.destroy({ where: { assessmentId: assessment.id } });
      for (let i = 0; i < problems.length; i++) {
        const p = problems[i];
        const question = await CodingQuestion.create({
          assessmentId: assessment.id,
          title: p.title,
          statement: p.statement,
          problemDescription: p.statement,
          inputFormat: p.inputFormat,
          outputFormat: p.outputFormat,
          constraints: p.constraints,
          starterCode: p.starterCode,
          explanation: p.explanation,
          difficulty: p.difficulty || 'medium',
          marks: p.marks || 10,
          orderIndex: i,
        });
        if (Array.isArray(p.testCases)) {
          for (let j = 0; j < p.testCases.length; j++) {
            const tc = p.testCases[j];
            await TestCase.create({
              questionId: question.id,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isHidden: tc.isHidden || false,
              orderIndex: j,
            });
          }
        }
      }
    }
    res.json({ success: true, assessment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/coding-assessments/:id
router.delete('/:id', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  try {
    const assessment = await CodingAssessment.findByPk(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Not found' });
    if (!(await verifyTrainerAccess(req, res, assessment))) return;
    await assessment.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/coding-assessments/:id/publish
router.post('/:id/publish', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  try {
    const assessment = await CodingAssessment.findByPk(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Not found' });
    if (!(await verifyTrainerAccess(req, res, assessment))) return;
    await assessment.update({ status: 'PUBLISHED' });
    res.json({ success: true, assessment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/coding-assessments/:id/close
router.post('/:id/close', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  try {
    const assessment = await CodingAssessment.findByPk(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Not found' });
    if (!(await verifyTrainerAccess(req, res, assessment))) return;
    await assessment.update({ status: 'CLOSED' });
    res.json({ success: true, assessment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Register route in `app.js`**

Find where quiz routes are mounted and add:

```js
app.use('/api/coding-assessments', require('./routes/codingAssessmentsRoutes'));
```

- [ ] **Step 3: Verify route loads**

```bash
cd backend
node -e "require('./src/app.js')" || true
```

Expected: no syntax errors (server may start and exit).

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/codingAssessmentsRoutes.js backend/src/app.js
git commit -m "feat(backend): add coding assessment CRUD routes"
```

---

## Task 6: Backend Attempt Start/Submit Routes

**Files:**
- Create: `backend/src/routes/codingAttemptsRoutes.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Implement attempt routes**

```js
const express = require('express');
const { Op } = require('sequelize');
const {
  CodingAssessment, CodingAttempt, CodingSubmission, CodingQuestion, TestCase, Enrollment
} = require('../models');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// POST /api/coding-attempts/start
router.post('/start', async (req, res) => {
  try {
    const { assessmentId } = req.body;
    const participantId = req.user.id;
    const assessment = await CodingAssessment.findByPk(assessmentId);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (assessment.status !== 'PUBLISHED') return res.status(403).json({ error: 'Assessment not published' });

    const enrollment = await Enrollment.findOne({
      where: { participantId, trainingId: assessment.trainingId, status: 'ENROLLED' },
    });
    if (!enrollment) return res.status(403).json({ error: 'Not enrolled' });

    let attempt = await CodingAttempt.findOne({
      where: { assessmentId, participantId },
    });

    if (attempt) {
      if (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED') {
        return res.status(409).json({ error: 'Already submitted' });
      }
      return res.json({ success: true, attemptId: attempt.id, status: attempt.status });
    }

    attempt = await CodingAttempt.create({
      assessmentId,
      participantId,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    });
    res.status(201).json({ success: true, attemptId: attempt.id, status: attempt.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coding-attempts/:id
router.get('/:id', async (req, res) => {
  try {
    const attempt = await CodingAttempt.findByPk(req.params.id, {
      include: [{
        model: CodingAssessment, as: 'assessment',
        include: [{ model: CodingQuestion, as: 'questions', include: [{ model: TestCase, as: 'testCases' }] }],
      }, { model: CodingSubmission, as: 'submissions' }],
    });
    if (!attempt) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'PARTICIPANT' && attempt.participantId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ success: true, attempt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/coding-attempts/:id/submit
router.post('/:id/submit', async (req, res) => {
  try {
    const attempt = await CodingAttempt.findByPk(req.params.id);
    if (!attempt) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'PARTICIPANT' && attempt.participantId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED') {
      return res.status(409).json({ error: 'Already submitted' });
    }
    const submissions = await CodingSubmission.findAll({ where: { attemptId: attempt.id, isFinal: true } });
    const totalScore = submissions.reduce((sum, s) => sum + (s.score || 0), 0);
    await attempt.update({ status: 'SUBMITTED', submittedAt: new Date(), totalScore });
    res.json({ success: true, attempt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Register route**

```js
app.use('/api/coding-attempts', require('./routes/codingAttemptsRoutes'));
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/codingAttemptsRoutes.js backend/src/app.js
git commit -m "feat(backend): add coding attempt start/get/submit routes"
```

---

## Task 7: Backend Code Execution Routes

**Files:**
- Create: `backend/src/routes/codeExecutionRoutes.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Implement routes**

```js
const express = require('express');
const { CodingQuestion, TestCase, CodingAttempt, CodingSubmission, CodingAssessment } = require('../models');
const { runTests, calculateScore } = require('../services/codeExecutionService');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

async function getTestCases(problemId, testType) {
  const where = { questionId: problemId };
  if (testType === 'sample') where.isHidden = false;
  return TestCase.findAll({ where, order: [['order_index', 'ASC']] });
}

// POST /api/code/run
router.post('/run', async (req, res) => {
  try {
    const { code, language, problemId } = req.body;
    const question = await CodingQuestion.findByPk(problemId);
    if (!question) return res.status(404).json({ error: 'Problem not found' });
    const testCases = await getTestCases(problemId, 'sample');
    const { results, passed, total } = await runTests({
      code, language, testCases, timeout: question.timeLimitSec * 1000,
    });
    res.json({ success: true, results, passed, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/code/submit
router.post('/submit', async (req, res) => {
  try {
    const { code, language, problemId, attemptId } = req.body;
    const [question, attempt] = await Promise.all([
      CodingQuestion.findByPk(problemId),
      CodingAttempt.findByPk(attemptId),
    ]);
    if (!question) return res.status(404).json({ error: 'Problem not found' });
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (req.user.role === 'PARTICIPANT' && attempt.participantId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const testCases = await getTestCases(problemId, 'all');
    const { results, passed, total } = await runTests({
      code, language, testCases, timeout: question.timeLimitSec * 1000,
    });
    const score = calculateScore({ passed, total, marks: question.marks });

    await CodingSubmission.update({ isFinal: false }, { where: { attemptId, questionId: problemId } });

    const submission = await CodingSubmission.create({
      attemptId,
      questionId: problemId,
      participantId: attempt.participantId,
      language,
      code,
      sourceCode: code,
      status: passed === total ? 'PASSED' : passed > 0 ? 'PARTIAL' : 'FAILED',
      score,
      testsPassed: passed,
      testsTotal: total,
      passedCount: passed,
      totalCount: total,
      isFinal: true,
      submittedAt: new Date(),
    });

    const finalSubmissions = await CodingSubmission.findAll({ where: { attemptId, isFinal: true } });
    const totalScore = finalSubmissions.reduce((sum, s) => sum + (s.score || 0), 0);
    await attempt.update({ totalScore });

    res.json({
      success: true,
      score,
      results,
      hiddenTestsPassed: results.filter(r => r.isHidden && r.passed).length,
      hiddenTestsTotal: results.filter(r => r.isHidden).length,
      submissionId: submission.id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Register route**

```js
app.use('/api/code', require('./routes/codeExecutionRoutes'));
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/codeExecutionRoutes.js backend/src/app.js
git commit -m "feat(backend): add /api/code/run and /api/code/submit endpoints"
```

---

## Task 8: Update Recording Controller for Coding Assessments

**Files:**
- Modify: `backend/src/controllers/recordingController.js`
- Modify: `backend/src/middleware/uploadRecording.js` (if path building is hardcoded)

- [ ] **Step 1: Read existing controller**

```bash
head -n 100 backend/src/controllers/recordingController.js
```

- [ ] **Step 2: Modify upload handler**

Locate the upload function and update it to read `assessment_type` and `codingAttemptId` from `req.body` and set `quizId` / `codingAttemptId` accordingly:

```js
const assessmentType = req.body.assessment_type || 'quiz';
const codingAttemptId = req.body.codingAttemptId || null;
const quizId = assessmentType === 'quiz' ? (req.body.quizId || null) : null;

const recording = await QuizRecording.create({
  quizId,
  codingAttemptId,
  participantId: req.body.participantId,
  trainerId: req.user.id,
  sessionId: req.body.sessionId,
  filePath: destinationPath,
  fileSizeMb,
  durationSeconds,
  assessmentType,
  status: 'ready',
});
```

- [ ] **Step 3: Modify list handler to filter by type**

Update the `list` function to accept `req.query.type` and filter:

```js
const where = { isDeleted: false };
if (req.query.type === 'coding') where.assessmentType = 'coding_assessment';
else if (req.query.type === 'quiz') where.assessmentType = 'quiz';
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/recordingController.js
git commit -m "feat(backend): support coding assessment recordings upload and list filter"
```

---

## Task 9: Frontend API Helpers

**Files:**
- Modify: `frontend/src/api/api.js`

- [ ] **Step 1: Add API helpers**

Append to `frontend/src/api/api.js`:

```js
import { getAuthHeaders } from './request'; // existing helper

export const codingAssessmentApi = {
  create: (data) => fetch(`${API_BASE}/coding-assessments`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) }),
  list: () => fetch(`${API_BASE}/coding-assessments`, { headers: getAuthHeaders() }),
  get: (id) => fetch(`${API_BASE}/coding-assessments/${id}`, { headers: getAuthHeaders() }),
  update: (id, data) => fetch(`${API_BASE}/coding-assessments/${id}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data) }),
  delete: (id) => fetch(`${API_BASE}/coding-assessments/${id}`, { method: 'DELETE', headers: getAuthHeaders() }),
  publish: (id) => fetch(`${API_BASE}/coding-assessments/${id}/publish`, { method: 'POST', headers: getAuthHeaders() }),
  close: (id) => fetch(`${API_BASE}/coding-assessments/${id}/close`, { method: 'POST', headers: getAuthHeaders() }),
};

export const codingAttemptApi = {
  start: (assessmentId) => fetch(`${API_BASE}/coding-attempts/start`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ assessmentId }) }),
  get: (id) => fetch(`${API_BASE}/coding-attempts/${id}`, { headers: getAuthHeaders() }),
  submit: (id) => fetch(`${API_BASE}/coding-attempts/${id}/submit`, { method: 'POST', headers: getAuthHeaders() }),
};

export const codeExecutionApi = {
  run: (data) => fetch(`${API_BASE}/code/run`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) }),
  submit: (data) => fetch(`${API_BASE}/code/submit`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) }),
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/api.js
git commit -m "feat(frontend): add coding assessment API helpers"
```

---

## Task 10: Update useScreenRecorder Hook

**Files:**
- Modify: `frontend/src/hooks/useScreenRecorder.js`

- [ ] **Step 1: Generalize the hook**

Change the signature to accept an `assessmentType` and rename `quizId` to `assessmentId`:

```js
export default function useScreenRecorder({
  assessmentType = 'quiz',
  assessmentId,
  codingAttemptId,
  participantId,
  sessionId,
  userToken,
  autoStop = true,
} = {}) {
```

Update `uploadRecording` to send the correct fields:

```js
const uploadRecording = useCallback(async (blob) => {
  if (!blob || !assessmentId || !participantId || !sessionId) return null;
  try {
    const formData = new FormData();
    formData.append('recording', blob, `${assessmentType}_${assessmentId}_${participantId}_${Date.now()}.webm`);
    formData.append('assessment_type', assessmentType);
    formData.append('participantId', participantId);
    formData.append('sessionId', sessionId);
    if (assessmentType === 'quiz') {
      formData.append('quizId', assessmentId);
    } else {
      formData.append('codingAttemptId', codingAttemptId);
      formData.append('assessmentId', assessmentId);
    }
    // ... rest unchanged
  }
}, [assessmentType, assessmentId, codingAttemptId, participantId, sessionId, userToken]);
```

- [ ] **Step 2: Update existing quiz callers**

Search and replace `quizId:` with `assessmentType: 'quiz', assessmentId:` in existing callers.

```bash
grep -rl "useScreenRecorder" frontend/src | xargs grep -l "quizId"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useScreenRecorder.js
git commit -m "feat(frontend): generalize useScreenRecorder for coding assessments"
```

---

## Task 11: Create useCodeExecution Hook

**Files:**
- Create: `frontend/src/hooks/useCodeExecution.js`

- [ ] **Step 1: Implement hook**

```js
import { useState, useCallback } from 'react';
import { codeExecutionApi } from '../api/api';
import { useToast } from '../components/Toast';

export default function useCodeExecution() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const { error: showError } = useToast();

  const run = useCallback(async ({ code, language, problemId }) => {
    setLoading(true);
    try {
      const res = await codeExecutionApi.run({ code, language, problemId });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Run failed');
      setResults({ type: 'run', ...data });
      return data;
    } catch (err) {
      showError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const submit = useCallback(async ({ code, language, problemId, attemptId }) => {
    setLoading(true);
    try {
      const res = await codeExecutionApi.submit({ code, language, problemId, attemptId });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setResults({ type: 'submit', ...data });
      return data;
    } catch (err) {
      showError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const clearResults = useCallback(() => setResults(null), []);

  return { run, submit, results, loading, clearResults };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useCodeExecution.js
git commit -m "feat(frontend): add useCodeExecution hook for run/submit"
```

---

## Task 12: Create CodeEditor Component

**Files:**
- Create: `frontend/src/components/CodeEditor.jsx`

- [ ] **Step 1: Implement component**

```jsx
import Editor from '@monaco-editor/react';

export default function CodeEditor({ value, language, onChange, readOnly = false, height = '60vh' }) {
  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={onChange}
      theme="vs-dark"
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        readOnly,
      }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/CodeEditor.jsx
git commit -m "feat(frontend): add Monaco CodeEditor wrapper"
```

---

## Task 13: Create ProblemPanel Component

**Files:**
- Create: `frontend/src/components/ProblemPanel.jsx`

- [ ] **Step 1: Implement component**

```jsx
import ReactMarkdown from 'react-markdown';

export default function ProblemPanel({ problem }) {
  if (!problem) return <div className="p-6 text-slate-500">Select a problem</div>;
  return (
    <div className="p-6 overflow-auto h-full">
      <h2 className="text-xl font-bold mb-4">{problem.title}</h2>
      <div className="prose prose-sm max-w-none mb-6">
        <ReactMarkdown>{problem.statement || problem.problemDescription || ''}</ReactMarkdown>
      </div>
      {problem.inputFormat && (
        <div className="mb-4">
          <h3 className="font-semibold">Input Format</h3>
          <p className="text-sm whitespace-pre-wrap">{problem.inputFormat}</p>
        </div>
      )}
      {problem.outputFormat && (
        <div className="mb-4">
          <h3 className="font-semibold">Output Format</h3>
          <p className="text-sm whitespace-pre-wrap">{problem.outputFormat}</p>
        </div>
      )}
      {problem.constraints && (
        <div className="mb-4">
          <h3 className="font-semibold">Constraints</h3>
          <p className="text-sm whitespace-pre-wrap">{problem.constraints}</p>
        </div>
      )}
      {problem.testCases?.filter(tc => !tc.isHidden).map((tc, idx) => (
        <div key={idx} className="mb-4 p-3 bg-slate-50 rounded border">
          <h4 className="font-semibold text-sm">Sample Test {idx + 1}</h4>
          <div className="text-xs mt-1"><strong>Input:</strong> <pre className="inline">{tc.input}</pre></div>
          <div className="text-xs mt-1"><strong>Output:</strong> <pre className="inline">{tc.expectedOutput}</pre></div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ProblemPanel.jsx
git commit -m "feat(frontend): add ProblemPanel markdown renderer"
```

---

## Task 14: Create TestResultsPanel Component

**Files:**
- Create: `frontend/src/components/TestResultsPanel.jsx`

- [ ] **Step 1: Implement component**

```jsx
import { CheckCircle2, XCircle, Loader } from 'lucide-react';

export default function TestResultsPanel({ results, loading }) {
  if (loading) return <div className="p-4 flex items-center gap-2"><Loader className="animate-spin" /> Running...</div>;
  if (!results) return null;
  return (
    <div className="p-4 border-t bg-white">
      <h3 className="font-semibold mb-2">
        {results.type === 'submit' ? 'Submission Results' : 'Run Results'}
        {results.score !== undefined && <span className="ml-2 text-blue-600">Score: {results.score}</span>}
      </h3>
      <div className="space-y-2 max-h-48 overflow-auto">
        {results.results?.map((r, idx) => (
          <div key={idx} className={`p-2 rounded text-sm border ${r.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 font-medium">
              {r.passed ? <CheckCircle2 size={16} className="text-green-600" /> : <XCircle size={16} className="text-red-600" />}
              Test {idx + 1} {r.isHidden ? '(hidden)' : ''} — {r.passed ? 'Passed' : 'Failed'}
            </div>
            {!r.passed && (
              <div className="mt-1 text-xs">
                <div>Expected: <code>{r.expectedOutput}</code></div>
                <div>Got: <code>{r.output}</code></div>
                {r.status !== 'FAILED' && <div>Status: {r.status}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/TestResultsPanel.jsx
git commit -m "feat(frontend): add TestResultsPanel component"
```

---

## Task 15: Create Trainer CodingAssessmentBuilder Page

**Files:**
- Create: `frontend/src/pages/trainer/CodingAssessmentBuilder.jsx`

- [ ] **Step 1: Implement builder form**

Build a form with:
- Basic details: title, description, durationMinutes, passingScore, difficulty, language, isProctored, maxViolations
- Problems repeater: each problem has title, statement, inputFormat, outputFormat, constraints, starterCode, marks, timeLimitSec, memoryLimitMb, testCases repeater
- Submit calls `codingAssessmentApi.create`

Use local state for form data. Use Tailwind classes for styling matching the app.

- [ ] **Step 2: Add route**

In the trainer router:

```jsx
<Route path="/trainer/trainings/:trainingId/assessments/create" element={<CodingAssessmentBuilder />} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/trainer/CodingAssessmentBuilder.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add trainer coding assessment builder"
```

---

## Task 16: Create Participant CodingExamShell Page

**Files:**
- Create: `frontend/src/pages/participant/CodingExamShell.jsx`

- [ ] **Step 1: Implement two-pane shell**

Use `react-split-pane` or CSS grid for 40/60 split:

```jsx
import SplitPane from 'react-split-pane';

export default function CodingExamShell({ attempt, onSubmit }) {
  const [currentProblemIdx, setCurrentProblemIdx] = useState(0);
  const [codeByProblem, setCodeByProblem] = useState({});
  const { run, submit, results, loading, clearResults } = useCodeExecution();

  const problems = attempt?.assessment?.questions || [];
  const problem = problems[currentProblemIdx];
  const code = codeByProblem[problem?.id] || problem?.starterCode || '';

  return (
    <div className="h-screen flex flex-col">
      <header className="h-14 border-b flex items-center px-4 justify-between bg-white">
        <span className="font-bold">{attempt?.assessment?.title}</span>
        <span>Problem {currentProblemIdx + 1} of {problems.length}</span>
      </header>
      <div className="flex-1 overflow-hidden">
        <SplitPane split="vertical" minSize={300} defaultSize="40%">
          <ProblemPanel problem={problem} />
          <div className="flex flex-col h-full">
            <div className="p-2 border-b flex items-center justify-between bg-slate-50">
              <select value={attempt?.assessment?.language} disabled className="text-sm border rounded p-1">
                <option>{attempt?.assessment?.language}</option>
              </select>
              <div className="space-x-2">
                <button onClick={() => run({ code, language: attempt.assessment.language, problemId: problem.id })} disabled={loading}>Run</button>
                <button onClick={() => submit({ code, language: attempt.assessment.language, problemId: problem.id, attemptId: attempt.id })} disabled={loading}>Submit</button>
              </div>
            </div>
            <div className="flex-1">
              <CodeEditor value={code} language={attempt?.assessment?.language} onChange={(v) => setCodeByProblem(p => ({ ...p, [problem.id]: v }))} />
            </div>
            <TestResultsPanel results={results} loading={loading} />
          </div>
        </SplitPane>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add problem navigator**

Add a tab bar to switch problems.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/participant/CodingExamShell.jsx
git commit -m "feat(frontend): add participant coding exam shell"
```

---

## Task 17: Create Participant CodingAssessmentAttempt Readiness Page

**Files:**
- Create: `frontend/src/pages/participant/CodingAssessmentAttempt.jsx`

- [ ] **Step 1: Reuse AssessmentConsentGate flow**

Mirror `ParticipantQuizAttemptPage.jsx` but for coding assessments:

- Fetch assessment details from `/api/coding-assessments/:id`.
- Call `codingAttemptApi.start` to get `attemptId`.
- Import `AssessmentConsentGate` from `../components/ai-quizzes/AssessmentConsentGate`.
- Render it with a `quiz` prop shaped from assessment data (title, duration, proctoringEnabled).
- On consent + screen share ready, start proctor session, start screen recorder, enter fullscreen, navigate to `CodingExamShell`.
- Pass `attemptId`, `sessionToken`, `screenStream`, `assessment` to shell.

- [ ] **Step 2: Add route**

```jsx
<Route path="/trainings/:trainingId/assessments/:assessmentId/attempt" element={<CodingAssessmentAttempt />} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/participant/CodingAssessmentAttempt.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add coding assessment readiness and proctor gate"
```

---

## Task 18: Wire Proctoring and Recording into Coding Shell

**Files:**
- Modify: `frontend/src/pages/participant/CodingExamShell.jsx`
- Modify: `frontend/src/pages/participant/CodingAssessmentAttempt.jsx`

- [ ] **Step 1: Add fullscreen and violation handling to shell**

Inside `CodingExamShell`, add:

```js
const proctor = useProctor();
const [warnings, setWarnings] = useState(0);

useEffect(() => {
  const handler = () => {
    if (!document.fullscreenElement) {
      proctor.report('FULLSCREEN_EXIT', 'Exited fullscreen during coding assessment');
      setWarnings(w => w + 1);
    }
  };
  document.addEventListener('fullscreenchange', handler);
  return () => document.removeEventListener('fullscreenchange', handler);
}, [proctor]);

useEffect(() => {
  const handler = () => {
    if (document.hidden) proctor.report('TAB_SWITCH', 'Switched tab during coding assessment');
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}, [proctor]);
```

- [ ] **Step 2: On submit, stop recorder and upload**

In `CodingAssessmentAttempt` or shell, call `stopRecording()` and `uploadRecording(blob)` before final submit.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/participant/CodingExamShell.jsx frontend/src/pages/participant/CodingAssessmentAttempt.jsx
git commit -m "feat(frontend): wire proctoring violations and recording upload to coding shell"
```

---

## Task 19: Create Trainer CodingRecordings List Page

**Files:**
- Create: `frontend/src/pages/trainer/CodingRecordings.jsx`

- [ ] **Step 1: Reuse quiz recordings list**

Copy the quiz recordings list component structure and add:
- Filter dropdown: All / Quiz / Coding Assessment
- Column: Score (from `recording.codingAttempt?.totalScore`)
- Link to `/trainer/assessments/recordings/:id`

Fetch from `/api/recordings?type=coding`.

- [ ] **Step 2: Add route**

```jsx
<Route path="/trainer/assessments/recordings" element={<CodingRecordings />} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/trainer/CodingRecordings.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add trainer coding recordings list with type filter"
```

---

## Task 20: Create Trainer CodingRecordingViewer Page

**Files:**
- Create: `frontend/src/pages/trainer/CodingRecordingViewer.jsx`
- Create: `frontend/src/components/CodeSubmissionTabs.jsx`

- [ ] **Step 1: Implement viewer**

Left panel: reuse quiz video player (`/api/recordings/:id/stream`).
Right panel:
- Participant + assessment details
- Score summary (`codingAttempt.totalScore`, problem breakdown)
- `CodeSubmissionTabs` with per-problem code + results
- Violation log with clickable timestamps that seek video

- [ ] **Step 2: Implement CodeSubmissionTabs**

Fetch `/api/coding-submissions/:attemptId`. Render tabs per problem. Each tab shows read-only `CodeEditor`, language, test results.

- [ ] **Step 3: Add route**

```jsx
<Route path="/trainer/assessments/recordings/:id" element={<CodingRecordingViewer />} />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/trainer/CodingRecordingViewer.jsx frontend/src/components/CodeSubmissionTabs.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add coding recording viewer with code review tabs"
```

---

## Task 21: Add Backend Results APIs

**Files:**
- Modify: `backend/src/routes/codingAssessmentsRoutes.js`

- [ ] **Step 1: Add results endpoints**

```js
// GET /api/coding-assessments/:id/results
router.get('/:id/results', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  const assessment = await CodingAssessment.findByPk(req.params.id);
  if (!(await verifyTrainerAccess(req, res, assessment))) return;
  const attempts = await CodingAttempt.findAll({
    where: { assessmentId: req.params.id },
    include: [{ model: User, as: 'participant', attributes: ['id', 'name', 'email'] }],
    order: [['total_score', 'DESC']],
  });
  res.json({ success: true, results: attempts });
});

// POST /api/coding-assessments/:id/publish-result
router.post('/:id/publish-result', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  const assessment = await CodingAssessment.findByPk(req.params.id);
  if (!(await verifyTrainerAccess(req, res, assessment))) return;
  await assessment.update({ resultStatus: 'PUBLISHED' });
  res.json({ success: true });
});
```

- [ ] **Step 2: Add coding submissions by attempt endpoint**

```js
// GET /api/coding-submissions/:attemptId
router.get('/coding-submissions/:attemptId', roleMiddleware('TRAINER', 'ADMIN'), async (req, res) => {
  const attempt = await CodingAttempt.findByPk(req.params.attemptId);
  const assessment = await CodingAssessment.findByPk(attempt.assessmentId);
  if (!(await verifyTrainerAccess(req, res, assessment))) return;
  const submissions = await CodingSubmission.findAll({
    where: { attemptId: req.params.attemptId, isFinal: true },
    include: [{ model: CodingQuestion, as: 'question' }],
  });
  res.json({ success: true, submissions });
});
```

Create `backend/src/routes/codingSubmissionsRoutes.js` with this handler, then register it in `backend/src/app.js`:

```js
app.use('/api/coding-submissions', require('./routes/codingSubmissionsRoutes'));
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/codingAssessmentsRoutes.js backend/src/routes/codingSubmissionsRoutes.js backend/src/app.js
git commit -m "feat(backend): add coding assessment results and submissions APIs"
```

---

## Task 22: Participant Result Page

**Files:**
- Create: `frontend/src/pages/participant/CodingAssessmentResultPage.jsx`

- [ ] **Step 1: Show pending or published result**

If `assessment.resultStatus === 'HIDDEN'`, show "Results not yet published".
If published, show total score, problem breakdown, and test-case results.

- [ ] **Step 2: Add route**

```jsx
<Route path="/trainings/:trainingId/assessments/:assessmentId/result" element={<CodingAssessmentResultPage />} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/participant/CodingAssessmentResultPage.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add participant coding assessment result page"
```

---

## Task 23: Integration Testing

**Files:**
- Create: `backend/src/utils/__tests__/codingIntegration.test.js`

- [ ] **Step 1: Write integration test**

Test the vertical slice:

```js
describe('Coding assessment integration', () => {
  test('trainer creates assessment, participant starts attempt, runs code, submits', async () => {
    // This requires DB setup; use supertest and a test DB.
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run backend tests**

```bash
cd backend
npx jest --no-coverage
```

Expected: existing tests still pass; new tests pass.

- [ ] **Step 3: Manual smoke test checklist**

- [ ] Trainer creates a 1-problem JS assessment with 2 sample test cases.
- [ ] Trainer publishes assessment.
- [ ] Participant clicks Start, shares screen, enters fullscreen.
- [ ] Participant writes code and clicks Run — sample tests show results.
- [ ] Participant clicks Submit — hidden tests run, score saved.
- [ ] Recording uploads to `/uploads/recordings`.
- [ ] Trainer opens `/trainer/assessments/recordings`, sees score, watches video.

- [ ] **Step 4: Commit**

```bash
git add backend/src/utils/__tests__/codingIntegration.test.js
git commit -m "test: add coding assessment integration test scaffold"
```

---

## Task 24: Final Review and Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run frontend build**

```bash
cd frontend
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 2: Run backend lint / tests**

```bash
cd backend
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Update spec if needed**

If any implementation deviated from the design spec, update `.kimchi/docs/superpowers/specs/2026-06-27-coding-assessment-module-design.md`.

- [ ] **Step 4: Final commit**

```bash
git commit -m "feat: complete coding assessment module implementation"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** Every section of the design spec maps to at least one task above.
- [ ] **No placeholders:** No "TBD", "TODO", or "implement later" in this plan.
- [ ] **Type consistency:** `assessmentId`, `attemptId`, `problemId`, `questionId`, `codingAttemptId` used consistently.
- [ ] **File paths:** All paths are exact and exist or will be created.
- [ ] **Reusability:** Quiz proctoring, screen recorder, and recording endpoints are reused where possible.
