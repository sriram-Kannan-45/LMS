export function normalizeAssessment(data) {
  if (!data) return null;
  return data.assessment || data.data || data || null;
}

export function normalizeAttempt(data) {
  if (!data) return null;
  return data.attempt || data.data || data || null;
}

export function getProblemSubmissionsMap(submissions) {
  const map = {};
  for (const submission of submissions || []) {
    if (!submission || !submission.questionId) continue;
    const existing = map[submission.questionId];
    if (!existing) {
      map[submission.questionId] = submission;
      continue;
    }
    if (submission.isFinal && !existing.isFinal) {
      map[submission.questionId] = submission;
    }
  }
  return map;
}

export function getTestCaseSummary(submission) {
  const passed = submission?.testsPassed ?? submission?.passedCount ?? 0;
  const total = submission?.testsTotal ?? submission?.totalCount ?? 0;
  return { passed, total };
}

export function isPassed(totalScore, passingScore) {
  if (typeof totalScore !== 'number' || typeof passingScore !== 'number') return false;
  return totalScore >= passingScore;
}

export function calculateMaxScore(questions) {
  return (questions || []).reduce((sum, question) => sum + (Number(question?.marks) || 0), 0);
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}
