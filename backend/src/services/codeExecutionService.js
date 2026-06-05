const axios = require('axios');
require('dotenv').config();

const JUDGE0_URL = process.env.JUDGE0_URL || 'http://localhost:2358';

const JUDGE0_LANGUAGE_IDS = {
  python: 71, javascript: 63, java: 62, c: 50, cpp: 54, csharp: 51, go: 60,
};

// Judge0 status IDs → our status codes
const STATUS_MAP = { 3: 'PASSED', 4: 'FAILED', 5: 'TLE', 6: 'CE', 11: 'RE', 12: 'MLE' };

const b64 = (s) => Buffer.from(s || '', 'utf8').toString('base64');
const unb64 = (s) => (s ? Buffer.from(s, 'base64').toString('utf8') : '');

/**
 * Run one source file against a single stdin via Judge0 (isolated container).
 * Returns { status, runtime_ms, memory_kb, actual_output, error_message }.
 */
async function executeCode({ language, sourceCode, stdin, timeLimitMs = 5000, memoryLimitKb = 256000 }) {
  const langId = JUDGE0_LANGUAGE_IDS[language];
  if (!langId) throw new Error(`Unsupported language: ${language}`);

  const res = await axios.post(
    `${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`,
    {
      language_id: langId,
      source_code: b64(sourceCode),
      stdin: b64(stdin),
      cpu_time_limit: (timeLimitMs / 1000).toFixed(1),
      memory_limit: memoryLimitKb,
      enable_network: false,
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
  );

  const r = res.data;
  const stdout = unb64(r.stdout);
  const stderr = unb64(r.stderr);
  const compileOutput = unb64(r.compile_output);

  return {
    status: STATUS_MAP[r.status?.id] || 'FAILED',
    runtime_ms: Math.round((parseFloat(r.time) || 0) * 1000),
    memory_kb: r.memory || 0,
    actual_output: stdout.trim(),
    error_message: stderr || compileOutput || '',
  };
}

/**
 * Run code against an ordered list of test cases.
 * Each test case: { id, input, expectedOutput, isHidden }.
 * Returns { results: [...], passedCount, totalCount }.
 */
async function runTestCases({ language, sourceCode, testCases, timeLimitMs, memoryLimitKb }) {
  const results = [];
  let passedCount = 0;
  for (const tc of testCases) {
    const exec = await executeCode({ language, sourceCode, stdin: tc.input, timeLimitMs, memoryLimitKb });
    const expected = (tc.expectedOutput || '').trim();
    const passed = exec.status === 'PASSED' && exec.actual_output === expected;
    if (passed) passedCount++;
    results.push({
      testCaseId: tc.id,
      isHidden: !!tc.isHidden,
      status: passed ? 'PASSED' : (exec.status === 'PASSED' ? 'FAILED' : exec.status),
      runtimeMs: exec.runtime_ms,
      memoryKb: exec.memory_kb,
      actualOutput: exec.actual_output,
      errorMessage: exec.error_message,
    });
  }
  return { results, passedCount, totalCount: testCases.length };
}

module.exports = { executeCode, runTestCases, JUDGE0_LANGUAGE_IDS };
