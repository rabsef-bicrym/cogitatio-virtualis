# cogitatio-virtualis/cogitatio-server/cogitatio/api/routes.py

from fastapi import FastAPI, HTTPException, Query, Depends
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field
from enum import Enum

from cogitatio.document_processor.document_store import DocumentStore
from cogitatio.document_processor.vector_manager import VectorManager
from cogitatio.types.schemas import DocumentType, ProjectSubType, OtherDocumentType
from cogitatio.utils.logging import ComponentLogger

logger = ComponentLogger("api")

# --- Define singleton storage ---
_vector_manager: Optional[VectorManager] = None
_document_store: Optional[DocumentStore] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global _vector_manager, _document_store
    try:
        logger.log_info("Initializing vector manager and document store...")
        _vector_manager = VectorManager()
        _document_store = DocumentStore(_vector_manager)
        logger.log_info("Initialization complete")
        yield
    except Exception as e:
        logger.log_error(f"Failed to initialize: {str(e)}")
        raise
    finally:
        # Cleanup on shutdown
        logger.log_info("Shutting down...")
        _vector_manager = None
        _document_store = None

# Create FastAPI app with lifespan
app = FastAPI(title="COGITATIO VIRTUALIS API", lifespan=lifespan)

# --- Request/Response Models ---

class SearchMode(str, Enum):
    SIMILARITY = "similarity"
    SEMANTIC = "semantic"
    HYDE = "hyde"

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    mode: SearchMode = Field(default=SearchMode.SEMANTIC)
    k: int = Field(default=5, ge=1, le=20)
    filter_types: Optional[List[DocumentType]] = None
    use_hyde: bool = Field(default=False)

class ChunkMetadata(BaseModel):
    doc_id: str
    chunk_index: int
    total_chunks: int
    type: DocumentType
    source_file: str

class SearchResult(BaseModel):
    chunk_id: str
    score: float = Field(ge=0.0, le=1.0)
    content: str
    metadata: ChunkMetadata

class DocumentResponse(BaseModel):
    doc_id: str
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

# --- Dependencies ---

def get_document_store() -> DocumentStore:
    """Dependency that returns our singleton DocumentStore"""
    if _document_store is None:
        raise RuntimeError("DocumentStore not initialized")
    return _document_store

# --- Routes ---

@app.get("/health")
async def health_check() -> Dict[str, str]:
    """Simple health check endpoint"""
    return {"status": "healthy"}

@app.get("/stats", response_model=DatabaseStats)
async def get_stats(
    doc_store: DocumentStore = Depends(get_document_store)
) -> DatabaseStats:
    """Get database statistics"""
    return doc_store.vector_manager.get_stats()

@app.get("/documents/random", response_model=RandomTextResponse)
async def get_random_documents(
    count: int = Query(default=5, ge=1, le=20),  # Simple, works with FastAPI 0.104
    doc_store: DocumentStore = Depends(get_document_store)
) -> RandomTextResponse:
    """Get random document chunks as raw text."""
    try:
        texts = await doc_store.get_random_texts(n=count)
        return RandomTextResponse(texts=texts)
    except Exception as e:
        logger.log_error(f"Error getting random documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(
    doc_id: str,
    doc_store: DocumentStore = Depends(get_document_store)
) -> DocumentResponse:
    """Get a complete document by ID."""
    try:
        doc = await doc_store.get_document(doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
        return DocumentResponse(**doc)
    except HTTPException:
        raise
    except Exception as e:
        logger.log_error(f"Error getting document {doc_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents/type/{doc_type}", response_model=List[DocumentResponse])
async def get_documents_by_type(
    doc_type: DocumentType,
    project_subtype: Optional[ProjectSubType] = None,
    other_subtype: Optional[OtherDocumentType] = None,
    doc_store: DocumentStore = Depends(get_document_store)
) -> List[DocumentResponse]:
    """Get documents by type and optional subtypes."""
    try:
        docs = await doc_store.search_by_metadata(
            doc_type=doc_type,
            project_subtype=project_subtype,
            other_subtype=other_subtype
        )
        return [DocumentResponse(**doc) for doc in docs]
    except Exception as e:
        logger.log_error(f"Error getting documents by type {doc_type}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search", response_model=List[SearchResult])
async def search_documents(
    request: SearchRequest,
    doc_store: DocumentStore = Depends(get_document_store)
) -> List[SearchResult]:
    """
    Search documents using different modes:
    - similarity: Raw vector similarity search
    - semantic: Optimized semantic search
    - hyde: Hypothetical Document Embedding search
    """
    try:
        results = await doc_store.search_by_text(
            query_text=request.query,
            k=request.k,
            filter_types=request.filter_types,
            use_hyde=request.mode == SearchMode.HYDE
        )
        
        return [
            SearchResult(
                chunk_id=r['chunk_id'],
                score=r['score'],
                content=r['content'],
                metadata=ChunkMetadata(**r['metadata'])
            )
            for r in results
        ]
    except Exception as e:
        logger.log_error(f"Error searching documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Error Handlers
@app.exception_handler(ValueError)
async def value_error_handler(request, exc: ValueError):
    return {"status_code": 400, "detail": str(exc)}

@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    logger.log_error(f"Unhandled exception: {str(exc)}")
    return {"status_code": 500, "detail": "Internal server error"}