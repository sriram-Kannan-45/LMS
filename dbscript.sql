-- ============================================================
-- Supabase / PostgreSQL Database Script for Training Management LMS
-- Generated from Sequelize models (MySQL → PostgreSQL conversion)
-- ============================================================

-- -----------------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------------
CREATE TYPE user_role AS ENUM ('ADMIN', 'TRAINER', 'PARTICIPANT');
CREATE TYPE user_status AS ENUM ('PENDING', 'APPROVED');
CREATE TYPE course_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE enrollment_status AS ENUM ('PENDING', 'ENROLLED', 'COMPLETED', 'CANCELLED');
CREATE TYPE notification_type AS ENUM ('ENROLLMENT', 'NOTE_UPLOAD', 'APPROVAL', 'FEEDBACK_REPLY', 'ASSIGNMENT', 'OTHER');
CREATE TYPE survey_question_type AS ENUM ('RATING', 'TEXT', 'MULTIPLE_CHOICE');
CREATE TYPE note_file_type AS ENUM ('PDF', 'IMAGE', 'VIDEO', 'LINK');
CREATE TYPE note_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE activity_status AS ENUM ('SUCCESS', 'FAILED');
CREATE TYPE live_session_status AS ENUM ('scheduled', 'live', 'ended');
CREATE TYPE lesson_material_type AS ENUM ('NOTE', 'VIDEO', 'IMAGE', 'LINK', 'PDF', 'PPT');
CREATE TYPE ai_document_status AS ENUM ('PROCESSING', 'READY', 'ERROR');
CREATE TYPE ai_quiz_difficulty AS ENUM ('EASY', 'MEDIUM', 'HARD', 'MIXED');
CREATE TYPE ai_quiz_status AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE quiz_visibility AS ENUM ('HIDDEN', 'PUBLISHED');
CREATE TYPE ai_question_type AS ENUM ('MCQ', 'SHORT_ANSWER');
CREATE TYPE ai_question_difficulty AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE quiz_attempt_status AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EVALUATED');
CREATE TYPE lesson_quiz_progress_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE assessment_submission_status AS ENUM ('NOT_STARTED', 'SUBMITTED', 'REVIEWED', 'PUBLISHED');
CREATE TYPE coding_assessment_status AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE coding_question_difficulty AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE coding_submission_status AS ENUM ('PENDING', 'PASSED', 'FAILED', 'PARTIAL', 'CE', 'RE', 'TLE', 'MLE');
CREATE TYPE submission_result_status AS ENUM ('PASSED', 'FAILED', 'TLE', 'CE', 'RE', 'MLE');
CREATE TYPE coding_violation_type AS ENUM ('SCREEN_SHARE_STOP', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'COPY_PASTE', 'OTHER');
CREATE TYPE coding_attempt_status AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'EXPIRED');
CREATE TYPE plagiarism_flag_level AS ENUM ('NONE', 'MEDIUM', 'HIGH');
CREATE TYPE exam_session_status AS ENUM ('PENDING', 'ACTIVE', 'SUBMITTED', 'TERMINATED', 'EXPIRED');
CREATE TYPE proctor_violation_type AS ENUM (
  'FULLSCREEN_EXIT', 'TAB_SWITCH', 'WINDOW_BLUR', 'BROWSER_MINIMIZE',
  'SCREEN_SHARE_STOPPED', 'SCREEN_SHARE_DENIED', 'COPY_ATTEMPT', 'PASTE_ATTEMPT',
  'RIGHT_CLICK', 'BLOCKED_SHORTCUT', 'DEVTOOLS_OPENED', 'REFRESH_ATTEMPT',
  'NAVIGATION_ATTEMPT', 'MULTIPLE_LOGIN', 'NETWORK_LOST', 'HEARTBEAT_LOST', 'TERMINATED'
);
CREATE TYPE proctor_severity AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE assessment_session_status AS ENUM ('ACTIVE', 'EXPIRED', 'RESET');

-- -----------------------------------------------------------
-- 2. CORE USER & AUTH TABLES
-- -----------------------------------------------------------

-- 2.1 users
CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(255),
  dob DATE,
  "profilePic" VARCHAR(255),
  username VARCHAR(255) UNIQUE,
  role user_role NOT NULL DEFAULT 'PARTICIPANT',
  status user_status NOT NULL DEFAULT 'PENDING',
  "isDeleted" BOOLEAN DEFAULT FALSE,
  "deletedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 password_reset_otps
CREATE TABLE password_reset_otps (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  "otpHash" VARCHAR(255) NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  ip VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 3. PROFILE TABLES
-- -----------------------------------------------------------

-- 3.1 trainer_profiles
CREATE TABLE trainer_profiles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
  dob DATE,
  phone VARCHAR(255),
  address TEXT,
  qualification VARCHAR(255),
  experience VARCHAR(255),
  image_path VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 participant_profiles
CREATE TABLE participant_profiles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
  display_name VARCHAR(80),
  bio VARCHAR(500),
  avatar_url TEXT,
  skills TEXT,
  links TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 4. TRAINING PROGRAM & COURSE STRUCTURE
-- -----------------------------------------------------------

-- 4.1 training_programs (legacy name: trainings)
CREATE TABLE training_programs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url VARCHAR(500),
  trainer_id BIGINT REFERENCES users(id),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  capacity INTEGER,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.2 courses
CREATE TABLE courses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  training_program_id BIGINT NOT NULL REFERENCES training_programs(id),
  trainer_id BIGINT NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status course_status NOT NULL DEFAULT 'DRAFT',
  thumbnail_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.3 course_trainer_assignments
CREATE TABLE course_trainer_assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES courses(id),
  trainer_id BIGINT NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, trainer_id)
);

-- 4.4 lessons
CREATE TABLE lessons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id BIGINT REFERENCES courses(id),
  training_id BIGINT REFERENCES training_programs(id),
  trainer_id BIGINT NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.5 lesson_materials
CREATE TABLE lesson_materials (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_id BIGINT NOT NULL REFERENCES lessons(id),
  material_type lesson_material_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  file_url VARCHAR(500),
  link_url VARCHAR(500),
  file_name VARCHAR(255),
  file_size INTEGER,
  thumbnail_url VARCHAR(500),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 5. ENROLLMENT & PROGRESS
-- -----------------------------------------------------------

-- 5.1 enrollments
CREATE TABLE enrollments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  participant_id BIGINT NOT NULL REFERENCES users(id),
  course_id BIGINT REFERENCES courses(id),
  training_id BIGINT REFERENCES training_programs(id),
  status enrollment_status NOT NULL DEFAULT 'PENDING',
  progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.2 lesson_progress
CREATE TABLE lesson_progress (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_id BIGINT NOT NULL REFERENCES lessons(id),
  participant_id BIGINT NOT NULL REFERENCES users(id),
  content_viewed BOOLEAN NOT NULL DEFAULT FALSE,
  status lesson_quiz_progress_status NOT NULL DEFAULT 'NOT_STARTED',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lesson_id, participant_id)
);

-- -----------------------------------------------------------
-- 6. FEEDBACK & SURVEYS
-- -----------------------------------------------------------

-- 6.1 feedbacks
CREATE TABLE feedbacks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  participant_id BIGINT NOT NULL REFERENCES users(id),
  training_id BIGINT NOT NULL REFERENCES training_programs(id),
  "trainerRating" INTEGER NOT NULL CHECK ("trainerRating" >= 1 AND "trainerRating" <= 5),
  "subjectRating" INTEGER NOT NULL CHECK ("subjectRating" >= 1 AND "subjectRating" <= 5),
  comments TEXT,
  anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  "trainerResponse" TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.2 survey_questions
CREATE TABLE survey_questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  training_id BIGINT REFERENCES training_programs(id),
  "questionText" TEXT NOT NULL,
  "questionType" survey_question_type NOT NULL DEFAULT 'TEXT',
  options JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.3 survey_answers
CREATE TABLE survey_answers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feedback_id BIGINT NOT NULL REFERENCES feedbacks(id),
  question_id BIGINT NOT NULL REFERENCES survey_questions(id),
  "answerText" TEXT,
  "answerRating" INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 7. NOTES (Standalone Trainer Resources)
-- -----------------------------------------------------------

CREATE TABLE notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  "fileUrl" VARCHAR(255),
  "fileType" note_file_type,
  "fileName" VARCHAR(255),
  "fileSize" INTEGER,
  "trainerId" BIGINT NOT NULL REFERENCES users(id),
  "trainingId" BIGINT REFERENCES training_programs(id),
  status note_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 8. NOTIFICATIONS
-- -----------------------------------------------------------

CREATE TABLE notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  message VARCHAR(255) NOT NULL,
  type notification_type DEFAULT 'OTHER',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  action_url VARCHAR(255),
  related_entity_id BIGINT,
  related_entity_type VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 9. ACTIVITY LOGS
-- -----------------------------------------------------------

CREATE TABLE activity_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "userId" BIGINT REFERENCES users(id),
  "userName" VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  "entityType" VARCHAR(255),
  "entityId" BIGINT,
  details TEXT,
  "ipAddress" VARCHAR(255),
  "userAgent" VARCHAR(255),
  status activity_status DEFAULT 'SUCCESS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 10. LIVE SESSIONS & CHAT
-- -----------------------------------------------------------

-- 10.1 live_sessions
CREATE TABLE live_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  trainer_id BIGINT NOT NULL REFERENCES users(id),
  training_id BIGINT REFERENCES training_programs(id),
  status live_session_status NOT NULL DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_url VARCHAR(500),
  room_id VARCHAR(100) NOT NULL UNIQUE,
  max_participants INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10.2 session_attendance
CREATE TABLE session_attendance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  session_id BIGINT NOT NULL REFERENCES live_sessions(id),
  join_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  leave_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10.3 chat_messages
CREATE TABLE chat_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id BIGINT NOT NULL REFERENCES users(id),
  room_id VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  seen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 11. AI QUIZ SYSTEM
-- -----------------------------------------------------------

-- 11.1 ai_documents
CREATE TABLE ai_documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trainer_id BIGINT NOT NULL REFERENCES users(id),
  training_id BIGINT REFERENCES training_programs(id),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  file_url VARCHAR(255),
  file_type VARCHAR(255),
  status ai_document_status NOT NULL DEFAULT 'READY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11.2 ai_quizzes
CREATE TABLE ai_quizzes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id BIGINT REFERENCES courses(id),
  lesson_id BIGINT REFERENCES lessons(id),
  document_id BIGINT REFERENCES ai_documents(id),
  trainer_id BIGINT NOT NULL REFERENCES users(id),
  training_id BIGINT REFERENCES training_programs(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  time_limit INTEGER DEFAULT 30,
  num_questions INTEGER,
  difficulty ai_quiz_difficulty NOT NULL DEFAULT 'MIXED',
  status ai_quiz_status NOT NULL DEFAULT 'DRAFT',
  is_active BOOLEAN DEFAULT TRUE,
  result_status quiz_visibility NOT NULL DEFAULT 'HIDDEN',
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11.3 ai_questions
CREATE TABLE ai_questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quiz_id BIGINT NOT NULL REFERENCES ai_quizzes(id),
  question_text TEXT NOT NULL,
  question_type ai_question_type NOT NULL,
  options JSONB,
  correct_answer TEXT,
  explanation TEXT,
  difficulty ai_question_difficulty NOT NULL DEFAULT 'MEDIUM',
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11.4 quiz_attempts
CREATE TABLE quiz_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quiz_id BIGINT NOT NULL REFERENCES ai_quizzes(id),
  participant_id BIGINT NOT NULL REFERENCES users(id),
  status quiz_attempt_status NOT NULL DEFAULT 'IN_PROGRESS',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  time_taken INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (participant_id, quiz_id)
);

-- 11.5 quiz_answers
CREATE TABLE quiz_answers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id BIGINT NOT NULL REFERENCES quiz_attempts(id),
  question_id BIGINT NOT NULL REFERENCES ai_questions(id),
  answer_text TEXT,
  selected_option INTEGER,
  is_correct BOOLEAN,
  score NUMERIC(5,2) DEFAULT 0,
  feedback TEXT,
  evaluated_by_ai BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11.6 quiz_results
CREATE TABLE quiz_results (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id BIGINT NOT NULL UNIQUE REFERENCES quiz_attempts(id),
  quiz_id BIGINT NOT NULL REFERENCES ai_quizzes(id),
  participant_id BIGINT NOT NULL REFERENCES users(id),
  total_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(5,2) NOT NULL,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  rank INTEGER,
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 12. LESSON WORKFLOW (Quiz/Assessment Gating + Progress)
-- -----------------------------------------------------------

-- 12.1 lesson_quizzes
CREATE TABLE lesson_quizzes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_id BIGINT NOT NULL REFERENCES lessons(id),
  quiz_id BIGINT NOT NULL REFERENCES ai_quizzes(id),
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  result_status quiz_visibility NOT NULL DEFAULT 'HIDDEN',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12.2 lesson_assessments
CREATE TABLE lesson_assessments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_id BIGINT NOT NULL REFERENCES lessons(id),
  title VARCHAR(255) NOT NULL,
  instructions TEXT,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12.3 assessment_submissions
CREATE TABLE assessment_submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assessment_id BIGINT NOT NULL REFERENCES lesson_assessments(id),
  participant_id BIGINT NOT NULL REFERENCES users(id),
  content TEXT,
  file_url VARCHAR(500),
  status assessment_submission_status NOT NULL DEFAULT 'SUBMITTED',
  score NUMERIC(5,2),
  feedback TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, participant_id)
);

-- 12.4 quiz_progress
CREATE TABLE quiz_progress (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_quiz_id BIGINT NOT NULL REFERENCES lesson_quizzes(id),
  participant_id BIGINT NOT NULL REFERENCES users(id),
  status lesson_quiz_progress_status NOT NULL DEFAULT 'NOT_STARTED',
  score NUMERIC(5,2),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lesson_quiz_id, participant_id)
);

-- -----------------------------------------------------------
-- 13. CODING ASSESSMENT MODULE
-- -----------------------------------------------------------

-- 13.1 coding_assessments
CREATE TABLE coding_assessments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id BIGINT REFERENCES courses(id),
  lesson_id BIGINT REFERENCES lessons(id),
  trainer_id BIGINT NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  time_limit INTEGER NOT NULL DEFAULT 60,
  status coding_assessment_status NOT NULL DEFAULT 'DRAFT',
  result_status quiz_visibility NOT NULL DEFAULT 'HIDDEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13.2 coding_questions
CREATE TABLE coding_questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assessment_id BIGINT NOT NULL REFERENCES coding_assessments(id),
  title VARCHAR(255) NOT NULL,
  problem_description TEXT NOT NULL,
  input_format TEXT,
  output_format TEXT,
  constraints TEXT,
  sample_input TEXT,
  sample_output TEXT,
  explanation TEXT,
  difficulty coding_question_difficulty NOT NULL DEFAULT 'medium',
  marks INTEGER NOT NULL DEFAULT 10,
  tags JSONB,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13.3 coding_test_cases
CREATE TABLE coding_test_cases (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES coding_questions(id),
  input TEXT,
  expected_output TEXT,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13.4 coding_attempts
CREATE TABLE coding_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assessment_id BIGINT NOT NULL REFERENCES coding_assessments(id),
  participant_id BIGINT NOT NULL REFERENCES users(id),
  status coding_attempt_status NOT NULL DEFAULT 'IN_PROGRESS',
  score REAL NOT NULL DEFAULT 0,
  violation_count INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13.5 coding_submissions
CREATE TABLE coding_submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id BIGINT NOT NULL REFERENCES coding_attempts(id),
  question_id BIGINT NOT NULL REFERENCES coding_questions(id),
  participant_id BIGINT NOT NULL REFERENCES users(id),
  language VARCHAR(255) NOT NULL,
  source_code TEXT NOT NULL,
  status coding_submission_status NOT NULL DEFAULT 'PENDING',
  score REAL NOT NULL DEFAULT 0,
  passed_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  is_final BOOLEAN NOT NULL DEFAULT FALSE,
  ai_review JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13.6 coding_submission_results
CREATE TABLE coding_submission_results (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES coding_submissions(id),
  test_case_id BIGINT REFERENCES coding_test_cases(id),
  status submission_result_status NOT NULL DEFAULT 'FAILED',
  runtime_ms INTEGER NOT NULL DEFAULT 0,
  memory_kb INTEGER NOT NULL DEFAULT 0,
  actual_output TEXT,
  error_message TEXT,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13.7 coding_violations
CREATE TABLE coding_violations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id BIGINT NOT NULL REFERENCES coding_attempts(id),
  participant_id BIGINT REFERENCES users(id),
  type coding_violation_type NOT NULL DEFAULT 'OTHER',
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13.8 coding_plagiarism_reports
CREATE TABLE coding_plagiarism_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assessment_id BIGINT NOT NULL REFERENCES coding_assessments(id),
  question_id BIGINT NOT NULL REFERENCES coding_questions(id),
  participant_a_id BIGINT NOT NULL REFERENCES users(id),
  participant_b_id BIGINT NOT NULL REFERENCES users(id),
  submission_a_id BIGINT NOT NULL REFERENCES coding_submissions(id),
  submission_b_id BIGINT NOT NULL REFERENCES coding_submissions(id),
  similarity_score REAL NOT NULL DEFAULT 0,
  flag_level plagiarism_flag_level NOT NULL DEFAULT 'NONE',
  compared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 13.9 CODING ASSESSMENT SCHEMA EXTENSIONS (Proctored Workflow)
-- -----------------------------------------------------------

ALTER TABLE coding_assessments
  ADD COLUMN IF NOT EXISTS training_id BIGINT REFERENCES training_programs(id),
  ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS passing_score INT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS difficulty coding_question_difficulty NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS language VARCHAR(50) NOT NULL DEFAULT 'javascript',
  ADD COLUMN IF NOT EXISTS is_proctored BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS max_violations INT NOT NULL DEFAULT 3;

ALTER TABLE coding_questions
  ADD COLUMN IF NOT EXISTS statement TEXT,
  ADD COLUMN IF NOT EXISTS starter_code TEXT,
  ADD COLUMN IF NOT EXISTS time_limit_sec INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS memory_limit_mb INT NOT NULL DEFAULT 256,
  ADD COLUMN IF NOT EXISTS order_index INT NOT NULL DEFAULT 0;

ALTER TABLE coding_test_cases
  ADD COLUMN IF NOT EXISTS order_index INT NOT NULL DEFAULT 0;

ALTER TABLE coding_attempts
  ADD COLUMN IF NOT EXISTS session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS total_score INT NOT NULL DEFAULT 0;

ALTER TABLE coding_submissions
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS tests_passed INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tests_total INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE coding_violations
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE exam_sessions
  ADD COLUMN IF NOT EXISTS assessment_type VARCHAR(20) NOT NULL DEFAULT 'quiz',
  ADD COLUMN IF NOT EXISTS assessment_id BIGINT,
  ALTER COLUMN quiz_id DROP NOT NULL;

ALTER TABLE IF EXISTS quiz_recordings
  ADD COLUMN IF NOT EXISTS assessment_type VARCHAR(20) NOT NULL DEFAULT 'quiz',
  ADD COLUMN IF NOT EXISTS coding_attempt_id BIGINT REFERENCES coding_attempts(id),
  ALTER COLUMN quiz_id DROP NOT NULL;

-- -----------------------------------------------------------
-- 14. PROCTORING MODULE
-- -----------------------------------------------------------

-- 14.1 device_fingerprints
CREATE TABLE device_fingerprints (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  fingerprint_hash VARCHAR(128) NOT NULL,
  label VARCHAR(120),
  ip_address VARCHAR(64),
  user_agent VARCHAR(512),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_trusted BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, fingerprint_hash)
);

-- 14.2 exam_sessions
CREATE TABLE exam_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quiz_id BIGINT NOT NULL REFERENCES ai_quizzes(id),
  attempt_id BIGINT REFERENCES quiz_attempts(id),
  participant_id BIGINT NOT NULL REFERENCES users(id),
  session_token VARCHAR(128) NOT NULL UNIQUE,
  device_fingerprint_id BIGINT REFERENCES device_fingerprints(id),
  status exam_session_status NOT NULL DEFAULT 'PENDING',
  warnings_count INTEGER NOT NULL DEFAULT 0,
  fullscreen_exits INTEGER NOT NULL DEFAULT 0,
  is_fullscreen BOOLEAN NOT NULL DEFAULT FALSE,
  is_screen_sharing BOOLEAN NOT NULL DEFAULT FALSE,
  is_online BOOLEAN NOT NULL DEFAULT TRUE,
  ip_address VARCHAR(64),
  user_agent VARCHAR(512),
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  termination_reason VARCHAR(255),
  encrypted_payload TEXT,
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14.3 proctor_violations
CREATE TABLE proctor_violations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES exam_sessions(id),
  participant_id BIGINT NOT NULL REFERENCES users(id),
  quiz_id BIGINT NOT NULL REFERENCES ai_quizzes(id),
  type proctor_violation_type NOT NULL,
  severity proctor_severity NOT NULL DEFAULT 'MEDIUM',
  message VARCHAR(500),
  metadata JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14.4 proctor_activities
CREATE TABLE proctor_activities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES exam_sessions(id),
  participant_id BIGINT NOT NULL REFERENCES users(id),
  event_type VARCHAR(64) NOT NULL,
  payload JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 15. SECURE ASSESSMENT SESSION LOCK
-- -----------------------------------------------------------

CREATE TABLE assessment_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id BIGINT NOT NULL UNIQUE REFERENCES quiz_attempts(id),
  quiz_id BIGINT NOT NULL REFERENCES ai_quizzes(id),
  participant_id BIGINT NOT NULL REFERENCES users(id),
  ip_address VARCHAR(64),
  user_agent TEXT,
  device_fingerprint VARCHAR(512),
  session_token VARCHAR(512) NOT NULL,
  status assessment_session_status NOT NULL DEFAULT 'ACTIVE',
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  reset_by_admin BIGINT REFERENCES users(id),
  reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 16. INDEXES
-- -----------------------------------------------------------

-- users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- training_programs
CREATE INDEX idx_training_programs_created_by ON training_programs(created_by);
CREATE INDEX idx_training_programs_trainer_id ON training_programs(trainer_id);

-- courses
CREATE INDEX idx_courses_training_program_id ON courses(training_program_id);
CREATE INDEX idx_courses_trainer_id ON courses(trainer_id);
CREATE INDEX idx_courses_status ON courses(status);

-- lessons
CREATE INDEX idx_lessons_course_id ON lessons(course_id);
CREATE INDEX idx_lessons_training_id ON lessons(training_id);
CREATE INDEX idx_lessons_trainer_id ON lessons(trainer_id);
CREATE INDEX idx_lessons_order_index ON lessons(order_index);

-- lesson_materials
CREATE INDEX idx_lesson_materials_lesson_order ON lesson_materials(lesson_id, order_index);
CREATE INDEX idx_lesson_materials_material_type ON lesson_materials(material_type);

-- enrollments
CREATE INDEX idx_enrollments_participant_id ON enrollments(participant_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_training_id ON enrollments(training_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);
CREATE UNIQUE INDEX idx_enrollments_course_participant ON enrollments(course_id, participant_id);

-- feedbacks
CREATE INDEX idx_feedbacks_participant_id ON feedbacks(participant_id);
CREATE INDEX idx_feedbacks_training_id ON feedbacks(training_id);

-- notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- activity_logs
CREATE INDEX idx_activity_logs_user_id ON activity_logs("userId");
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- live_sessions
CREATE INDEX idx_live_sessions_trainer_id ON live_sessions(trainer_id);
CREATE INDEX idx_live_sessions_status ON live_sessions(status);

-- session_attendance
CREATE INDEX idx_session_attendance_user_id ON session_attendance(user_id);
CREATE INDEX idx_session_attendance_session_id ON session_attendance(session_id);

-- chat_messages
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);

-- ai_quizzes
CREATE INDEX idx_ai_quizzes_course_id ON ai_quizzes(course_id);
CREATE INDEX idx_ai_quizzes_lesson_id ON ai_quizzes(lesson_id);
CREATE INDEX idx_ai_quizzes_trainer_id ON ai_quizzes(trainer_id);
CREATE INDEX idx_ai_quizzes_status ON ai_quizzes(status);

-- ai_questions
CREATE INDEX idx_ai_questions_quiz_id ON ai_questions(quiz_id);

-- quiz_attempts
CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_participant_id ON quiz_attempts(participant_id);

-- quiz_answers
CREATE INDEX idx_quiz_answers_attempt_id ON quiz_answers(attempt_id);
CREATE INDEX idx_quiz_answers_question_id ON quiz_answers(question_id);

-- coding_assessments
CREATE INDEX idx_coding_assessments_course_id ON coding_assessments(course_id);
CREATE INDEX idx_coding_assessments_lesson_id ON coding_assessments(lesson_id);

-- coding_questions
CREATE INDEX idx_coding_questions_assessment_id ON coding_questions(assessment_id);

-- coding_test_cases
CREATE INDEX idx_coding_test_cases_question_id ON coding_test_cases(question_id);

-- coding_attempts
CREATE INDEX idx_coding_attempts_assessment_id ON coding_attempts(assessment_id);
CREATE INDEX idx_coding_attempts_participant_id ON coding_attempts(participant_id);

-- coding_submissions
CREATE INDEX idx_coding_submissions_attempt_id ON coding_submissions(attempt_id);
CREATE INDEX idx_coding_submissions_question_id ON coding_submissions(question_id);

-- coding_submission_results
CREATE INDEX idx_coding_submission_results_submission_id ON coding_submission_results(submission_id);

-- coding_plagiarism_reports
CREATE INDEX idx_coding_plagiarism_assessment_id ON coding_plagiarism_reports(assessment_id);

-- proctoring
CREATE INDEX idx_exam_sessions_participant_id ON exam_sessions(participant_id);
CREATE INDEX idx_exam_sessions_quiz_id ON exam_sessions(quiz_id);
CREATE INDEX idx_exam_sessions_status ON exam_sessions(status);

CREATE INDEX idx_proctor_violations_session_id ON proctor_violations(session_id);
CREATE INDEX idx_proctor_violations_participant_id ON proctor_violations(participant_id);
CREATE INDEX idx_proctor_violations_quiz_id ON proctor_violations(quiz_id);
CREATE INDEX idx_proctor_violations_type ON proctor_violations(type);

CREATE INDEX idx_proctor_activities_session_id ON proctor_activities(session_id);
CREATE INDEX idx_proctor_activities_participant_id ON proctor_activities(participant_id);
CREATE INDEX idx_proctor_activities_event_type ON proctor_activities(event_type);

CREATE INDEX idx_device_fingerprints_user_id ON device_fingerprints(user_id);
CREATE INDEX idx_device_fingerprints_hash ON device_fingerprints(fingerprint_hash);

-- assessment_sessions
CREATE INDEX idx_assessment_sessions_participant_quiz_status ON assessment_sessions(participant_id, quiz_id, status);
CREATE INDEX idx_assessment_sessions_session_token ON assessment_sessions(session_token);
CREATE INDEX idx_assessment_sessions_expires_at ON assessment_sessions(expires_at);

-- course_trainer_assignments
CREATE INDEX idx_cta_trainer_id ON course_trainer_assignments(trainer_id);

-- -----------------------------------------------------------
-- 17. SEED DATA (Admin User)
-- -----------------------------------------------------------
-- Password: admin123 (bcrypt hash)
-- IMPORTANT: Change this password after first login!
INSERT INTO users (name, email, password, role, status, username)
VALUES (
  'System Admin',
  'admin@feedweb.com',
  '$2a$10$YourBcryptHashHere',
  'ADMIN',
  'APPROVED',
  'admin'
) ON CONFLICT (email) DO NOTHING;
