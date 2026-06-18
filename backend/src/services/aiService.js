const axios = require('axios');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_TIMEOUT = 90000; // 90 seconds for quiz generation
const MAX_RETRIES = 2;

/**
 * Check if the AI service is reachable.
 * @returns {Promise<{available: boolean, details: object}>}
 */
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
    // Light cleaning ONLY — the Python AI service does its own normalization
    // (clean_text_for_quiz). Doing aggressive cleaning here AND there can
    // collapse sentence boundaries and corrupt context, which is a major
    // reason quizzes ended up not knowledge-based.
    let cleanContent = (content || '').toString();
    // Strip the most obvious noise that survives extraction:
    cleanContent = cleanContent.replace(/\u0000/g, '');           // null bytes
    cleanContent = cleanContent.replace(/[\r\f\v]+/g, ' ');       // form feeds, vertical tabs
    cleanContent = cleanContent.replace(/[ \t]+/g, ' ');          // collapse runs of spaces
    cleanContent = cleanContent.trim();

    // Cap to 15000 chars — the Python service uses RecursiveCharacterTextSplitter
    // and will spread chunks across this slice. The aiQuizRoutes layer also
    // already strips image/figure tokens before calling us.
    if (cleanContent.length > 15000) {
      cleanContent = cleanContent.substring(0, 15000);
    }

    if (!cleanContent || cleanContent.length < 50) {
      throw new Error('Document text is too short to generate a quiz. Minimum 50 characters required.');
    }

    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[aiService] Attempt ${attempt}/${MAX_RETRIES} — sending ${cleanContent.length} chars to AI service`);
        
        const response = await axios.post(`${AI_SERVICE_URL}/generate-quiz`, 
          { text: cleanContent, num_questions: numQuestions, difficulty: difficulty },
          { timeout: AI_TIMEOUT, headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.data || !response.data.questions) {
          throw new Error('Invalid response from AI service — no questions returned');
        }

        // Transform response format to match backend expectations
        const questions = response.data.questions.map((q, i) => {
          const questionType = (q.questionType || 'MCQ').toUpperCase();

          if (questionType === 'TRUE_FALSE') {
            const correctIdx = String(q.correctAnswer || 'True').trim().toLowerCase() === 'true' ? '0' : '1';
            return {
              questionText: q.question || `Question ${i + 1}`,
              questionType: 'TRUE_FALSE',
              options: ['True', 'False'],
              correctAnswer: correctIdx,
              explanation: q.explanation || '',
              difficulty,
              order: i
            };
          }

          if (questionType === 'FILL_BLANK') {
            return {
              questionText: q.question || `Question ${i + 1}`,
              questionType: 'FILL_BLANK',
              options: [],
              correctAnswer: q.correctAnswer || '',
              acceptableAnswers: Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers : [],
              explanation: q.explanation || '',
              difficulty,
              order: i
            };
          }

          if (questionType === 'MATCHING') {
            return {
              questionText: q.question || `Question ${i + 1}`,
              questionType: 'MATCHING',
              pairs: Array.isArray(q.pairs) ? q.pairs : [],
              explanation: q.explanation || '',
              difficulty,
              order: i
            };
          }

          // Default: MCQ — existing logic, unchanged
          const options = q.options || ['Option A', 'Option B', 'Option C', 'Option D'];
          let correctAnswer = q.correct_answer || q.correctAnswer || 'A';
          if (['A', 'B', 'C', 'D'].includes(correctAnswer)) {
            correctAnswer = (correctAnswer.charCodeAt(0) - 65).toString();
          } else if (!['0', '1', '2', '3'].includes(correctAnswer)) {
            const cleanCorrect = String(correctAnswer).trim().toLowerCase();
            const idx = options.findIndex(opt => String(opt).trim().toLowerCase() === cleanCorrect);
            correctAnswer = idx !== -1 ? idx.toString() : '0';
          }
          return {
            questionText: q.question || q.questionText || `Question ${i + 1}`,
            questionType: 'MCQ',
            options,
            correctAnswer,
            explanation: q.explanation || '',
            difficulty,
            order: i
          };
        });

        console.log(`[aiService] ✅ Generated ${questions.length} questions successfully`);

        return { 
          questions,
          title: response.data.quiz_title || 'AI Generated Quiz'
        };
        
      } catch (error) {
        lastError = error;
        console.error(`[aiService] Attempt ${attempt} failed:`, error.message);

        // Don't retry on validation errors
        if (error.response && [400, 415, 422].includes(error.response.status)) {
          break;
        }

        // Wait before retrying
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
    }

    // Build a user-friendly error from the last failure
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
        userAnswer: userAnswer
      }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });

      return {
        score: response.data.score || 0,
        feedback: response.data.feedback || 'Answer evaluated',
        isCorrect: response.data.isCorrect || false
      };
    } catch (error) {
      console.error('[aiService] AI Evaluation Error:', error.message);
      // Fallback: simple keyword matching
      const userWords = new Set(userAnswer.toLowerCase().split(/\s+/));
      const modelWords = new Set(modelAnswer.toLowerCase().split(/\s+/));
      let matchCount = 0;
      userWords.forEach(w => { if (modelWords.has(w)) matchCount++; });
      const score = Math.min(100, (matchCount / Math.max(modelWords.size, 1)) * 100);
      
      return {
        score: score,
        feedback: score > 50 ? 'Good answer with relevant keywords' : 'Answer needs improvement — missing key concepts',
        isCorrect: score >= 60
      };
    }
  },

  async generateQuizFromPrompt(prompt, questionCount = 10, difficulty = 'Medium') {
    let cleanPrompt = (prompt || '').toString().trim();
    if (!cleanPrompt) {
      throw new Error('Prompt/Topic cannot be empty.');
    }
    if (questionCount < 1 || questionCount > 50) {
      throw new Error('Number of questions must be between 1 and 50.');
    }

    try {
      console.log(`[aiService] Querying AI service /generate-quiz-from-prompt for topic: "${cleanPrompt}"`);
      const response = await axios.post(`${AI_SERVICE_URL}/generate-quiz-from-prompt`, {
        prompt: cleanPrompt,
        questionCount: parseInt(questionCount, 10),
        difficulty: difficulty
      }, {
        timeout: AI_TIMEOUT,
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.data || !response.data.success || !response.data.questions) {
        throw new Error('Invalid response from AI service');
      }

      return response.data.questions;
    } catch (error) {
      console.error('[aiService] generateQuizFromPrompt failed:', error.message);
      if (error.response) {
        const detail = error.response.data?.detail || '';
        throw new Error(`AI service error: ${detail || error.response.statusText}`);
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('AI service is not running. Please start the Python AI service first.');
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('AI service timed out. The prompt may be too complex or the model is overloaded.');
      }
      throw new Error('Failed to generate quiz from prompt: ' + error.message);
    }
  }
};

module.exports = aiService;
