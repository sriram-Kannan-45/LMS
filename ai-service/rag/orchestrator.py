import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from .chunking import TokenChunker
from .cleaning import TextCleaner
from .config import RAGConfig
from .embeddings import EmbeddingService
from .extraction import TextExtractor
from .generation import RAGQuizGenerationService
from .schemas import QuizOutput, normalize_question_type
from .vector_store import FaissVectorStore


@dataclass
class RAGQuizRequest:
    training_id: Optional[Any] = None
    course_id: Optional[Any] = None
    difficulty: str = "MIXED"
    number_of_questions: int = 10
    question_type: str = "MIXED"
    file_path: Optional[str] = None
    mime_type: Optional[str] = None
    source_url: Optional[str] = None
    text: Optional[str] = None
    source_title: Optional[str] = None


class RAGQuizGenerator:
    def __init__(self, config: Optional[RAGConfig] = None):
        self.config = config or RAGConfig()
        self.extractor = TextExtractor(self.config)
        self.cleaner = TextCleaner()
        self.chunker = TokenChunker(self.config)
        self.embeddings = EmbeddingService(self.config)
        self.vector_store = FaissVectorStore(self.config)
        self.generator = RAGQuizGenerationService(self.config)

    def generate(self, request: RAGQuizRequest) -> Dict[str, Any]:
        self._validate_request(request)
        self.config.require_gemini_key()
        raw_text, source_title = self._load_text(request)
        clean_text = self.cleaner.clean(raw_text)
        if len(clean_text) < self.config.min_text_chars:
            raise ValueError("Learning material contains insufficient extractable text for quiz generation.")

        training_id = str(request.training_id or request.course_id or "unassigned")
        chunks = self.chunker.split(clean_text, training_id=training_id)
        if not chunks:
            raise ValueError("Could not create usable text chunks from the learning material.")

        chunk_texts = [chunk.chunk_text for chunk in chunks]
        chunk_embeddings = self.embeddings.embed_documents(chunk_texts)
        source_id = self._source_id(clean_text, source_title)
        index_handle = self.vector_store.build(training_id, source_id, chunks, chunk_embeddings)

        query = self._retrieval_query(request, source_title)
        query_embedding = self.embeddings.embed_query(query)
        retrieved = index_handle.retrieve(query_embedding, top_k=self.config.retrieval_top_k)
        if not retrieved:
            raise ValueError("Retriever did not return context chunks.")

        quiz: QuizOutput = self.generator.generate(
            retrieved_chunks=retrieved,
            source_title=source_title,
            difficulty=request.difficulty,
            number_of_questions=request.number_of_questions,
            question_type=request.question_type,
        )

        metadata = {
            "trainingId": request.training_id,
            "courseId": request.course_id,
            "sourceTitle": source_title,
            "sourceId": source_id,
            "embeddingModel": self.embeddings.model_name,
            "faissIndexPath": str(index_handle.index_path),
            "chunkCount": len(chunks),
            "retrievedChunkNumbers": [chunk.chunk_number for chunk in retrieved],
            "retrievalTopK": self.config.retrieval_top_k,
            "cleanTextPreview": clean_text[:50000],
        }
        return quiz.to_response(metadata=metadata)

    def _load_text(self, request: RAGQuizRequest) -> tuple[str, str]:
        if request.text:
            title = request.source_title or "Uploaded learning material"
            return request.text, title
        if request.source_url:
            return self.extractor.extract_from_url(request.source_url), request.source_title or request.source_url
        if request.file_path:
            path = Path(request.file_path)
            title = request.source_title or path.name
            return self.extractor.extract_from_file(request.file_path, request.mime_type), title
        raise ValueError("A file, URL, or text payload is required.")

    def _validate_request(self, request: RAGQuizRequest) -> None:
        if request.number_of_questions < 1 or request.number_of_questions > 50:
            raise ValueError("numberOfQuestions must be between 1 and 50.")
        request.question_type = normalize_question_type(request.question_type)
        sources = [bool(request.text), bool(request.file_path), bool(request.source_url)]
        if sum(sources) != 1:
            raise ValueError("Provide exactly one source: file_path, source_url, or text.")

    @staticmethod
    def _source_id(text: str, source_title: str) -> str:
        digest = hashlib.sha256(f"{source_title}\n{text[:20000]}".encode("utf-8", errors="ignore")).hexdigest()
        return digest[:16]

    @staticmethod
    def _retrieval_query(request: RAGQuizRequest, source_title: str) -> str:
        return (
            f"{source_title}. Generate {request.number_of_questions} {request.question_type} "
            f"{request.difficulty} conceptual scenario application analytical quiz questions. "
            "Important concepts, procedures, tradeoffs, examples, definitions, and learner outcomes."
        )
