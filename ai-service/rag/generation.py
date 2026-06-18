import json
import random
import re
from difflib import SequenceMatcher
from typing import Dict, List, Tuple

from services.gemini_client import GeminiClient

from .config import RAGConfig
from .schemas import QuizOutput, normalize_difficulty, normalize_question_type
from .vector_store import RetrievedChunk


class QuizGenerationError(RuntimeError):
    pass


class RAGQuizGenerationService:
    def __init__(self, config: RAGConfig):
        self.config = config
        self.client = GeminiClient(api_key=config.gemini_api_key, model=config.gemini_model)

    def generate(
        self,
        *,
        retrieved_chunks: List[RetrievedChunk],
        source_title: str,
        difficulty: str,
        number_of_questions: int,
        question_type: str,
    ) -> QuizOutput:
        try:
            self.config.require_gemini_key()
        except RuntimeError as exc:
            raise QuizGenerationError(str(exc)) from exc

        context = self._format_context(retrieved_chunks)
        normalized_type = normalize_question_type(question_type)
        normalized_difficulty = normalize_difficulty(difficulty, allow_mixed=True)
        counts = self._type_counts(number_of_questions, normalized_type)
        last_error = ""

        for attempt in range(1, self.config.max_generation_retries + 1):
            prompt = self._build_prompt(
                context=context,
                source_title=source_title,
                difficulty=normalized_difficulty,
                number_of_questions=number_of_questions,
                counts=counts,
                nonce=random.randint(100000, 999999),
                previous_error=last_error,
            )
            raw = self.client.generate_content(prompt, temperature=0.65, response_json=True)
            try:
                parsed = self._parse(raw)
                quiz = QuizOutput.model_validate(parsed)
                self._validate_count_and_types(quiz, number_of_questions, counts)
                self._validate_no_copying(quiz, context)
                self._validate_grounding(quiz, context)
                return quiz
            except Exception as exc:
                last_error = str(exc)

        raise QuizGenerationError(f"LLM did not return valid quiz JSON after retries: {last_error}")

    def _build_prompt(
        self,
        *,
        context: str,
        source_title: str,
        difficulty: str,
        number_of_questions: int,
        counts: Dict[str, int],
        nonce: int,
        previous_error: str,
    ) -> str:
        error_block = f"\nPrevious invalid output error: {previous_error}\nFix it exactly.\n" if previous_error else ""
        return f"""
You are a senior professional certification exam item writer.

Use ONLY the retrieved learning-material chunks below. Do not use outside facts.
Do not copy source sentences. Write original, realistic, non-template questions that test understanding.
Every question must be answerable from the retrieved chunks.

Source title: {source_title}
Quiz variation seed: {nonce}
Target difficulty: {difficulty}
Total questions: {number_of_questions}

Exact question-type counts:
- MCQ: {counts["MCQ"]}
- TRUE_FALSE: {counts["TRUE_FALSE"]}
- FILL_BLANK: {counts["FILL_BLANK"]}

Required quality mix:
- Conceptual questions
- Scenario questions
- Application questions
- Analytical questions

Rules:
- No duplicate questions.
- No factual copy-paste questions.
- No hallucinated content.
- Cover the most important topics visible in the retrieved chunks.
- MCQ questions must have exactly four plausible options and one correct answer.
- correctAnswer for MCQ must exactly match the correct option text.
- TRUE_FALSE options must be ["True", "False"].
- FILL_BLANK questions must contain exactly one ____ blank.
- Use Bloom levels: Understand, Apply, Analyze, Evaluate, or Create.
- Return raw JSON only.
{error_block}
Retrieved chunks:
{context}

Return this exact JSON shape:
{{
  "title": "Concise quiz title",
  "difficulty": "{difficulty}",
  "totalQuestions": {number_of_questions},
  "questions": [
    {{
      "questionType": "MCQ",
      "question": "Original question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Exact correct option text",
      "explanation": "Why the answer is correct, grounded in the chunks",
      "difficulty": "Easy",
      "topic": "Specific topic",
      "bloomsLevel": "Apply"
    }}
  ]
}}
"""

    @staticmethod
    def _format_context(chunks: List[RetrievedChunk]) -> str:
        return "\n\n".join(
            f"[Chunk {chunk.chunk_number} | score {chunk.score:.3f}]\n{chunk.chunk_text}"
            for chunk in chunks
        )

    @staticmethod
    def _parse(raw: str):
        text = raw.strip()
        fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.S | re.I)
        if fence:
            text = fence.group(1).strip()
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            text = text[start : end + 1]
        return json.loads(text)

    @staticmethod
    def _type_counts(total: int, requested_type: str) -> Dict[str, int]:
        if requested_type in {"MCQ", "TRUE_FALSE", "FILL_BLANK"}:
            return {
                "MCQ": total if requested_type == "MCQ" else 0,
                "TRUE_FALSE": total if requested_type == "TRUE_FALSE" else 0,
                "FILL_BLANK": total if requested_type == "FILL_BLANK" else 0,
            }
        mcq = max(1, round(total * 0.6))
        true_false = max(0, round(total * 0.2))
        fill_blank = max(0, total - mcq - true_false)
        while mcq + true_false + fill_blank > total:
            mcq -= 1
        while mcq + true_false + fill_blank < total:
            fill_blank += 1
        return {"MCQ": mcq, "TRUE_FALSE": true_false, "FILL_BLANK": fill_blank}

    @staticmethod
    def _validate_count_and_types(quiz: QuizOutput, total: int, counts: Dict[str, int]) -> None:
        if len(quiz.questions) != total:
            raise ValueError(f"Expected {total} questions, got {len(quiz.questions)}.")
        actual = {"MCQ": 0, "TRUE_FALSE": 0, "FILL_BLANK": 0}
        for question in quiz.questions:
            actual[question.questionType.value] += 1
        if actual != counts:
            raise ValueError(f"Question type counts mismatch. Expected {counts}, got {actual}.")

    @staticmethod
    def _validate_no_copying(quiz: QuizOutput, context: str) -> None:
        normalized_context = " ".join(context.lower().split())
        for question in quiz.questions:
            candidates = [question.question, question.explanation]
            for candidate in candidates:
                clean = " ".join(candidate.lower().split())
                if len(clean) > 40 and clean in normalized_context:
                    raise ValueError("Generated text copies a source sentence too closely.")

    @staticmethod
    def _validate_grounding(quiz: QuizOutput, context: str) -> None:
        context_tokens = set(RAGQuizGenerationService._meaningful_tokens(context))
        for question in quiz.questions:
            probe = f"{question.topic} {question.question} {question.correctAnswer}"
            tokens = set(RAGQuizGenerationService._meaningful_tokens(probe))
            if tokens and len(tokens & context_tokens) == 0:
                raise ValueError(f"Question appears ungrounded: {question.question}")

    @staticmethod
    def _meaningful_tokens(text: str) -> List[str]:
        stop = {
            "about", "after", "again", "also", "because", "before", "being", "between",
            "could", "every", "from", "have", "into", "only", "should", "than", "that",
            "their", "there", "these", "this", "true", "false", "what", "when", "where",
            "which", "while", "with", "would", "your",
        }
        return [
            token
            for token in re.findall(r"[a-zA-Z][a-zA-Z0-9_+-]{3,}", text.lower())
            if token not in stop
        ]

    @staticmethod
    def similarity(left: str, right: str) -> float:
        return SequenceMatcher(None, left.lower(), right.lower()).ratio()
