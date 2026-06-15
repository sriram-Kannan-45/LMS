/**
 * LMS Performance Indexes — Batch 2
 * ──────────────────────────────────────────────────────────────
 * Target: sub-500ms API responses at 10,000 concurrent users.
 *
 * Covers hot query patterns identified via query logging:
 *   • Admin dashboard (aggregate COUNT + AVG across 5+ tables)
 *   • Participant dashboard (enrollments, progress, quizzes)
 *   • Trainer dashboard (courses, participants, analytics)
 *   • AI quiz flows (attempts, results, leaderboard)
 *   • Proctoring (sessions, violations, heartbeats)
 *   • Notifications (unread counts per user)
 *
 * Idempotent — safe to run repeatedly.
 *
 * Usage:
 *   psql -U feedweb -d feedweb -f migrations/2026_06_15_lms_performance_indexes.sql
 * ────────────────────────────────────────────────────────────── */

-- ─── Users ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_role_status
  ON users (role, status);

-- ─── Enrollments (multi-role access) ────────────────────────
CREATE INDEX IF NOT EXISTS idx_enrollments_participant_course
  ON enrollments (participant_id, course_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_status
  ON enrollments (status);

-- ─── Activity Log (admin dashboard) ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_time
  ON activity_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action_time
  ON activity_logs (action, created_at DESC);

-- ─── Notifications ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, is_read, created_at DESC);

-- ─── AI Quizzes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_quizzes_lesson
  ON ai_quizzes (lesson_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_quizzes_course
  ON ai_quizzes (course_id, status);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz
  ON quiz_attempts (quiz_id, participant_id);

-- ─── Coding Assessments ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coding_assessments_trainer
  ON coding_assessments (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coding_submissions_status
  ON coding_submissions (status, created_at DESC);

-- ─── Proctoring ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_active
  ON exam_sessions (user_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_violations_session
  ON violations (session_id, timestamp);

-- ─── Progress ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lesson_progress_participant
  ON lesson_progress (participant_id, lesson_id);

-- ─── Feedback ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feedbacks_training_participant
  ON feedbacks (training_id, participant_id);

-- ─── Course analytics ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assessment_submissions_participant
  ON assessment_submissions (participant_id, assessment_id);

-- ─── Partial indexes for common filtered queries ────────────

-- Only pending participants
CREATE INDEX IF NOT EXISTS idx_users_pending_participants
  ON users (created_at DESC)
  WHERE role = 'PARTICIPANT' AND status = 'PENDING';

-- Only active enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_active
  ON enrollments (participant_id, enrolled_at DESC)
  WHERE status = 'ENROLLED';

-- Only unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- ─── ANALYZE updated tables ─────────────────────────────────
ANALYZE users;
ANALYZE enrollments;
ANALYZE activity_logs;
ANALYZE notifications;
ANALYZE ai_quizzes;
ANALYZE quiz_attempts;
ANALYZE coding_assessments;
ANALYZE exam_sessions;
ANALYZE violations;
ANALYZE lesson_progress;
ANALYZE feedbacks;
ANALYZE assessment_submissions;
