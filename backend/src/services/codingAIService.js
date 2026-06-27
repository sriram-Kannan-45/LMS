const axios = require('axios');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_TIMEOUT = 90000;

/**
 * Ask the Gemini-backed Python service to author a full coding problem.
 * Returns the parsed question object (schema defined in main.py).
 */
async function generateQuestion({ topic, difficulty, language }) {
  const res = await axios.post(
    `${AI_SERVICE_URL}/generate-coding-question`,
    { topic, difficulty, language: language || 'any' },
    { timeout: AI_TIMEOUT, headers: { 'Content-Type': 'application/json' } }
  );
  if (!res.data || !res.data.question) {
    const err = new Error('AI returned malformed response. Try again.');
    err.statusCode = 422;
    throw err;
  }
  return res.data.question;
}

/**
 * Ask the Gemini-backed Python service to review a submitted solution.
 * Returns the parsed review object.
 */
async function reviewCode({ title, language, code, passed, total }) {
  const res = await axios.post(
    `${AI_SERVICE_URL}/review-code`,
    { title, language, code, passed, total },
    { timeout: AI_TIMEOUT, headers: { 'Content-Type': 'application/json' } }
  );
  if (!res.data || !res.data.review) {
    const err = new Error('AI returned malformed response. Try again.');
    err.statusCode = 422;
    throw err;
  }
  return res.data.review;
}

module.exports = { generateQuestion, reviewCode };
