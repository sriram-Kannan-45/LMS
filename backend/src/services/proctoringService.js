/**
 * Proctoring service — pure business logic.
 *
 * Public functions are framework-agnostic (no req/res). Controllers and
 * socket handlers both call into this module so HTTP and WS paths stay
 * consistent. The persistence layer is Sequelize today; swap by editing
 * only this file.
 */
const { Op } = require('sequelize');
const {
  ExamSession,
  Violation,
  DeviceFingerprint,
  ProctorActivity,
  AIQuiz,
  QuizAttempt,
  CodingAttempt,
  User,
} = require('../models');
const { encrypt, decrypt, newSessionToken } = require('../utils/crypto');
const logger = require('../utils/logger');
const aiQuizService = require('./aiQuizService');

// ── Tunables ────────────────────────────────────────────────────────────────
const DEFAULT_MAX_FULLSCREEN_EXITS = 3;
const DEFAULT_MAX_WARNINGS = 5;
const HEARTBEAT_TIMEOUT_MS = 25_000;
const GRACE_PERIOD_DEFAULT_MINUTES = 2;
const GRACE_PERIOD_REAPER_INTERVAL_MS = 30_000;

function thresholdsForLevel(level) {
  switch (level) {
    case 'HIGH':
      return { maxFullscreenExits: 2, maxWarnings: 3 };
    case 'LOW':
      return { maxFullscreenExits: 5, maxWarnings: 8 };
    case 'MEDIUM':
    default:
      return { maxFullscreenExits: DEFAULT_MAX_FULLSCREEN_EXITS, maxWarnings: DEFAULT_MAX_WARNINGS };
  }
}

// Severities that bump the warning counter
const WARNING_TYPES = new Set([
  'FULLSCREEN_EXIT',
  'TAB_SWITCH',
  'SCREEN_SHARE_STOPPED',
  'WINDOW_BLUR',
  'BROWSER_MINIMIZE',
  'COPY_ATTEMPT',
  'PASTE_ATTEMPT',
  'BLOCKED_SHORTCUT',
  'DEVTOOLS_OPENED',
  'SCREENSHOT_ATTEMPT',
  'CLIPBOARD_ATTEMPT',
  'TRAINER_WARNING',
]);

const CRITICAL_TYPES = new Set([
  'MULTIPLE_LOGIN',
  'SCREEN_SHARE_DENIED',
  'NETWORK_TIMEOUT',
]);

// ── Internal helpers ────────────────────────────────────────────────────────
async function populateViolationCounts(session) {
  if (!session) return session;
  const [
    fullscreenExitsCount,
    tabSwitchesCount,
    screenshotsCount,
    devToolsCount,
    windowBlursCount
  ] = await Promise.all([
    Violation.count({ where: { sessionId: session.id, type: 'FULLSCREEN_EXIT' } }),
    Violation.count({ where: { sessionId: session.id, type: 'TAB_SWITCH' } }),
    Violation.count({ where: { sessionId: session.id, type: 'SCREENSHOT_ATTEMPT' } }),
    Violation.count({ where: { sessionId: session.id, type: 'DEVTOOLS_OPENED' } }),
    Violation.count({ where: { sessionId: session.id, type: 'WINDOW_BLUR' } })
  ]);
  session.setDataValue('fullscreenExitsCount', fullscreenExitsCount);
  session.setDataValue('tabSwitchesCount', tabSwitchesCount);
  session.setDataValue('screenshotsCount', screenshotsCount);
  session.setDataValue('devToolsCount', devToolsCount);
  session.setDataValue('windowBlursCount', windowBlursCount);
  return session;
}

function buildClientView(session) {
  if (!session) return null;
  const level = session.proctoringLevel || 'MEDIUM';
  const t = thresholdsForLevel(level);
  return {
    sessionId: session.id,
    sessionToken: session.sessionToken,
    quizId: session.quizId,
    attemptId: session.attemptId,
    status: session.status,
    warningsCount: session.warningsCount,
    fullscreenExits: session.fullscreenExits,
    isFullscreen: session.isFullscreen,
    isScreenSharing: session.isScreenSharing,
    isOnline: session.isOnline,
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    endedAt: session.endedAt,
    terminationReason: session.terminationReason,
    disconnectedAt: session.disconnectedAt,
    gracePeriodEndsAt: session.gracePeriodEndsAt,
    maxFullscreenExits: t.maxFullscreenExits,
    maxWarnings: t.maxWarnings,
    proctoringLevel: level,
    // Category violation counters
    fullscreenViolations: session.getDataValue('fullscreenExitsCount') ?? session.fullscreenExits ?? 0,
    tabSwitchViolations: session.getDataValue('tabSwitchesCount') ?? 0,
    screenshotViolations: session.getDataValue('screenshotsCount') ?? 0,
    devToolsViolations: session.getDataValue('devToolsCount') ?? 0,
    windowBlurViolations: session.getDataValue('windowBlursCount') ?? 0,
  };
}

async function getQuizOrThrow(quizId) {
  const quiz = await AIQuiz.findByPk(quizId);
  if (!quiz) {
    const err = new Error('Quiz not found');
    err.status = 404;
    throw err;
  }
  return quiz;
}

// ── Device fingerprint ──────────────────────────────────────────────────────
async function registerDevice({ userId, fingerprintHash, label, ipAddress, userAgent }) {
  if (!fingerprintHash) return null;
  const [device] = await DeviceFingerprint.findOrCreate({
    where: { userId, fingerprintHash },
    defaults: {
      userId, fingerprintHash, label, ipAddress, userAgent,
      lastSeenAt: new Date(),
    },
  });
  device.lastSeenAt = new Date();
  device.ipAddress = ipAddress || device.ipAddress;
  device.userAgent = userAgent || device.userAgent;
  await device.save();
  return device;
}

// ── Session management ─────────────────────────────────────────────────────
async function getActiveSessionForUser(userId) {
  const session = await ExamSession.findOne({
    where: { participantId: userId, status: { [Op.in]: ['PENDING', 'ACTIVE'] } },
    order: [['created_at', 'DESC']],
  });
  if (session) {
    await populateViolationCounts(session);
  }
  return session;
}

async function startSession({ userId, quizId, assessmentType, assessmentId, attemptId, fingerprintHash, ipAddress, userAgent, screenSharing }) {
  const isCoding = assessmentType === 'coding_assessment';

  // Single-device enforcement: if any other ACTIVE session for this user, terminate it.
  const existingActive = await ExamSession.findOne({
    where: { participantId: userId, status: { [Op.in]: ['PENDING', 'ACTIVE'] } },
  });

  if (isCoding) {
    if (existingActive && (existingActive.assessmentType !== 'coding_assessment' || existingActive.assessmentId !== Number(assessmentId))) {
      await terminateSession({
        session: existingActive,
        reason: 'Started exam on another device or assessment',
        type: 'MULTIPLE_LOGIN',
      });
    }

    const existingCoding = await ExamSession.findOne({
      where: { participantId: userId, assessmentType: 'coding_assessment', assessmentId, status: { [Op.in]: ['PENDING', 'ACTIVE'] } },
      order: [['created_at', 'DESC']],
    });

    if (existingCoding) {
      await populateViolationCounts(existingCoding);
      return { session: existingCoding, resumed: true };
    }

    const device = await registerDevice({
      userId, fingerprintHash, ipAddress, userAgent,
      label: 'Exam device',
    });

    const attempt = attemptId ? await CodingAttempt.findByPk(attemptId) : null;

    const startedAt = new Date();
    const session = await ExamSession.create({
      assessmentType: 'coding_assessment',
      assessmentId,
      attemptId: attempt ? attempt.id : null,
      participantId: userId,
      sessionToken: newSessionToken(),
      deviceFingerprintId: device ? device.id : null,
      status: 'PENDING',
      isScreenSharing: !!screenSharing,
      ipAddress,
      userAgent,
      startedAt,
      endsAt: null,
      encryptedPayload: encrypt({ seed: Date.now(), userId, assessmentId }),
      lastHeartbeatAt: startedAt,
      gracePeriodEndsAt: null,
      disconnectedAt: null,
      proctoringLevel: 'MEDIUM',
      gracePeriodMinutes: GRACE_PERIOD_DEFAULT_MINUTES,
    });

    await populateViolationCounts(session);

    return { session, resumed: false };
  }

  const quiz = await getQuizOrThrow(quizId);

  if (existingActive && existingActive.quizId !== Number(quizId)) {
    await terminateSession({
      session: existingActive,
      reason: 'Started exam on another device or quiz',
      type: 'MULTIPLE_LOGIN',
    });
  }

  // Re-entry to same quiz → reuse if active
  if (existingActive && existingActive.quizId === Number(quizId)) {
    await populateViolationCounts(existingActive);
    return { session: existingActive, quiz, resumed: true };
  }

  const device = await registerDevice({
    userId, fingerprintHash, ipAddress, userAgent,
    label: 'Exam device',
  });

  // Check if already attempted
  const completed = await QuizAttempt.findOne({
    where: { quizId, participantId: userId, status: { [Op.in]: ['SUBMITTED', 'EVALUATED'] } }
  });
  if (completed) {
    const err = new Error('You have already attempted this quiz.');
    err.status = 403;
    throw err;
  }

  // Reuse caller-supplied attempt if provided + valid; else create a new one.
  // This avoids creating a second QuizAttempt when the existing AI-quiz
  // start endpoint already created one.
  let attempt = null;
  if (attemptId) {
    attempt = await QuizAttempt.findOne({
      where: { id: attemptId, participantId: userId, quizId },
    });
  }
  if (!attempt) {
    attempt = await QuizAttempt.findOne({
      where: { quizId, participantId: userId, status: 'IN_PROGRESS' }
    });
  }
  if (!attempt) {
    attempt = await QuizAttempt.create({
      quizId,
      participantId: userId,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    });
  }

  const startedAt = new Date();
  const endsAt = quiz.timeLimit
    ? new Date(startedAt.getTime() + quiz.timeLimit * 60_000)
    : null;

  const gracePeriodMinutes = quiz.gracePeriodMinutes || GRACE_PERIOD_DEFAULT_MINUTES;

  const session = await ExamSession.create({
    quizId,
    attemptId: attempt.id,
    participantId: userId,
    sessionToken: newSessionToken(),
    deviceFingerprintId: device ? device.id : null,
    status: 'PENDING',
    isScreenSharing: !!screenSharing,
    ipAddress,
    userAgent,
    startedAt,
    endsAt,
    encryptedPayload: encrypt({ seed: Date.now(), userId, quizId }),
    lastHeartbeatAt: startedAt,
    gracePeriodEndsAt: null,
    disconnectedAt: null,
    proctoringLevel: quiz.proctoringLevel || 'MEDIUM',
    gracePeriodMinutes,
  });

  await populateViolationCounts(session);

  return { session, quiz, attempt, resumed: false };
}

async function activateSession(session) {
  if (session.status === 'ACTIVE') return session;
  if (session.status !== 'PENDING') {
    const err = new Error(`Cannot activate session in state ${session.status}`);
    err.status = 409;
    throw err;
  }
  session.status = 'ACTIVE';
  session.isFullscreen = true;
  session.lastHeartbeatAt = new Date();
  await session.save();
  await populateViolationCounts(session);
  return session;
}

async function heartbeat(session) {
  session.lastHeartbeatAt = new Date();
  await session.save();
  await populateViolationCounts(session);
  return session;
}

async function terminateSession({ session, reason, type = 'TERMINATED' }) {
  if (['SUBMITTED', 'TERMINATED', 'EXPIRED'].includes(session.status)) {
    return session;
  }
  session.status = 'TERMINATED';
  session.terminationReason = reason || 'Terminated';
  session.endedAt = new Date();
  await session.save();

  // Record activity for exam terminated
  await recordActivity({
    session,
    eventType: 'EXAM_TERMINATED',
    payload: { reason, endedAt: session.endedAt }
  });

  await Violation.create({
    sessionId: session.id,
    participantId: session.participantId,
    quizId: session.quizId,
    type,
    severity: 'CRITICAL',
    message: reason,
  });

  // Best-effort: auto-submit and grade the linked QuizAttempt.
  // No answers are available server-side at this point, so the attempt is
  // graded with an empty submission (zero score) for violation-based termination.
  if (session.attemptId) {
    try {
      const attempt = await QuizAttempt.findOne({
        where: { id: session.attemptId, status: 'IN_PROGRESS' },
      });
      if (attempt) {
        console.log(`[proctoringService] Auto-submitting attempt ${attempt.id} on session termination`);
        await aiQuizService.submitAndGradeAttempt(attempt, [], { autoSubmit: true });
        console.log(`[proctoringService] Auto-submitted attempt ${attempt.id}`);
      }
    } catch (e) {
      logger.warn('Failed to auto-submit attempt on terminate', { err: e.message });
      // Fallback: just flag as submitted so scoring can be retried later
      try {
        await QuizAttempt.update(
          { status: 'SUBMITTED', submittedAt: new Date() },
          { where: { id: session.attemptId, status: 'IN_PROGRESS' } },
        );
      } catch (e2) {
        logger.warn('Failed to flag attempt SUBMITTED on terminate', { err: e2.message });
      }
    }
  }

  await populateViolationCounts(session);

  return session;
}

async function submitSession(session) {
  if (['SUBMITTED', 'TERMINATED'].includes(session.status)) return session;
  session.status = 'SUBMITTED';
  session.endedAt = new Date();
  await session.save();

  // Record activity for exam submitted
  await recordActivity({
    session,
    eventType: 'EXAM_SUBMITTED',
    payload: { submittedAt: session.endedAt }
  });

  await populateViolationCounts(session);
  return session;
}

// ── Violation handling ──────────────────────────────────────────────────────
function severityFor(type) {
  if (CRITICAL_TYPES.has(type)) return 'CRITICAL';
  if (type === 'FULLSCREEN_EXIT') return 'HIGH';
  if (WARNING_TYPES.has(type)) return 'MEDIUM';
  return 'LOW';
}

/**
 * Record a violation, update counters, decide if termination is required.
 * Returns { violation, session, terminated:boolean }
 */
async function recordViolation({ session, type, message, metadata }) {
  if (!type) throw new Error('Violation type required');

  const severity = severityFor(type);
  const violation = await Violation.create({
    sessionId: session.id,
    participantId: session.participantId,
    quizId: session.quizId,
    type, severity, message: message || null,
    metadata: metadata || null,
  });

  let mutated = false;
  if (type === 'FULLSCREEN_EXIT') {
    session.fullscreenExits = (session.fullscreenExits || 0) + 1;
    session.isFullscreen = false;
    mutated = true;
  }
  if (type === 'SCREEN_SHARE_STOPPED' || type === 'SCREEN_SHARE_DENIED') {
    session.isScreenSharing = false;
    mutated = true;
  }
  if (WARNING_TYPES.has(type) || CRITICAL_TYPES.has(type)) {
    session.warningsCount = (session.warningsCount || 0) + 1;
    mutated = true;
  }
  if (mutated) await session.save();

  // Populate category counts to perform policy checks
  await populateViolationCounts(session);

  const fullscreenCount = session.getDataValue('fullscreenExitsCount') ?? 0;
  const tabSwitchesCount = session.getDataValue('tabSwitchesCount') ?? 0;
  const screenshotsCount = session.getDataValue('screenshotsCount') ?? 0;
  const devToolsCount = session.getDataValue('devToolsCount') ?? 0;
  const windowBlursCount = session.getDataValue('windowBlursCount') ?? 0;

  const level = session.proctoringLevel || 'MEDIUM';
  const t = thresholdsForLevel(level);

  // Termination policy
  let terminated = false;
  if (
    fullscreenCount >= t.maxFullscreenExits ||
    tabSwitchesCount >= 3 ||
    screenshotsCount >= 3 ||
    devToolsCount >= 3 ||
    windowBlursCount >= 3 ||
    session.warningsCount >= t.maxWarnings ||
    severity === 'CRITICAL'
  ) {
    let reason = `Auto-terminated after violation: ${type}`;
    if (fullscreenCount >= t.maxFullscreenExits) reason = 'Auto-terminated: Exceeded maximum fullscreen exits';
    else if (tabSwitchesCount >= 3) reason = 'Auto-terminated: Exceeded maximum tab switches';
    else if (screenshotsCount >= 3) reason = 'Auto-terminated: Exceeded maximum screenshot attempts';
    else if (devToolsCount >= 3) reason = 'Auto-terminated: Developer Tools detection limit reached';
    else if (windowBlursCount >= 3) reason = 'Auto-terminated: Exceeded maximum window focus losses';
    else if (session.warningsCount >= t.maxWarnings) reason = 'Auto-terminated: Exceeded maximum warnings limit';
    else if (severity === 'CRITICAL') reason = `Auto-terminated: Critical violation - ${type}`;

    await terminateSession({
      session,
      reason,
      type: 'TERMINATED',
    });
    terminated = true;
  }

  return { violation, session, terminated };
}

async function recordActivity({ session, eventType, payload }) {
  return ProctorActivity.create({
    sessionId: session.id,
    participantId: session.participantId,
    eventType,
    payload: payload || null,
  });
}

// ── Trainer queries ─────────────────────────────────────────────────────────
async function getQuizMonitor(quizId) {
  const sessions = await ExamSession.findAll({
    where: { quizId },
    order: [['created_at', 'DESC']],
  });

  await Promise.all(sessions.map(s => populateViolationCounts(s)));

  const sessionIds = sessions.map(s => s.id);
  const { Screenshot } = require('../models');
  let latestScreenshots = [];
  if (sessionIds.length > 0) {
    latestScreenshots = await Screenshot.findAll({
      where: { sessionId: { [Op.in]: sessionIds } },
      order: [['capturedAt', 'DESC']],
    });
  }
  const screenshotMap = new Map();
  for (const s of latestScreenshots) {
    if (!screenshotMap.has(s.sessionId)) {
      screenshotMap.set(s.sessionId, s.filePath);
    }
  }

  const userIds = [...new Set(sessions.map(s => s.participantId))];
  const users = userIds.length
    ? await User.findAll({ where: { id: userIds }, attributes: ['id', 'name', 'email'] })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  return sessions.map(s => ({
    ...buildClientView(s),
    participant: userMap.get(s.participantId) || { id: s.participantId, name: 'Unknown' },
    lastHeartbeatAt: s.lastHeartbeatAt,
    latestScreenshot: screenshotMap.get(s.id) || null,
  }));
}

async function getSessionViolations(sessionId, { limit = 100 } = {}) {
  return Violation.findAll({
    where: { sessionId },
    order: [['occurredAt', 'DESC']],
    limit,
  });
}

async function exportSessionLogs(sessionId) {
  const session = await ExamSession.findByPk(sessionId);
  if (!session) return null;
  await populateViolationCounts(session);
  const [violations, activities] = await Promise.all([
    Violation.findAll({ where: { sessionId }, order: [['occurredAt', 'ASC']] }),
    ProctorActivity.findAll({ where: { sessionId }, order: [['occurredAt', 'ASC']] }),
  ]);
  return {
    session: buildClientView(session),
    violations,
    activities,
    exportedAt: new Date(),
  };
}

// ── Grace period on disconnect ──────────────────────────────────────────────
async function enterGracePeriod(session) {
  const graceMinutes = session.gracePeriodMinutes || GRACE_PERIOD_DEFAULT_MINUTES;
  session.disconnectedAt = new Date();
  session.gracePeriodEndsAt = new Date(Date.now() + graceMinutes * 60_000);
  session.isOnline = false;
  await session.save();
  await populateViolationCounts(session);
  return session;
}

async function reconnectSession(session) {
  session.disconnectedAt = null;
  session.gracePeriodEndsAt = null;
  session.isOnline = true;
  session.lastHeartbeatAt = new Date();
  await session.save();
  await populateViolationCounts(session);
  return session;
}

async function expireGracePeriodSessions(io) {
  const now = new Date();
  const expired = await ExamSession.findAll({
    where: {
      status: 'ACTIVE',
      gracePeriodEndsAt: { [Op.ne]: null, [Op.lt]: now },
    },
    limit: 50,
  });
  for (const s of expired) {
    await terminateSession({
      session: s,
      reason: 'Auto-terminated: Disconnection grace period expired',
      type: 'NETWORK_TIMEOUT',
    });
    if (io) {
      io.to(`proctor_quiz_${s.quizId}`).emit('proctor:update', {
        type: 'terminated',
        session: buildClientView(s),
      });
      io.to(`user_${s.participantId}`).emit('proctor:terminated', {
        sessionId: s.id,
        reason: 'Auto-terminated: Disconnection grace period expired',
      });
    }
  }
  return expired.length;
}

// ── Reaper for stale sessions ───────────────────────────────────────────────
async function expireStaleSessions(io) {
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
  const stale = await ExamSession.findAll({
    where: {
      status: 'ACTIVE',
      lastHeartbeatAt: { [Op.lt]: cutoff },
      disconnectedAt: { [Op.eq]: null },
    },
    limit: 50,
  });
  for (const s of stale) {
    s.isOnline = false;
    await s.save();
    const violation = await Violation.create({
      sessionId: s.id,
      participantId: s.participantId,
      quizId: s.quizId,
      type: 'HEARTBEAT_LOST',
      severity: 'MEDIUM',
      message: 'No heartbeat received',
    });
    if (io) {
      io.to(`proctor_quiz_${s.quizId}`).emit('proctor:update', {
        type: 'violation',
        session: buildClientView(s),
        violation,
      });
    }
  }
  return stale.length;
}

// ── Reaper for endsAt timers ────────────────────────────────────────────────
async function autoSubmitExpiredSessions(io) {
  const now = new Date();
  const expired = await ExamSession.findAll({
    where: {
      status: 'ACTIVE',
      endsAt: { [Op.lt]: now }
    },
    limit: 50
  });

  for (const s of expired) {
    try {
      await submitSession(s);

      if (s.attemptId) {
        await QuizAttempt.update(
          { status: 'SUBMITTED', submittedAt: new Date() },
          { where: { id: s.attemptId, status: 'IN_PROGRESS' } }
        );
      }

      if (io) {
        io.to(`proctor_quiz_${s.quizId}`).emit('proctor:update', {
          type: 'submitted',
          session: buildClientView(s)
        });
        io.to(`user_${s.participantId}`).emit('proctor:terminated', {
          sessionId: s.id,
          reason: 'Time limit reached'
        });
      }
    } catch (err) {
      logger.error(`Failed to auto-submit expired session ${s.id}`, { err: err.message });
    }
  }

  return expired.length;
}

/**
 * getQuizReport — aggregated monitoring report for all participants in a quiz.
 * Used by the trainer's post-assessment report page.
 */
async function getQuizReport(quizId) {
  const sessions = await ExamSession.findAll({
    where: { quizId },
    order: [['created_at', 'DESC']],
    include: [
      { model: Violation, as: 'violations', required: false },
    ],
  });

  const userIds = [...new Set(sessions.map(s => s.participantId))];
  const users = userIds.length
    ? await User.findAll({ where: { id: userIds }, attributes: ['id', 'name', 'email'] })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  const quiz = await AIQuiz.findByPk(quizId, { attributes: ['id', 'title', 'timeLimit'] });

  const report = sessions.map(s => {
    const violations = s.violations || [];
    const violationCounts = {};
    const tabSwitchCount = violations.filter(v => v.type === 'TAB_SWITCH').length;
    const fullscreenExitCount = violations.filter(v => v.type === 'FULLSCREEN_EXIT').length;
    const screenShareInterruptions = violations.filter(v =>
      v.type === 'SCREEN_SHARE_STOPPED' || v.type === 'SCREEN_SHARE_DENIED'
    ).length;
    const webcamViolations = violations.filter(v =>
      v.type === 'FACE_ABSENT' || v.type === 'FACE_MULTIPLE' || v.type === 'LOOKING_AWAY'
    ).length;
    const devtoolsCount = violations.filter(v => v.type === 'DEVTOOLS_OPENED').length;
    const copyPasteCount = violations.filter(v =>
      v.type === 'COPY_ATTEMPT' || v.type === 'PASTE_ATTEMPT'
    ).length;

    violations.forEach(v => {
      violationCounts[v.type] = (violationCounts[v.type] || 0) + 1;
    });

    const duration = s.startedAt && s.endedAt
      ? Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 1000)
      : null;

    return {
      sessionId: s.id,
      participant: userMap.get(s.participantId) || { id: s.participantId, name: 'Unknown', email: '' },
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      duration,
      durationMinutes: duration ? Math.round(duration / 60) : null,
      warningsCount: s.warningsCount || 0,
      fullscreenExits: s.fullscreenExits || 0,
      isFullscreen: s.isFullscreen,
      isScreenSharing: s.isScreenSharing,
      isOnline: s.isOnline,
      violationCount: violations.length,
      tabSwitchCount,
      fullscreenExitCount,
      screenShareInterruptions,
      webcamViolations,
      devtoolsCount,
      copyPasteCount,
      violationCounts,
      proctoringLevel: s.proctoringLevel || 'MEDIUM',
      terminationReason: s.terminationReason,
    };
  });

  return {
    quiz: quiz ? { id: quiz.id, title: quiz.title, timeLimit: quiz.timeLimit } : { id: quizId },
    totalParticipants: sessions.length,
    sessions: report,
    generatedAt: new Date(),
  };
}

/**
 * getQuizReportCSV — returns CSV string of the monitoring report.
 */
async function getQuizReportCSV(quizId) {
  const report = await getQuizReport(quizId);
  const rows = [['Participant Name', 'Email', 'Status', 'Duration (min)', 'Total Violations',
    'Tab Switches', 'Fullscreen Exits', 'Screen Share Interruptions', 'Webcam Violations',
    'DevTools Attempts', 'Copy/Paste Attempts', 'Warnings', 'Proctoring Level', 'Termination Reason']];

  for (const s of report.sessions) {
    rows.push([
      s.participant.name || 'Unknown',
      s.participant.email || '',
      s.status,
      s.durationMinutes != null ? String(s.durationMinutes) : '',
      String(s.violationCount),
      String(s.tabSwitchCount),
      String(s.fullscreenExitCount),
      String(s.screenShareInterruptions),
      String(s.webcamViolations),
      String(s.devtoolsCount),
      String(s.copyPasteCount),
      String(s.warningsCount),
      s.proctoringLevel,
      s.terminationReason || '',
    ]);
  }

  return rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
}

module.exports = {
  // constants
  DEFAULT_MAX_FULLSCREEN_EXITS,
  DEFAULT_MAX_WARNINGS,
  thresholdsForLevel,
  // session lifecycle
  startSession,
  activateSession,
  heartbeat,
  submitSession,
  terminateSession,
  getActiveSessionForUser,
  // violations & activity
  recordViolation,
  recordActivity,
  // grace period
  enterGracePeriod,
  reconnectSession,
  expireGracePeriodSessions,
  // queries
  getQuizMonitor,
  getSessionViolations,
  exportSessionLogs,
  getQuizReport,
  getQuizReportCSV,
  // misc
  registerDevice,
  buildClientView,
  expireStaleSessions,
  autoSubmitExpiredSessions,
};
