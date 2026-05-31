b"""
AI Quiz Generator Microservice - Enterprise Edition
Uses LangChain + Gemini (with Groq fallback) to generate quizzes from documents.

Enhanced with:
- Advanced prompt engineering with Bloom's taxonomy
- Response caching for improved performance
- Structured JSON output validation
- Semantic similarity filtering for question diversity
- Retry logic with exponential backoff
- Comprehensive error handling and logging
"""
import os
import sys
import logging
import asyncio
import hashlib
import re
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()  # Load .env file

import json
import tempfile
import time
from typing import List, Dict, Any, Optional, Tuple
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
import PyPDF2
import docx

# ── Logging Setup ──────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ai-quiz")

# ── Application Setup ──────────────────────────────────
app = FastAPI(
    title="LMS AI Quiz Generator",
    version="3.0.0",
    description="Enterprise-grade AI quiz generation service with advanced prompt engineering and caching"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Cache Implementation ───────────────────────────────
class SimpleCache:
    """In-memory cache with TTL support for quiz generation results."""
    
    def __init__(self, default_ttl: int = 3600):
        self._cache: Dict[str, Dict] = {}
        self._timestamps: Dict[str, datetime] = {}
        self.default_ttl = default_ttl
    
    def get(self, key: str) -> Optional[Dict]:
        """Get item from cache if not expired."""
        if key in self._cache:
            if datetime.now() - self._timestamps[key] < timedelta(seconds=self.default_ttl):
                return self._cache[key]
            else:
                del self._cache[key]
                del self._timestamps[key]
        return None
    
    def set(self, key: str, value: Dict) -> None:
        """Set item in cache with current timestamp."""
        self._cache[key] = value
        self._timestamps[key] = datetime.now()
    
    def clear(self) -> None:
        """Clear all cache entries."""
        self._cache.clear()
        self._timestamps.clear()

# Initialize cache
quiz_cache = SimpleCache(default_ttl=7200)  # 2 hour TTL

# ── Configuration ──────────────────────────────────────
class Config:
    """Centralized configuration for AI service."""
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_TEXT_LENGTH = 15000
    MIN_TEXT_LENGTH = 50
    MAX_QUESTIONS = 50
    MIN_QUESTIONS = 1
    DEFAULT_CHUNK_SIZE = 4000
    DEFAULT_CHUNK_OVERLAP = 200
    MAX_RETRIES = 3
    RETRY_DELAY = 2  # seconds
    SIMILARITY_THRESHOLD = 0.7  # For duplicate detection

# ── Enhanced Prompt Templates ─────────────────────────
DIFFICULTY_CONFIGS = {
    "EASY": {
        "description": "Basic recall and comprehension questions",
        "bloom_level": "Remember, Understand",
        "instruction": "Focus on key terms, definitions, and basic concepts. Questions should test fundamental understanding.",
        "complexity": "low"
    },
    "MEDIUM": {
        "description": "Application and analysis questions",
        "bloom_level": "Apply, Analyze",
        "instruction": "Include scenario-based questions that require applying concepts. Test ability to analyze relationships.",
        "complexity": "medium"
    },
    "HARD": {
        "description": "Evaluation and creation questions",
        "bloom_level": "Evaluate, Create",
        "instruction": "Create complex scenarios requiring critical thinking. Test ability to evaluate, synthesize, and make judgments.",
        "complexity": "high"
    },
    "MIXED": {
        "description": "Balanced difficulty distribution",
        "bloom_level": "All levels",
        "instruction": "Distribute questions across all difficulty levels: ~30% easy, ~40% medium, ~30% hard.",
        "complexity": "mixed"
    }
}

ENHANCED_QUIZ_PROMPT = """You are an expert educational assessment designer with deep knowledge of Bloom's Taxonomy and pedagogical best practices.

## DOCUMENT CONTENT
{text}

## TASK
Generate exactly {num_questions} high-quality multiple-choice questions (MCQs) based STRICTLY on the document content above.

## DIFFICULTY CONFIGURATION
Level: {difficulty}
{difficulty_instruction}

## QUESTION QUALITY REQUIREMENTS
1. **Content Accuracy**: Every question must be directly answerable from the document. Do NOT introduce external information.
2. **Cognitive Depth**: Questions should test understanding, not just rote memorization. Use real-world scenarios when appropriate.
3. **Option Quality**:
   - Exactly 4 options (A, B, C, D)
   - One clearly correct answer
   - Distractors should be plausible but definitively incorrect
   - Avoid "all of the above" or "none of the above"
   - Options should be similar in length and complexity
4. **Question Diversity**: Cover different sections and concepts from the document. Avoid repetitive question patterns.
5. **Clarity**: Questions must be unambiguous with precise wording.

## OUTPUT FORMAT
Return ONLY a valid JSON object with a single key "questions" whose value is an array of question objects. No markdown, no explanations, no preamble.

{{
  "questions": [
    {{
      "question": "Clear, well-formed question text?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correct_answer": "A",
      "explanation": "Brief explanation (1-2 sentences) referencing the document content",
      "difficulty": "EASY or MEDIUM or HARD",
      "bloom_level": "Remember/Understand/Apply/Analyze/Evaluate/Create"
    }}
  ]
}}

## IMPORTANT
- Return ONLY the JSON object — no markdown fences, no commentary
- Ensure valid JSON syntax. Escape any double-quote characters inside string values as \\"
- Do not use line breaks inside string values
- All {num_questions} questions must be unique and cover different aspects of the document
- The correct_answer field must be exactly "A", "B", "C", or "D"

Generate the JSON now:
"""

# ── Similarity Detection ───────────────────────────────
def simple_text_similarity(text1: str, text2: str) -> float:
    """
    Simple Jaccard similarity for detecting duplicate questions.
    Returns a value between 0 and 1.
    """
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = words1 & words2
    union = words1 | words2
    
    return len(intersection) / len(union) if union else 0.0

def filter_duplicate_questions(questions: List[Dict], threshold: float = 0.7) -> List[Dict]:
    """
    Filter out questions that are too similar to each other.
    Returns a deduplicated list.
    """
    if len(questions) <= 1:
        return questions
    
    filtered = [questions[0]]
    
    for q in questions[1:]:
        is_duplicate = False
        for existing in filtered:
            # Check question text similarity
            sim = simple_text_similarity(q.get("question", ""), existing.get("question", ""))
            if sim >= threshold:
                is_duplicate = True
                break
            
            # Also check if options are too similar
            q_options = " ".join(q.get("options", []))
            existing_options = " ".join(existing.get("options", []))
            opt_sim = simple_text_similarity(q_options, existing_options)
            if opt_sim >= threshold:
                is_duplicate = True
                break
        
        if not is_duplicate:
            filtered.append(q)
    
    return filtered

# ── JSON Validation & Repair ───────────────────────────
def validate_question_structure(question: Dict) -> bool:
    """Validate that a question has all required fields with correct types."""
    required_fields = {
        "question": str,
        "options": list,
        "correct_answer": str,
    }
    
    for field, field_type in required_fields.items():
        if field not in question:
            return False
        if not isinstance(question[field], field_type):
            return False
    
    # Validate options count
    if not isinstance(question["options"], list) or len(question["options"]) != 4:
        return False
    
    # Validate correct_answer is valid index
    if question["correct_answer"] not in ["A", "B", "C", "D", "0", "1", "2", "3"]:
        return False
    
    # Validate all options are non-empty strings
    for opt in question["options"]:
        if not isinstance(opt, str) or not opt.strip():
            return False
    
    return True

def repair_question(question: Dict, index: int) -> Dict:
    """Attempt to repair a malformed question structure."""
    repaired = {
        "question": str(question.get("question", "Question " + str(index + 1))),
        "options": [],
        "correct_answer": question.get("correct_answer", "A"),
        "explanation": question.get("explanation", "Answer based on document content."),
        "difficulty": question.get("difficulty", "MEDIUM"),
        "bloom_level": question.get("bloom_level", "Understand")
    }
    
    # Fix options
    raw_options = question.get("options", [])
    if isinstance(raw_options, list):
        repaired["options"] = [str(o) for o in raw_options[:4]]
        # Pad with placeholder if less than 4
        opt_count = len(repaired["options"])
        while opt_count < 4:
            repaired["options"].append("Option " + chr(65 + opt_count))
            opt_count += 1
    else:
        repaired["options"] = ["Option A", "Option B", "Option C", "Option D"]
    
    # Fix correct_answer
    ca = repaired["correct_answer"]
    if ca not in ["A", "B", "C", "D"]:
        repaired["correct_answer"] = "A"
    
    return repaired

def _try_json_repair(text: str) -> Tuple[Optional[Any], Optional[str]]:
    """Try to repair malformed JSON using the json-repair library if available."""
    try:
        from json_repair import repair_json
        repaired = repair_json(text, return_objects=True)
        return repaired, None
    except ImportError:
        return None, "json-repair library not installed"
    except Exception as e:
        return None, f"json-repair failed: {e}"


def _extract_question_objects(text: str) -> List[Dict]:
    """
    Last-resort parser: scan for top-level {...} blocks inside the array
    and try to parse each one independently. This recovers as many
    questions as possible when the overall array has syntax errors.
    """
    results: List[Dict] = []
    depth = 0
    start_idx = -1
    in_string = False
    escape = False

    for i, ch in enumerate(text):
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            if depth == 0:
                start_idx = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start_idx != -1:
                block = text[start_idx:i + 1]
                # Try strict JSON, then json-repair
                try:
                    parsed = json.loads(block)
                    if isinstance(parsed, dict):
                        results.append(parsed)
                except json.JSONDecodeError:
                    repaired, _ = _try_json_repair(block)
                    if isinstance(repaired, dict):
                        results.append(repaired)
                start_idx = -1
    return results


def safe_json_parse(text: str) -> Tuple[List[Dict], List[str]]:
    """
    Safely parse JSON from text, with auto-repair capabilities.
    Returns (parsed_questions, warnings)

    Strategy (in order):
      1. Strip markdown fences and locate the JSON payload.
      2. Try strict json.loads on the cleaned text.
      3. Try json-repair on the cleaned text.
      4. Scan for individual {...} question blocks and parse each.
    """
    warnings: List[str] = []

    if not text or not text.strip():
        warnings.append("Empty response")
        return [], warnings

    cleaned = text.strip()

    # Remove markdown code fences (```json ... ``` or ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL | re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1).strip()

    # Locate JSON payload. Prefer an array; fall back to a top-level object
    # that contains a "questions" array (Groq JSON mode wraps things this way).
    array_start = cleaned.find('[')
    array_end = cleaned.rfind(']')
    obj_start = cleaned.find('{')
    obj_end = cleaned.rfind('}')

    payload = None
    if array_start != -1 and array_end > array_start:
        payload = cleaned[array_start:array_end + 1]
    elif obj_start != -1 and obj_end > obj_start:
        payload = cleaned[obj_start:obj_end + 1]
    else:
        warnings.append("No JSON object or array found in response")
        return [], warnings

    # Light, *safe* fixups (do NOT touch quotes — that breaks apostrophes).
    payload = re.sub(r',\s*([}\]])', r'\1', payload)   # trailing commas
    payload = re.sub(r'}\s*{', '},{', payload)         # missing commas between objects

    def _normalize(parsed: Any) -> List[Dict]:
        """Coerce parsed JSON into a list of question dicts."""
        if isinstance(parsed, list):
            return [q for q in parsed if isinstance(q, dict)]
        if isinstance(parsed, dict):
            for key in ("questions", "quiz", "items", "data", "results"):
                val = parsed.get(key)
                if isinstance(val, list):
                    return [q for q in val if isinstance(q, dict)]
            # Single question wrapped in an object
            if "question" in parsed and "options" in parsed:
                return [parsed]
        return []

    questions: List[Dict] = []

    # Attempt 1: strict parse
    try:
        questions = _normalize(json.loads(payload))
    except json.JSONDecodeError as e:
        warnings.append(f"Strict JSON parse failed: {e}")

    # Attempt 2: json-repair
    if not questions:
        repaired, repair_err = _try_json_repair(payload)
        if repaired is not None:
            questions = _normalize(repaired)
            if questions:
                warnings.append("Recovered using json-repair")
        elif repair_err:
            warnings.append(repair_err)

    # Attempt 3: per-object extraction
    if not questions:
        extracted = _extract_question_objects(payload)
        if extracted:
            questions = extracted
            warnings.append(f"Recovered {len(extracted)} question(s) via per-object extraction")

    if not questions:
        warnings.append("Could not parse any questions from response")
        return [], warnings

    # Validate / repair each question
    valid_questions: List[Dict] = []
    for i, q in enumerate(questions):
        if validate_question_structure(q):
            valid_questions.append(q)
        else:
            warnings.append(f"Question {i + 1} had structural issues - repaired")
            valid_questions.append(repair_question(q, i))

    return valid_questions, warnings

# ── LLM Setup (Gemini primary, Groq fallback) ──────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
llm = None
llm_type = "None"

# Try Gemini first (preferred for higher accuracy)
if GEMINI_API_KEY and GEMINI_API_KEY not in ("", "your-gemini-api-key-here"):
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.prompts import PromptTemplate
        from langchain_text_splitters import RecursiveCharacterTextSplitter

        # Gemini's native JSON mode (response_mime_type) guarantees valid JSON
        # output — no more "Expecting ',' delimiter" parse failures.
        llm = ChatGoogleGenerativeAI(
            google_api_key=GEMINI_API_KEY,
            model=GEMINI_MODEL,
            temperature=0.2,            # Lower = more deterministic / accurate
            max_output_tokens=8192,     # Gemini supports much larger outputs than Groq
            timeout=120,
            max_retries=2,
            response_mime_type="application/json",
        )
        llm_type = f"Gemini ({GEMINI_MODEL})"
        log.info("✅ LLM initialized with %s (JSON mode enabled)", llm_type)
    except ImportError as e:
        log.error("❌ Missing dependency: %s — run: pip install langchain-google-genai", e)
    except Exception as e:
        log.error("❌ Gemini initialization failed: %s", e)

# Fall back to Groq if Gemini wasn't available
if llm is None and GROQ_API_KEY and GROQ_API_KEY not in ("", "your-groq-api-key-here"):
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.prompts import PromptTemplate
        from langchain_text_splitters import RecursiveCharacterTextSplitter

        # Groq uses OpenAI-compatible API
        llm = ChatOpenAI(
            openai_api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=4000,
            request_timeout=60,
        )
        # Force valid JSON output via OpenAI-compatible response_format
        try:
            llm = llm.bind(response_format={"type": "json_object"})
            log.info("✅ Groq JSON mode enabled (response_format=json_object)")
        except Exception as e:
            log.warning("Could not enable JSON mode on Groq client: %s", e)
        llm_type = "Groq (llama-3.3-70b-versatile)"
        log.info("✅ LLM initialized with %s (fallback)", llm_type)
    except ImportError as e:
        log.error("❌ Missing dependency: %s — run: pip install langchain-openai", e)
    except Exception as e:
        log.error("❌ Groq initialization failed: %s", e)

if llm is None:
    log.warning("⚠️ No LLM available (neither GEMINI_API_KEY nor GROQ_API_KEY set) — using text-based fallback")

# ── Request / Response Models ─────────────────────────
class QuizRequest(BaseModel):
    text: str
    num_questions: int = 10
    difficulty: str = "MIXED"  # EASY, MEDIUM, HARD, MIXED

class Question(BaseModel):
    questionText: str
    questionType: str = "MCQ"
    options: Optional[List[str]] = None
    correctAnswer: Optional[str] = None
    explanation: Optional[str] = None
    difficulty: str = "MEDIUM"
    order: int = 0

class QuizResponse(BaseModel):
    success: bool
    questions: List[Question]
    message: Optional[str] = None

class EvaluateRequest(BaseModel):
    questionText: str
    modelAnswer: str
    userAnswer: str

class EvaluateResponse(BaseModel):
    score: float
    feedback: str
    isCorrect: bool

# ── Text Extraction ─────────────────────────────────────
def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF file."""
    try:
        with open(file_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text[:15000]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF extraction failed: {str(e)}")

def extract_text_from_docx(file_path: str) -> str:
    """Extract text from DOCX file."""
    try:
        doc = docx.Document(file_path)
        return "\n".join([p.text for p in doc.paragraphs])[:15000]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"DOCX extraction failed: {str(e)}")

def extract_text_from_txt(file_path: str) -> str:
    """Read text file."""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()[:15000]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"TXT extraction failed: {str(e)}")

# ── Text Cleaning ─────────────────────────────────────
def clean_text_for_quiz(text: str) -> str:
    """Clean extracted text for better quiz generation."""
    import re
    text = re.sub(r'[\w.-]+?@\w+\.\w{2,}', '[EMAIL]', text)
    text = re.sub(r'https?://\S+', '[URL]', text)
    text = re.sub(r'[|•■◆▪–—]+', ' ', text)
    text = re.sub(r'([a-z])\n([A-Z])', r'\1. \2', text)
    text = re.sub(r'\n{2,}', '. ', text)
    text = re.sub(r'  +', ' ', text)
    return text.strip()

# ── Quiz Generation ─────────────────────────────────────
QUIZ_PROMPT_TEMPLATE = """
You are an expert educational quiz generator. Based ONLY on the provided document content, generate {num_questions} multiple-choice quiz questions.

DOCUMENT CONTENT:
{text}

INSTRUCTIONS:
1. Generate exactly {num_questions} MCQ questions STRICTLY based on the document content above
2. Difficulty: {difficulty}
3. For each question: Provide exactly 4 options (A, B, C, D), mark correct answer as "A", "B", "C", or "D"
4. Do NOT add external information not in the document
5. Ensure questions test understanding, not just memorization
6. Use the document's key concepts and terminology
7. Return ONLY the question text in the question field

OUTPUT FORMAT (return ONLY valid JSON array, no markdown, no explanation):
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "A",
    "explanation": "Why this is correct based on document"
  }}
]

Generate ONLY the JSON array:
"""

MAX_RETRIES = 3

def _question_is_grounded(question: Dict, doc_tokens: set) -> bool:
    """
    Heuristic: a question is "grounded" if the question text or its correct
    option contains at least one meaningful (4+ char) token that also appears
    in the document. Helps catch LLM hallucinations where the model invents
    content not present in the source.
    """
    parts = [str(question.get("question", ""))]
    options = question.get("options", []) or []
    ca = str(question.get("correct_answer", "A")).upper()
    if ca in ("A", "B", "C", "D") and len(options) == 4:
        parts.append(str(options[ord(ca) - 65]))
    else:
        parts.extend(str(o) for o in options)

    candidate = " ".join(parts).lower()
    candidate_tokens = {
        t for t in re.findall(r"[a-z][a-z0-9]{3,}", candidate)
        if t not in {"which", "what", "where", "when", "the", "this", "that",
                     "with", "from", "into", "according", "document", "based",
                     "following", "statement", "correct", "describes", "best"}
    }

    return bool(candidate_tokens & doc_tokens)


def filter_grounded_questions(questions: List[Dict], doc_text: str) -> List[Dict]:
    """Drop questions that don't reference any vocabulary from the document."""
    doc_tokens = set(re.findall(r"[a-z][a-z0-9]{3,}", doc_text.lower()))
    if not doc_tokens:
        return questions  # Document too short to validate

    grounded: List[Dict] = []
    dropped = 0
    for q in questions:
        if _question_is_grounded(q, doc_tokens):
            grounded.append(q)
        else:
            dropped += 1
    if dropped:
        log.warning("Dropped %d ungrounded LLM question(s) — no document overlap", dropped)
    return grounded


def generate_cache_key(text: str, num_questions: int, difficulty: str) -> str:
    """
    Generate a cache key based on FULL content hash and parameters.
    Previously only hashed first 1000 chars, which caused two different
    documents with similar headers/abstracts to share the same cached quiz.
    """
    content_hash = hashlib.md5(text.encode("utf-8", errors="ignore")).hexdigest()
    return f"quiz:{content_hash}:{num_questions}:{difficulty}"

def generate_quiz_with_langchain(text: str, num_questions: int = 10, difficulty: str = "MIXED") -> List[Dict]:
    """
    Generate quiz using LangChain + LLM (Gemini primary, Groq fallback) with enhanced prompt engineering.
    
    Features:
    - Cache lookup for identical requests
    - Enhanced Bloom's taxonomy-based prompts
    - Robust JSON parsing with auto-repair
    - Duplicate question filtering
    - Exponential backoff retry logic
    """
    
    if llm is None:
        log.info("Using text-based question generation (no LLM available)")
        return generate_text_based_questions(text, num_questions, difficulty)
    
    log.info("Generating quiz with %s for %d questions (%s difficulty)...", llm_type, num_questions, difficulty)
    
    # Clean the text first
    text = clean_text_for_quiz(text)
    log.info("Text cleaned, length: %d characters", len(text))
    
    # Check cache first
    cache_key = generate_cache_key(text, num_questions, difficulty)
    cached_result = quiz_cache.get(cache_key)
    if cached_result:
        log.info("✅ Cache hit! Returning cached quiz questions")
        return cached_result
    
    # Split text if too long
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=Config.DEFAULT_CHUNK_SIZE,
        chunk_overlap=Config.DEFAULT_CHUNK_OVERLAP
    )
    chunks = text_splitter.split_text(text)

    # Select chunks SPREAD across the document instead of only the first 3.
    # This way questions cover the full content, not just the introduction.
    if len(chunks) <= 5:
        selected_chunks = chunks
    else:
        # Pick first, middle, and last; plus two interpolated chunks for coverage.
        n = len(chunks)
        indices = sorted({0, n // 4, n // 2, (3 * n) // 4, n - 1})
        selected_chunks = [chunks[i] for i in indices]

    combined_text = "\n\n".join(selected_chunks)
    log.info(
        "Text split into %d chunks, using %d spread chunks (indices cover entire document) for context",
        len(chunks), len(selected_chunks)
    )
    
    # Build enhanced prompt with difficulty-specific instructions
    from langchain_core.prompts import PromptTemplate
    
    diff_config = DIFFICULTY_CONFIGS.get(difficulty, DIFFICULTY_CONFIGS["MIXED"])
    difficulty_instruction = diff_config["instruction"]
    
    prompt = PromptTemplate(
        template=ENHANCED_QUIZ_PROMPT,
        input_variables=["text", "num_questions", "difficulty", "difficulty_instruction"]
    )
    
    chain = prompt | llm
    
    last_error = None
    for attempt in range(1, Config.MAX_RETRIES + 1):
        try:
            log.info("Generation attempt %d/%d...", attempt, Config.MAX_RETRIES)
            response = chain.invoke({
                "text": combined_text,
                "num_questions": num_questions,
                "difficulty": difficulty,
                "difficulty_instruction": difficulty_instruction
            })
            result = response.content
            
            # Parse JSON with auto-repair capabilities
            questions, warnings = safe_json_parse(result)
            
            if warnings:
                for w in warnings:
                    log.warning("Parse warning: %s", w)
            
            if not questions:
                raise ValueError("No valid questions could be parsed from response")
            
            # Filter duplicates
            original_count = len(questions)
            questions = filter_duplicate_questions(questions, Config.SIMILARITY_THRESHOLD)
            if len(questions) < original_count:
                log.info("Filtered %d duplicate questions (%d -> %d)", 
                        original_count - len(questions), original_count, len(questions))

            # Filter ungrounded questions (those that don't reference any
            # vocabulary from the source document — likely LLM hallucinations).
            before_ground = len(questions)
            questions = filter_grounded_questions(questions, combined_text)
            if len(questions) < before_ground:
                log.info("Grounding filter: kept %d / %d questions",
                         len(questions), before_ground)

            if not questions:
                raise ValueError("All generated questions failed grounding validation — none referenced the document content")

            # Limit to requested number
            questions = questions[:num_questions]
            
            # Format for compatibility with existing system
            formatted = []
            for i, q in enumerate(questions):
                formatted.append({
                    "question": q.get("question", f"Question {i+1}"),
                    "options": q.get("options", ["Option A", "Option B", "Option C", "Option D"]),
                    "correct_answer": q.get("correct_answer", "A"),
                    "explanation": q.get("explanation", "Based on document content."),
                    "difficulty": q.get("difficulty", difficulty if difficulty != "MIXED" else "MEDIUM"),
                    "bloom_level": q.get("bloom_level", "Understand")
                })
            
            # Cache the result
            quiz_cache.set(cache_key, formatted)
            
            log.info("✅ Generated %d questions successfully on attempt %d", len(formatted), attempt)
            return formatted
            
        except (json.JSONDecodeError, ValueError) as e:
            last_error = e
            log.warning("Parse error on attempt %d: %s", attempt, e)
        except Exception as e:
            last_error = e
            log.warning("Generation error on attempt %d: %s", attempt, e)
        
        # Exponential backoff
        if attempt < Config.MAX_RETRIES:
            delay = Config.RETRY_DELAY * attempt
            log.info("Retrying in %d seconds...", delay)
            time.sleep(delay)
    
    log.error("❌ All %d attempts failed. Last error: %s. Falling back to text-based.", Config.MAX_RETRIES, last_error)
    return generate_text_based_questions(text, num_questions, difficulty)

def _split_into_sentences(text: str) -> List[str]:
    """Split document text into clean, usable sentences."""
    raw = re.split(r'(?<=[.!?])\s+', text)
    seen = set()
    out = []
    for s in raw:
        s = s.strip()
        # Keep sentences that are reasonably sized AND contain enough words
        if 30 <= len(s) <= 280 and len(s.split()) >= 6 and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def _extract_key_terms(text: str) -> List[str]:
    """Extract candidate key terms from the document for question seeding."""
    # Multi-word capitalized phrases (likely concepts, e.g., "Build in Exception")
    phrases = re.findall(r'\b[A-Z][A-Za-z]+(?:\s+[A-Za-z]+){1,4}\b', text)
    # Long lowercase technical words (e.g., "photosynthesis")
    long_words = re.findall(r'\b[a-z]{8,}\b', text)
    candidates = phrases + long_words

    # Deduplicate while preserving order, drop common stopwords
    stop = {
        "however", "therefore", "additionally", "furthermore", "moreover",
        "according", "regarding", "concerning", "throughout", "altogether"
    }
    seen = set()
    out = []
    for c in candidates:
        cl = c.lower()
        if cl in stop or cl in seen:
            continue
        seen.add(cl)
        out.append(c)
    return out


def generate_text_based_questions(text: str, num_questions: int, difficulty: str) -> List[Dict]:
    """
    Knowledge-based fallback when the LLM is unavailable.

    Builds fill-in-the-blank style MCQs where:
      - The CORRECT option is the actual sentence from the document containing the term.
      - The DISTRACTORS are OTHER real sentences from the document (similar length).
    This guarantees every option is grounded in the document and the correct
    answer position is randomized — much better than the previous fallback that
    used hard-coded strings like "This is contradicted by the document".
    """
    import random
    log.info("Generating knowledge-based fallback questions from document...")

    text = clean_text_for_quiz(text)
    sentences = _split_into_sentences(text)
    key_terms = _extract_key_terms(text)

    if not sentences or len(sentences) < 4:
        # Not enough material to build genuine MCQs — bubble up the failure.
        log.warning(
            "Document yielded only %d usable sentences and %d key terms — cannot build "
            "knowledge-based fallback. Refusing to return placeholder questions.",
            len(sentences), len(key_terms)
        )
        raise HTTPException(
            status_code=422,
            detail=(
                "Document text is too sparse or unstructured to generate a knowledge-based "
                "quiz. Please upload a richer document or check that AI service (LLM) is "
                "reachable."
            )
        )

    # Map each key term to the first sentence that mentions it
    term_to_sentence: Dict[str, str] = {}
    for term in key_terms:
        pattern = re.compile(re.escape(term), re.IGNORECASE)
        for s in sentences:
            if pattern.search(s):
                if term not in term_to_sentence:
                    term_to_sentence[term] = s
                break

    # Fall back to using sentences directly if we couldn't link terms reliably
    if len(term_to_sentence) < min(4, num_questions):
        log.info("Term mapping sparse, using sentence-based seeding")
        # Use unique sentences as questions: "Which statement appears in the document?"
        random.shuffle(sentences)
        seeds = [(f"Statement {i+1}", s) for i, s in enumerate(sentences[:num_questions])]
    else:
        seeds = list(term_to_sentence.items())[:num_questions]

    questions: List[Dict] = []
    for i, (term, correct_sentence) in enumerate(seeds):
        # Build distractors from OTHER sentences that don't mention the term
        pattern = re.compile(re.escape(term), re.IGNORECASE) if term and not term.startswith("Statement") else None
        candidate_distractors = [
            s for s in sentences
            if s != correct_sentence and (pattern is None or not pattern.search(s))
        ]
        if len(candidate_distractors) < 3:
            # Allow reuse — relax the no-term constraint
            candidate_distractors = [s for s in sentences if s != correct_sentence]

        random.shuffle(candidate_distractors)
        distractors = candidate_distractors[:3]
        if len(distractors) < 3:
            log.warning("Not enough distinct distractors for question %d, skipping", i + 1)
            continue

        # Randomize correct answer position
        options = distractors + [correct_sentence]
        random.shuffle(options)
        correct_index = options.index(correct_sentence)
        correct_letter = chr(ord("A") + correct_index)

        # Phrase the question
        if term.startswith("Statement"):
            question_text = "Which of the following statements is supported by the document?"
        else:
            question_text = f"According to the document, which statement correctly describes \"{term}\"?"

        questions.append({
            "question": question_text,
            "options": [o[:280] for o in options],
            "correct_answer": correct_letter,
            "explanation": f"This statement is taken directly from the document content.",
            "difficulty": difficulty if difficulty != "MIXED" else "MEDIUM",
            "bloom_level": "Remember",
        })

        if len(questions) >= num_questions:
            break

    if not questions:
        raise HTTPException(
            status_code=422,
            detail="Could not generate any knowledge-based questions from the document content."
        )

    log.info("✅ Generated %d knowledge-based fallback questions", len(questions))
    return questions


def generate_sample_questions(num_questions: int, difficulty: str) -> List[Dict]:
    """
    DEPRECATED placeholder generator.

    Previously this returned questions like "Sample MCQ 1: What is the main
    concept discussed?" with options ["Option A", "Option B", ...]. Those are
    NOT knowledge-based — they were saved to the DB and shown to participants,
    making the quiz feature look broken.

    We now always raise so the API surface returns a clear error rather than
    silently storing meaningless placeholder questions.
    """
    raise HTTPException(
        status_code=500,
        detail=(
            "Quiz generation failed and no usable knowledge-based fallback was possible. "
            "Please ensure the LLM service is reachable and the document contains enough "
            "structured text."
        )
    )

def evaluate_short_answer(question_text: str, model_answer: str, user_answer: str) -> Dict:
    """Evaluate short answer using AI."""
    if llm is None:
        user_words = set(user_answer.lower().split())
        model_words = set(model_answer.lower().split())
        match_ratio = len(user_words.intersection(model_words)) / max(len(model_words), 1)
        score = min(100.0, match_ratio * 100)
        return {
            "score": score,
            "feedback": "Partial credit based on keyword matching" if score > 0 else "Answer needs improvement",
            "isCorrect": score >= 60
        }
    
    eval_prompt = f"""
You are an expert evaluator. Evaluate the user's answer against the model answer, based ONLY on accuracy.

QUESTION: {question_text}
MODEL ANSWER: {model_answer}
USER ANSWER: {user_answer}

Evaluate and return ONLY valid JSON:
{{
  "score": 75.0,
  "feedback": "Brief feedback here (max 100 chars)",
  "isCorrect": false
}}

Return ONLY the JSON:
"""
    
    try:
        from langchain_core.prompts import PromptTemplate
        
        prompt = PromptTemplate(template=eval_prompt, input_variables=["question_text", "model_answer", "user_answer"])
        chain = prompt | llm
        response = chain.invoke({
            "question_text": question_text,
            "model_answer": model_answer,
            "user_answer": user_answer
        })
        result = response.content
        
        cleaned = result.strip()
        if "{" in cleaned:
            start = cleaned.find('{')
            end = cleaned.rfind('}') + 1
            if start != -1 and end != 0:
                cleaned = cleaned[start:end]
            result_dict = json.loads(cleaned)
            return {
                "score": float(result_dict.get("score", 0)),
                "feedback": result_dict.get("feedback", "Answer evaluated"),
                "isCorrect": result_dict.get("isCorrect", False)
            }
    except Exception as e:
        log.warning("Evaluation error: %s", e)
    
    # Fallback
    user_words = set(user_answer.lower().split())
    model_words = set(model_answer.lower().split())
    match_ratio = len(user_words.intersection(model_words)) / max(len(model_words), 1)
    score = min(100.0, match_ratio * 100)
    return {
        "score": score,
        "feedback": "Partial credit based on keyword matching" if score > 0 else "Answer needs improvement",
        "isCorrect": score >= 60
    }

# ── API Endpoints ─────────────────────────────────────
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "ai-quiz-generator",
        "llm": llm_type,
        "gemini_key_set": bool(GEMINI_API_KEY and GEMINI_API_KEY != "your-gemini-api-key-here"),
        "groq_key_set": bool(GROQ_API_KEY and GROQ_API_KEY != "your-groq-api-key-here"),
    }

@app.post("/generate-quiz")
async def generate_quiz(request: QuizRequest):
    """
    Generate quiz from provided text content.
    Uses Gemini (primary) or Groq (fallback) to create MCQ questions.
    """
    try:
        if not request.text or len(request.text.strip()) < 50:
            raise HTTPException(
                status_code=422,
                detail="Text content is too short. Please provide at least 50 characters of text."
            )

        if request.num_questions < 1 or request.num_questions > 50:
            raise HTTPException(
                status_code=422,
                detail="Number of questions must be between 1 and 50."
            )

        questions = generate_quiz_with_langchain(
            text=request.text,
            num_questions=request.num_questions,
            difficulty=request.difficulty
        )
        return {
            "questions": questions,
            "quiz_title": "AI Generated Quiz"
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error("Quiz generation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")

@app.post("/upload-and-generate")
async def upload_and_generate(
    file: UploadFile = File(...),
    num_questions: int = Form(10),
    difficulty: str = Form("MIXED"),
):
    """
    Upload document (PDF, DOCX, TXT only) and generate quiz.
    Accepts multipart/form-data.
    """
    try:
        # LAYER 1: STRICT MIME TYPE CHECK
        if file.content_type:
            if file.content_type.startswith("image/"):
                raise HTTPException(
                    status_code=415, 
                    detail="Images are not supported. Please upload PDF, DOCX, or TXT files only."
                )
            
            allowed_mimes = [
                "application/pdf",
                "text/plain",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ]
            if file.content_type not in allowed_mimes:
                raise HTTPException(
                    status_code=415,
                    detail=f"Unsupported file type: {file.content_type}. Only PDF, DOCX, and TXT files are allowed."
                )
        
        # LAYER 2: FILE EXTENSION CHECK
        suffix = file.filename.split('.')[-1].lower() if '.' in file.filename else ""
        allowed_extensions = ["pdf", "docx", "doc", "txt", "md"]
        image_extensions = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif"]
        
        if suffix in image_extensions:
            raise HTTPException(
                status_code=415,
                detail=f"Images (.{suffix}) are not supported. Please upload PDF, DOCX, or TXT files only."
            )
        
        if suffix not in allowed_extensions:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file extension: .{suffix}. Only .pdf, .docx, .doc, .txt files are allowed."
            )
        
        # LAYER 3: MAGIC BYTES CHECK
        file_content = await file.read()
        
        if len(file_content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")
        
        if len(file_content) > 0:
            if file_content[:8].startswith(b'\x89PNG\r\n\x1a\n'):
                raise HTTPException(status_code=415, detail="PNG images are not supported.")
            if file_content[:3] == b'\xff\xd8\xff':
                raise HTTPException(status_code=415, detail="JPEG images are not supported.")
            if file_content[:6].startswith(b'GIF87a') or file_content[:6].startswith(b'GIF89a'):
                raise HTTPException(status_code=415, detail="GIF images are not supported.")
            if file_content[:2] == b'BM':
                raise HTTPException(status_code=415, detail="BMP images are not supported.")
            if len(file_content) >= 12 and file_content[:4] == b'RIFF' and file_content[8:12] == b'WEBP':
                raise HTTPException(status_code=415, detail="WebP images are not supported.")
        
        # Save as temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{suffix}") as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name
        
        # Extract text
        try:
            if suffix == "pdf":
                text = extract_text_from_pdf(tmp_path)
            elif suffix in ["docx", "doc"]:
                text = extract_text_from_docx(tmp_path)
            elif suffix in ["txt", "md"]:
                text = extract_text_from_txt(tmp_path)
            else:
                raise HTTPException(status_code=415, detail="Unsupported file type")
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        
        if not text or len(text.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="Document appears to be empty or contains insufficient text."
            )
        
        # Generate quiz
        try:
            questions = generate_quiz_with_langchain(text, num_questions, difficulty)
        except Exception as e:
            error_msg = str(e)
            if any(kw in error_msg.lower() for kw in ["image", "does not support", "invalid input"]):
                raise HTTPException(
                    status_code=415,
                    detail="This AI model does not support image input. Please upload PDF, DOCX, or TXT files only."
                )
            raise
        
        return {
            "success": True,
            "questions": questions,
            "message": f"Generated {len(questions)} questions from uploaded document using {llm_type}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log.error("Upload-and-generate failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_answer(request: EvaluateRequest):
    """Evaluate a short answer using AI."""
    try:
        result = evaluate_short_answer(
            question_text=request.questionText,
            model_answer=request.modelAnswer,
            user_answer=request.userAnswer
        )
        return result
    except Exception as e:
        log.error("Evaluation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")

@app.get("/cache/status")
async def cache_status():
    """Get cache statistics and status."""
    now = datetime.now()
    active_entries = 0
    expired_entries = 0
    
    for key, timestamp in quiz_cache._timestamps.items():
        if now - timestamp < timedelta(seconds=quiz_cache.default_ttl):
            active_entries += 1
        else:
            expired_entries += 1
    
    return {
        "cache_enabled": True,
        "ttl_seconds": quiz_cache.default_ttl,
        "total_entries": len(quiz_cache._cache),
        "active_entries": active_entries,
        "expired_entries": expired_entries,
        "llm_type": llm_type,
        "service_version": "3.0.0"
    }

@app.delete("/cache/clear")
async def clear_cache():
    """Clear all cached quiz generations."""
    quiz_cache.clear()
    log.info("Cache cleared by admin request")
    return {"message": "Cache cleared successfully", "status": "ok"}


if __name__ == "__main__":
    import uvicorn
    log.info("Starting AI Quiz Generator on port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
