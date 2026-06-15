const axios = require('axios');
require('dotenv').config();
const logger = require('../utils/logger');
const cacheService = require('./cacheService');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_TIMEOUT = 90000;
const MAX_RETRIES = 2;

/**
 * Generate a cache key for quiz generation requests
 * Based on content hash + parameters to avoid storing duplicate results
 */
function getQuizCacheKey(content, numQuestions, difficulty) {
  const hash = require('crypto').createHash('md5').update(content.slice(0, 1000)).digest('hex');
  return `ai:quiz:${hash}:${numQuestions}:${difficulty}`;
}

async function checkHealth() {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
    return { available: true, details: response.data };
  } catch {
    return { available: false, details: null };
  }
}

const aiService = {
  checkHealth,

  async generateQuizFromText(content, numQuestions = 10, difficulty = 'MIXED') {
    let cleanContent = (content || '').toString();
    cleanContent = cleanContent.replace(/\u0000/g, '');
    cleanContent = cleanContent.replace(/[\r\f\v]+/g, ' ');
    cleanContent = cleanContent.replace(/[ \t]+/g, ' ');
    cleanContent = cleanContent.trim();

    if (cleanContent.length > 15000) {
      cleanContent = cleanContent.substring(0, 15000);
    }

    if (!cleanContent || cleanContent.length < 50) {
      throw new Error('Document text is too short to generate a quiz. Minimum 50 characters required.');
    }

    // Check cache for identical requests (same content + params)
    const cacheKey = getQuizCacheKey(cleanContent, numQuestions, difficulty);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.info('[aiService] Returning cached quiz result', {
        questionsCount: cached.questions?.length,
      });
      return cached;
    }

    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        logger.debug(`[aiService] Attempt ${attempt}/${MAX_RETRIES} — sending ${cleanContent.length} chars`);

        const response = await axios.post(`${AI_SERVICE_URL}/generate-quiz`,
          { text: cleanContent, num_questions: numQuestions, difficulty: difficulty },
          { timeout: AI_TIMEOUT, headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.data || !response.data.questions) {
          throw new Error('Invalid response from AI service — no questions returned');
        }

        const questions = response.data.questions.map((q, i) => {
          let correctAnswer = q.correct_answer || q.correctAnswer || 'A';
          if (['A', 'B', 'C', 'D'].includes(correctAnswer)) {
            correctAnswer = (correctAnswer.charCodeAt(0) - 65).toString();
          }

          return {
            questionText: q.question || q.questionText || `Question ${i + 1}`,
            questionType: 'MCQ',
            options: q.options || ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: correctAnswer,
            explanation: q.explanation || '',
            difficulty: difficulty,
            order: i,
          };
        });

        const result = {
          questions,
          title: response.data.quiz_title || 'AI Generated Quiz',
        };

        // Cache the result for 1 hour (3600s)
        await cacheService.set(cacheKey, result, 3600);
        logger.info(`[aiService] Generated ${questions.length} questions (cached for 1h)`);

        return result;
      } catch (error) {
        lastError = error;
        logger.warn(`[aiService] Attempt ${attempt} failed`, { error: error.message });

        if (error.response && [400, 415, 422].includes(error.response.status)) {
          break;
        }

        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
    }

    if (lastError.response) {
      const detail = lastError.response.data?.detail || '';
      if (detail.includes('image') || detail.includes('not support')) {
        throw new Error('Images are not supported. Please upload PDF, DOCX, or TXT files only.');
      }
      if (lastError.response.status === 415) {
        throw new Error(`File type not supported: ${detail}`);
      }
      if (lastError.response.status === 422) {
        throw new Error(`Validation error: ${detail}`);
      }
      throw new Error(`AI service error (${lastError.response.status}): ${detail || lastError.response.statusText}`);
    } else if (lastError.code === 'ECONNREFUSED') {
      throw new Error('AI service is not running. Please start the Python AI service first.');
    } else if (lastError.code === 'ECONNABORTED' || lastError.message?.includes('timeout')) {
      throw new Error('AI service timed out. The document may be too complex — try a shorter document or fewer questions.');
    }
    throw new Error('Failed to generate quiz: ' + lastError.message);
  },

  async evaluateShortAnswer(question, modelAnswer, userAnswer) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/evaluate`, {
        questionText: question,
        modelAnswer: modelAnswer,
        userAnswer: userAnswer,
      }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      });

      return {
        score: response.data.score || 0,
        feedback: response.data.feedback || 'Answer evaluated',
        isCorrect: response.data.isCorrect || false,
      };
    } catch (error) {
      logger.warn('[aiService] AI Evaluation Error, using fallback', { error: error.message });
      const userWords = new Set(userAnswer.toLowerCase().split(/\s+/));
      const modelWords = new Set(modelAnswer.toLowerCase().split(/\s+/));
      let matchCount = 0;
      userWords.forEach(w => { if (modelWords.has(w)) matchCount++; });
      const score = Math.min(100, (matchCount / Math.max(modelWords.size, 1)) * 100);

      return {
        score,
        feedback: score > 50 ? 'Good answer with relevant keywords' : 'Answer needs improvement — missing key concepts',
        isCorrect: score >= 60,
      };
    }
  },
};

module.exports = aiService;
