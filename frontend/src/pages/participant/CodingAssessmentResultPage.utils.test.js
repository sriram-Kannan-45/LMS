import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAssessment,
  normalizeAttempt,
  getProblemSubmissionsMap,
  getTestCaseSummary,
  isPassed,
  calculateMaxScore,
  formatDateTime,
} from './CodingAssessmentResultPage.utils.js';

describe('CodingAssessmentResultPage helpers', () => {
  describe('normalizeAssessment', () => {
    it('extracts assessment from nested wrapper', () => {
      assert.deepEqual(normalizeAssessment({ assessment: { id: 1 } }), { id: 1 });
    });

    it('falls back to data wrapper', () => {
      assert.deepEqual(normalizeAssessment({ data: { id: 2 } }), { id: 2 });
    });

    it('returns raw object when no wrapper exists', () => {
      assert.deepEqual(normalizeAssessment({ id: 3 }), { id: 3 });
    });

    it('returns null for null input', () => {
      assert.strictEqual(normalizeAssessment(null), null);
    });
  });

  describe('normalizeAttempt', () => {
    it('extracts attempt from nested wrapper', () => {
      assert.deepEqual(normalizeAttempt({ attempt: { id: 10 } }), { id: 10 });
    });

    it('falls back to data wrapper', () => {
      assert.deepEqual(normalizeAttempt({ data: { id: 20 } }), { id: 20 });
    });

    it('returns raw object when no wrapper exists', () => {
      assert.deepEqual(normalizeAttempt({ id: 30 }), { id: 30 });
    });

    it('returns null for null input', () => {
      assert.strictEqual(normalizeAttempt(null), null);
    });
  });

  describe('getProblemSubmissionsMap', () => {
    it('maps submissions by questionId', () => {
      const submissions = [
        { questionId: 1, isFinal: true, score: 80 },
        { questionId: 2, isFinal: true, score: 60 },
      ];
      const map = getProblemSubmissionsMap(submissions);
      assert.strictEqual(map[1].score, 80);
      assert.strictEqual(map[2].score, 60);
    });

    it('prefers final submissions when duplicates exist', () => {
      const submissions = [
        { questionId: 1, isFinal: false, score: 30 },
        { questionId: 1, isFinal: true, score: 90 },
      ];
      const map = getProblemSubmissionsMap(submissions);
      assert.strictEqual(map[1].score, 90);
    });

    it('keeps first submission when neither is final', () => {
      const submissions = [
        { questionId: 1, isFinal: false, score: 40 },
        { questionId: 1, isFinal: false, score: 50 },
      ];
      const map = getProblemSubmissionsMap(submissions);
      assert.strictEqual(map[1].score, 40);
    });

    it('ignores invalid submissions', () => {
      const map = getProblemSubmissionsMap([null, { score: 10 }, { questionId: null, score: 20 }]);
      assert.deepEqual(Object.keys(map), []);
    });
  });

  describe('getTestCaseSummary', () => {
    it('prefers testsPassed/testsTotal fields', () => {
      assert.deepEqual(
        getTestCaseSummary({ testsPassed: 3, testsTotal: 5, passedCount: 2, totalCount: 4 }),
        { passed: 3, total: 5 }
      );
    });

    it('falls back to passedCount/totalCount', () => {
      assert.deepEqual(getTestCaseSummary({ passedCount: 2, totalCount: 4 }), { passed: 2, total: 4 });
    });

    it('returns zero for missing submission', () => {
      assert.deepEqual(getTestCaseSummary(null), { passed: 0, total: 0 });
    });
  });

  describe('isPassed', () => {
    it('returns true when total score meets passing score', () => {
      assert.strictEqual(isPassed(75, 50), true);
    });

    it('returns false when total score is below passing score', () => {
      assert.strictEqual(isPassed(49, 50), false);
    });

    it('returns false when inputs are not numbers', () => {
      assert.strictEqual(isPassed(null, 50), false);
      assert.strictEqual(isPassed(80, undefined), false);
    });
  });

  describe('calculateMaxScore', () => {
    it('sums marks across questions', () => {
      assert.strictEqual(calculateMaxScore([{ marks: 10 }, { marks: 20 }, { marks: 5 }]), 35);
    });

    it('ignores missing or invalid marks', () => {
      assert.strictEqual(calculateMaxScore([{ marks: 10 }, {}, { marks: 'abc' }, null]), 10);
    });

    it('returns zero for empty questions', () => {
      assert.strictEqual(calculateMaxScore([]), 0);
    });
  });

  describe('formatDateTime', () => {
    it('formats an ISO date string', () => {
      const formatted = formatDateTime('2025-12-25T14:30:00.000Z');
      assert.match(formatted, /25/);
      assert.match(formatted, /2025/);
    });

    it('returns em dash for null/undefined/empty', () => {
      assert.strictEqual(formatDateTime(null), '—');
      assert.strictEqual(formatDateTime(undefined), '—');
      assert.strictEqual(formatDateTime(''), '—');
    });
  });
});
