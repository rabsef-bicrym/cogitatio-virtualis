# /cogitatio-virtualis/cogitatio-server/cogitatio/api/types.py

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
from cogitatio.types.schemas import DocumentType

class EmbeddingType(str, Enum):
    NONE = "none"
    QUERY = "query"
    DOCUMENT = "document"

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    embedding_type: EmbeddingType = Field(default=EmbeddingType.NONE)
    k: int = Field(default=3, ge=1, le=20)
    filter_types: Optional[List[DocumentType]] = None

class SearchResult(BaseModel):
    doc_id: str  # Include doc_id
    chunk_id: str  # Include chunk_id
    score: float = Field(ge=0.0, le=1.0)  # Ensure score is scaled between 0 and 1
    content: str
    metadata: Dict[str, Any]

class DocumentResponse(BaseModel):
    doc_id: str
    chunk_id: str  # Add chunk_id
    total_chunks: int
    content: str
    metadata: Dict[str, Any]

class RandomTextResponse(BaseModel):
    texts: List[str]

class DatabaseStats(BaseModel):
    total_vectors: int
    total_documents: int
    vectors_in_metadata: int
    dimension: int
    index_size_mb: float
