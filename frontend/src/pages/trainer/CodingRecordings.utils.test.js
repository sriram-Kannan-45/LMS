import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDate,
  formatDuration,
  getAssessmentTitle,
  getScore,
  getStatusBadgeClasses,
  buildApiUrl
} from './CodingRecordings.utils.js'

describe('CodingRecordings helpers', () => {
  describe('formatDate', () => {
    it('returns an en-IN formatted string for a valid ISO date', () => {
      const result = formatDate('2025-12-25T14:30:00.000Z')
      assert.match(result, /25 Dec 2025/)
      assert.match(result, /\d{2}:\d{2}/)
    })

    it('returns em dash for null, undefined, or empty input', () => {
      assert.strictEqual(formatDate(null), '—')
      assert.strictEqual(formatDate(undefined), '—')
      assert.strictEqual(formatDate(''), '—')
    })
  })

  describe('formatDuration', () => {
    it('formats seconds into minutes and seconds', () => {
      assert.strictEqual(formatDuration(125), '2m 5s')
    })

    it('returns em dash for missing duration', () => {
      assert.strictEqual(formatDuration(null), '—')
      assert.strictEqual(formatDuration(undefined), '—')
    })

    it('handles zero seconds', () => {
      assert.strictEqual(formatDuration(0), '0m 0s')
    })
  })

  describe('getAssessmentTitle', () => {
    it('prefers codingAssessment title', () => {
      const rec = {
        codingAssessment: { title: 'Coding A' },
        assessment: { title: 'Assessment A' },
        quiz: { title: 'Quiz A' }
      }
      assert.strictEqual(getAssessmentTitle(rec), 'Coding A')
    })

    it('falls back to assessment title', () => {
      const rec = { assessment: { title: 'Assessment A' }, quiz: { title: 'Quiz A' } }
      assert.strictEqual(getAssessmentTitle(rec), 'Assessment A')
    })

    it('falls back to quiz title', () => {
      const rec = { quiz: { title: 'Quiz A' } }
      assert.strictEqual(getAssessmentTitle(rec), 'Quiz A')
    })

    it('returns an id-based fallback when no title exists', () => {
      const rec = { assessmentId: 42, id: 7 }
      assert.strictEqual(getAssessmentTitle(rec), 'Assessment #42')
    })

    it('uses id when assessmentId is missing', () => {
      const rec = { id: 99 }
      assert.strictEqual(getAssessmentTitle(rec), 'Assessment #99')
    })
  })

  describe('getScore', () => {
    it('returns the score as a string', () => {
      assert.strictEqual(getScore({ codingAttempt: { totalScore: 85 } }), '85')
    })

    it('returns em dash for missing score', () => {
      assert.strictEqual(getScore({ codingAttempt: {} }), '—')
      assert.strictEqual(getScore({}), '—')
      assert.strictEqual(getScore({ codingAttempt: { totalScore: null } }), '—')
    })

    it('returns zero as a string when score is 0', () => {
      assert.strictEqual(getScore({ codingAttempt: { totalScore: 0 } }), '0')
    })
  })

  describe('getStatusBadgeClasses', () => {
    it('returns green classes for ready', () => {
      assert.match(getStatusBadgeClasses('ready'), /bg-green-50/)
      assert.match(getStatusBadgeClasses('ready'), /text-green-700/)
    })

    it('returns yellow classes for processing', () => {
      assert.match(getStatusBadgeClasses('processing'), /bg-yellow-50/)
      assert.match(getStatusBadgeClasses('processing'), /text-yellow-700/)
    })

    it('returns red classes for any other status', () => {
      assert.match(getStatusBadgeClasses('failed'), /bg-red-50/)
      assert.match(getStatusBadgeClasses(''), /bg-red-50/)
    })
  })

  describe('buildApiUrl', () => {
    it('appends a type query parameter', () => {
      assert.strictEqual(buildApiUrl('/api/recordings', 'coding'), '/api/recordings?type=coding')
    })

    it('returns the base url for "all" type', () => {
      assert.strictEqual(buildApiUrl('/api/recordings', 'all'), '/api/recordings')
    })

    it('returns the base url when type is missing', () => {
      assert.strictEqual(buildApiUrl('/api/recordings', ''), '/api/recordings')
      assert.strictEqual(buildApiUrl('/api/recordings', null), '/api/recordings')
    })

    it('encodes the type value', () => {
      assert.strictEqual(buildApiUrl('/api/recordings', 'coding assessment'), '/api/recordings?type=coding%20assessment')
    })
  })
})
