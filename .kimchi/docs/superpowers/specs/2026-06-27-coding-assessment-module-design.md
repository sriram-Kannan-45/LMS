# Coding Assessment Module — Design Specification

**Date:** 2026-06-27  
**Ferment:** coding-assessment-module  
**Goal:** Build a fully proctored Coding Assessment module inside Wave Init LMS that mirrors the existing Quiz module's 6-stage workflow, replacing MCQ questions with a code editor, test-case execution, and trainer code review.

---

## 1. Scope & Decisions

| Decision | Choice |
|----------|--------|
| Build scope | Full 6-stage end-to-end module |
| Existing code | Extend existing `CodingAssessment`, `CodingQuestion`, `TestCase`, `CodingAttempt`, `CodingSubmission`, `CodingViolation` models |
| Scope level | Training (`training_id`); keep `course_id`/`lesson_id` nullable for future lesson gating |
| Proctoring | Reuse existing `ProctorContext` + `useScreenRecorder` + quiz violation flow |
| Code execution | Piston API (`https://emkc.org/api/v2/piston/execute`) via backend proxy |
| Result visibility | Mirror quiz — hidden until trainer publishes |
| Implementation order | Vertical slice first: one problem end-to-end, then generalize to many problems |

---

## 2. Data Model

### 2.1 Extend Existing Tables

All tables already exist in `dbscript.sql` and as Sequelize models. The following columns are added to align with the spec.

#### `coding_assessments`

| Column | Type | Notes |
|--------|------|-------|
| `training_id` | BIGINT FK → `training_programs.id` | New; primary scope for this build |
| `duration_minutes` | INT | Assessment-level timer |
| `passing_score` | INT | Percentage required to pass |
| `difficulty` | ENUM('easy','medium','hard') | Already exists as question-level; now also assessment-level |
| `language` | VARCHAR(50) | Default language for participant editor |
| `is_proctored` | BOOLEAN DEFAULT true | Mirrors quiz proctoring flag |
| `max_violations` | INT DEFAULT 3 | Auto-submit threshold |
| `status` | ENUM('DRAFT','PUBLISHED','CLOSED') | Already exists |
| `course_id` | BIGINT FK → `courses.id` | Nullable; existing |
| `lesson_id` | BIGINT FK → `lessons.id` | Nullable; existing |

#### `coding_questions`

| Column | Type | Notes |
|--------|------|-------|
| `statement` | TEXT | Rich-text/markdown problem statement. Alias/migrate from `problem_description` |
| `starter_code` | TEXT | Pre-filled editor template |
| `time_limit_sec` | INT DEFAULT 5 | Per-problem execution timeout |
| `memory_limit_mb` | INT DEFAULT 256 | Per-problem memory limit |
| `order_index` | INT | Problem ordering |
| `input_format` | TEXT | Existing |
| `output_format` | TEXT | Existing |
| `constraints` | TEXT | Existing |
| `explanation` | TEXT | Existing |
| `difficulty` | ENUM('easy','medium','hard') | Existing |
| `marks` | INT DEFAULT 10 | Existing; points per problem |

#### `coding_test_cases`

| Column | Type | Notes |
|--------|------|-------|
| `order_index` | INT | Test case ordering |
| `input` | TEXT | Existing |
| `expected_output` | TEXT | Existing |
| `is_hidden` | BOOLEAN | Existing |

#### `coding_attempts`

| Column | Type | Notes |
|--------|------|-------|
| `session_id` | VARCHAR | Proctoring session token |
| `started_at` | TIMESTAMP | Existing `created_at` is not enough for timer calc |
| `total_score` | INT | Sum of final problem scores |
| `violation_count` | INT DEFAULT 0 | Existing |
| `status` | ENUM('IN_PROGRESS','SUBMITTED','AUTO_SUBMITTED','EXPIRED') | Existing |
| `submitted_at` | TIMESTAMP | Existing |

#### `coding_submissions`

| Column | Type | Notes |
|--------|------|-------|
| `code` | TEXT | Alias/migrate from `source_code` |
| `tests_passed` | INT | Alias/migrate from `passed_count` |
| `tests_total` | INT | Alias/migrate from `total_count` |
| `submitted_at` | TIMESTAMP | When this problem was submitted |
| `language` | VARCHAR(50) | Existing |
| `score` | FLOAT | Existing |
| `is_final` | BOOLEAN | Existing; marks the last submission per problem |

#### `coding_violations`

| Column | Type | Notes |
|--------|------|-------|
| `type` | ENUM | Extend to include quiz violation types: `TAB_SWITCH`, `FULLSCREEN_EXIT`, `SCREEN_SHARE_STOP`, `COPY_PASTE`, `OTHER` |
| `message` | TEXT | Human-readable description |
| `metadata` | JSON | Extra context (timestamp, fullscreen state, etc.) |
| `occurred_at` | TIMESTAMP | When the violation happened |

#### `quiz_recordings`

| Column | Type | Notes |
|--------|------|-------|
| `assessment_type` | ENUM('quiz','coding_assessment') DEFAULT 'quiz' | Distinguishes quiz vs coding recordings |
| `quiz_id` | BIGINT FK → `ai_quizzes.id` | Nullable when `assessment_type='coding_assessment'` |
| `coding_attempt_id` | BIGINT FK → `coding_attempts.id` | Nullable when `assessment_type='quiz'` |

#### `exam_sessions`

| Column | Type | Notes |
|--------|------|-------|
| `assessment_type` | ENUM('quiz','coding_assessment') DEFAULT 'quiz' | New |
| `quiz_id` | BIGINT FK → `ai_quizzes.id` | Nullable for coding sessions; rename semantic to `assessment_id` in API |
| `attempt_id` | BIGINT | References either `quiz_attempts.id` or `coding_attempts.id` depending on type |

### 2.2 Associations

Associations are already declared in `backend/src/models/index.js` and remain valid. Add:

- `CodingAssessment.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' })`
- `Training.hasMany(CodingAssessment, { foreignKey: 'trainingId', as: 'codingAssessments' })`
- `QuizRecording.belongsTo(CodingAttempt, { foreignKey: 'codingAttemptId', as: 'codingAttempt' })`
- `ExamSession.belongsTo(CodingAttempt, { foreignKey: 'attemptId', as: 'codingAttempt' })` (in addition to existing `QuizAttempt` association)

Make `ExamSession.quizId` nullable and add `ExamSession.assessmentType` ENUM('quiz','coding_assessment') so a single session row can represent either a quiz or a coding assessment.

---

## 3. API Contract

### 3.1 Assessment Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/coding-assessments` | TRAINER/ADMIN | Create assessment with problems and test cases |
| GET | `/api/coding-assessments` | TRAINER/ADMIN | List trainer's own assessments |
| GET | `/api/coding-assessments/:id` | TRAINER/ADMIN | Get full assessment including problems/test cases |
| PUT | `/api/coding-assessments/:id` | TRAINER/ADMIN | Update assessment |
| DELETE | `/api/coding-assessments/:id` | TRAINER/ADMIN | Delete assessment and children |
| POST | `/api/coding-assessments/:id/publish` | TRAINER/ADMIN | Publish assessment |
| POST | `/api/coding-assessments/:id/close` | TRAINER/ADMIN | Close assessment |

### 3.2 Participant Attempt

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/coding-attempts/start` | PARTICIPANT | Start/resume attempt; returns attemptId + sessionToken |
| GET | `/api/coding-attempts/:id` | PARTICIPANT | Get attempt state |
| POST | `/api/coding-attempts/:id/submit` | PARTICIPANT | Final submit + stop timer |

### 3.3 Code Execution

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/code/run` | PARTICIPANT | Run against visible (sample) test cases only |
| POST | `/api/code/submit` | PARTICIPANT | Run against all test cases, score, persist submission |

### 3.4 Proctoring

Reuse the existing proctoring controller and `ExamSession`/`Violation` tables. The coding flow calls:

- `POST /api/proctor/sessions/start` with `{ assessmentType: 'coding_assessment', assessmentId, attemptId, ... }`
- `POST /api/proctor/sessions/:sessionId/activate`
- `POST /api/proctor/sessions/:sessionId/violation`
- `POST /api/proctor/sessions/:sessionId/submit`

The server stores `assessmentType='coding_assessment'`, `assessmentId`, and `attemptId` (coding attempt id). The existing `quizId` column is left nullable for coding sessions.

### 3.5 Recording & Review

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/recordings/upload` | PARTICIPANT/TRAINER/ADMIN | Upload webm; body includes `assessment_type='coding_assessment'` and `codingAttemptId` |
| GET | `/api/recordings?type=coding` | TRAINER/ADMIN | List coding assessment recordings |
| GET | `/api/recordings/:id` | TRAINER/ADMIN | Single recording + violations |
| GET | `/api/recordings/:id/stream` | TRAINER/ADMIN/PARTICIPANT | Stream video |
| GET | `/api/coding-submissions/:attemptId` | TRAINER/ADMIN | All final submissions for an attempt |
| GET | `/api/coding-assessments/:id/results` | TRAINER/ADMIN | Participant results summary |
| POST | `/api/coding-assessments/:id/publish-result` | TRAINER/ADMIN | Publish results |

---

## 4. Frontend Architecture

### 4.1 Pages

| Route | Component | Role |
|-------|-----------|------|
| `/trainer/trainings/:trainingId/assessments/create` | `CodingAssessmentBuilder.jsx` | Create/edit assessment |
| `/trainings/:trainingId/assessments/:assessmentId/attempt` | `CodingAssessmentAttempt.jsx` | Pre-exam readiness screen |
| `/trainings/:trainingId/assessments/:assessmentId/exam` | `CodingExamShell.jsx` | Coding shell |
| `/trainings/:trainingId/assessments/:assessmentId/result` | `CodingAssessmentResultPage.jsx` | Participant result view |
| `/trainer/assessments/recordings` | `CodingRecordings.jsx` | List recordings |
| `/trainer/assessments/recordings/:id` | `CodingRecordingViewer.jsx` | View recording + code |
| `/trainer/coding` | `CodingAssessmentForm.jsx` | Standalone trainer coding form |
| `/trainer/coding/:assessmentId/results` | `CodingAssessmentResults.jsx` | Trainer results view |
| `/participant/coding/:assessmentId` | `ParticipantCodingList.jsx` | Participant coding assessment list |

### 4.2 Components

- `src/components/coding-assessment/CodingEditor.jsx` — Monaco wrapper (`@monaco-editor/react`)
- `src/components/ProblemPanel.jsx` — Renders markdown statement, I/O format, constraints, sample cases
- `src/components/TestResultsPanel.jsx` — Shows pass/fail with output, expected, time
- `src/components/CodeSubmissionTabs.jsx` — Read-only code + results per problem (trainer view)
- Quiz violation log component — reused inline where needed

### 4.3 Hooks

- `useScreenRecorder.js` — Reuse existing hook; parameterize to accept `assessmentType` and `attemptId`
- `useCodeExecution.js` — New hook for `/api/code/run` and `/api/code/submit`
- `useProctor()` from `ProctorContext` — Reuse for violation reporting and session state

---

## 5. Proctoring & Recording Flow

1. Participant clicks "Start".
2. `CodingAssessmentAttempt.jsx` opens `AssessmentConsentGate` (reuse quiz gate) → acquires `getDisplayMedia` stream.
3. Start `useScreenRecorder` with the stream.
4. `POST /api/proctor/sessions/start` creates an `ExamSession` tagged to the coding attempt.
5. Socket join + activate session.
6. Enter fullscreen; navigate to `CodingExamShell.jsx`.
7. During exam:
   - `visibilitychange` / `fullscreenchange` / `window blur` → `proctor.report('TAB_SWITCH' | 'FULLSCREEN_EXIT', ...)`
   - On max violations → auto-submit and stop recording.
8. On submit/timer/violation max:
   - `stopRecording()` produces webm blob.
   - `POST /api/recordings/upload` with `assessment_type='coding_assessment'`.
   - `POST /api/coding-attempts/:id/submit` finalizes attempt.
9. Trainer views recording via `CodingRecordingViewer.jsx`, which reuses the quiz video player and adds code-submission tabs.

---

## 6. Code Execution Flow

### 6.1 Run (Sample Tests)

1. Frontend `POST /api/code/run` with `{ code, language, problemId, testType: 'sample' }`.
2. Backend fetches visible test cases for the problem.
3. For each test case, call Piston API with `{ language, version, files: [{ content: code }], stdin: input }`.
4. Compare `run.stdout.trim()` with `expected_output.trim()`.
5. Return array of `{ testCase, passed, output, expected, time, status }`.

### 6.2 Submit (All Tests)

1. Frontend `POST /api/code/submit` with `{ code, language, problemId, attemptId, testType: 'all' }`.
2. Backend runs all test cases including hidden ones.
3. Compute score: `(passed / total) * question.marks`.
4. Persist `CodingSubmission` with `is_final=true`, `tests_passed`, `tests_total`, `score`.
5. Update `CodingAttempt.total_score` to sum of final submissions.
6. Return score + results + hidden test summary.

### 6.3 Language Mapping

| UI Language | Piston Language | Piston Version |
|-------------|-----------------|----------------|
| JavaScript | `javascript` | `18.15.0` |
| Python | `python` | `3.10.0` |
| Java | `java` | `15.0.2` |
| C++ | `c++` | `10.2.0` |

### 6.4 Error Mapping

| Piston Outcome | Submission Result Status |
|----------------|--------------------------|
| `compile.code !== 0` | `CE` |
| `run.code !== 0` | `RE` |
| Timeout | `TLE` |
| stdout mismatch | `FAILED` |
| stdout match | `PASSED` |

---

## 7. Security & Error Handling

- **Access control:** Only enrolled participants can start; trainers/admins can only manage their own assessments (use `verifyTrainerAccess` helper).
- **One attempt rule:** Submitted attempts are blocked; in-progress attempts can be resumed.
- **Copy/paste in editor:** The code editor needs copy/paste enabled for coding, so `useQuizProtection` copy guards are scoped to the exam chrome, not the Monaco editor.
- **Code execution:** No `eval()` or local code execution; all code runs through Piston sandbox. Timeout enforced by Piston + a backend timeout wrapper.
- **Fullscreen:** Three-strike rule identical to quiz; auto-submit on third exit.
- **Screen share loss:** 30-second reconnect timer; auto-submit if not restored.
- **Piston failures:** Return user-friendly status codes (`CE`, `RE`, `TLE`) and log the raw response for debugging.

---

## 8. Testing Strategy

| Layer | What to test |
|-------|--------------|
| Unit | Piston response parser; score calculator; output comparator |
| Integration | Start attempt → run sample → submit all → result persisted → recording uploaded |
| E2E (manual) | Trainer creates assessment → participant attempts with screen share → trainer reviews recording + code |

---

## 9. Open Questions / Follow-ups

None remaining at design time. All scope, architecture, and integration choices have been confirmed.

---

## 10. Approval Log

- Design presented and approved by user on 2026-06-27.
