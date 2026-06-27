const axios = require('axios');

const PISTON_URL = process.env.PISTON_URL || 'https://emkc.org/api/v2/piston/execute';

const LANGUAGE_MAP = {
  javascript: { language: 'javascript', version: '18.15.0' },
  python: { language: 'python', version: '3.10.0' },
  java: { language: 'java', version: '15.0.2' },
  'c++': { language: 'c++', version: '10.2.0' },
};

function normalizeOutput(output) {
  return output.replace(/\r\n/g, '\n').trim();
}

function mapStatus(result) {
  const compile = result.compile || {};
  const run = result.run || {};

  if (compile.code !== undefined && compile.code !== 0) {
    return 'CE';
  }
  if (run.signal === 'SIGKILL') {
    return 'TLE';
  }
  if (run.code !== undefined && run.code !== 0) {
    return 'RE';
  }
  return 'OK';
}

async function executeCode({ code, language, stdin, timeout = 5000 }) {
  const mapped = LANGUAGE_MAP[language];
  if (!mapped) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const response = await axios.post(
    PISTON_URL,
    {
      language: mapped.language,
      version: mapped.version,
      files: [{ content: code }],
      stdin: stdin || '',
    },
    { timeout: timeout + 2000 }
  );

  const result = response.data;
  const run = result.run || {};
  const compile = result.compile || {};
  const status = mapStatus(result);

  return {
    status,
    output: normalizeOutput(run.output || ''),
    stdout: normalizeOutput(run.stdout || ''),
    stderr: normalizeOutput(run.stderr || compile.stderr || ''),
  };
}

async function runTests({ code, language, testCases, timeout = 5000 }) {
  const results = [];
  let passed = 0;

  for (const testCase of testCases) {
    const execution = await executeCode({
      code,
      language,
      stdin: testCase.stdin || '',
      timeout,
    });

    const actual = execution.stdout;
    const expected = normalizeOutput(testCase.expectedOutput || '');
    const testPassed = execution.status === 'OK' && actual === expected;

    if (testPassed) {
      passed += 1;
    }

    results.push({
      stdin: testCase.stdin || '',
      expectedOutput: expected,
      actualOutput: actual,
      status: testPassed ? 'OK' : execution.status === 'OK' ? 'FAILED' : execution.status,
    });
  }

  return {
    results,
    passed,
    total: testCases.length,
  };
}

function calculateScore({ passed, total, marks }) {
  if (total === 0) {
    return 0;
  }
  return Math.round((passed / total) * marks);
}

module.exports = {
  executeCode,
  runTests,
  calculateScore,
  normalizeOutput,
  LANGUAGE_MAP,
};
