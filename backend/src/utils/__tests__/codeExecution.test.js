const { calculateScore, normalizeOutput } = require('../../services/codeExecutionService');

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
