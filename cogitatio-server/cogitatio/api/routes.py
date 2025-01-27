# /cogitatio-virtualis/cogitatio-server/cogitatio/api/routes.py

from fastapi import FastAPI, HTTPException, Query, Depends, Request
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict
from contextlib import asynccontextmanager
from cogitatio.document_processor.document_store import DocumentStore
from cogitatio.document_processor.vector_manager import VectorManager
from cogitatio.types.schemas import DocumentType, ProjectSubType, OtherSubType
from cogitatio.utils.logging import ComponentLogger
from .types import SearchRequest, SearchResult, DocumentResponse, RandomTextResponse, DatabaseStats

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
    stats = doc_store.vector_manager.get_stats()
    return DatabaseStats(**stats)

@app.get("/documents/random", response_model=RandomTextResponse)
async def get_random_documents(
    count: int = Query(default=5, ge=1, le=20),
    doc_store: DocumentStore = Depends(get_document_store)
) -> RandomTextResponse:
    """Get random document chunks as raw text."""
    try:
        texts = await doc_store.get_random_texts(n=count)
        return RandomTextResponse(texts=texts)
    except Exception as e:
        logger.log_error(f"Error getting random documents: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve random documents.")

@app.get("/documents/{doc_id}", response_model=List[DocumentResponse])
async def get_document(
    doc_id: str,
    doc_store: DocumentStore = Depends(get_document_store)
) -> List[DocumentResponse]:
    """Get all chunks of a document by ID."""
    try:
        docs = await doc_store.get_document(doc_id)
        if not docs:
            raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found.")
        return [DocumentResponse(**doc) for doc in docs]
    except HTTPException:
        raise
    except Exception as e:
        logger.log_error(f"Error getting document '{doc_id}': {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve the document.")

@app.get("/documents/type/{doc_type}", response_model=List[DocumentResponse])
async def get_documents_by_type(
    doc_type: DocumentType,
    project_subtype: Optional[ProjectSubType] = Query(default=None),
    other_subtype: Optional[OtherSubType] = Query(default=None),
    doc_store: DocumentStore = Depends(get_document_store)
) -> List[DocumentResponse]:
    """Get documents by type and their respective subtypes."""
    try:
        # Validate subtype inputs
        if doc_type == DocumentType.PROJECT and other_subtype is not None:
            raise HTTPException(
                status_code=400,
                detail="Invalid subtype: 'other_subtype' is not applicable for 'PROJECT' documents."
            )
        if doc_type == DocumentType.OTHER and project_subtype is not None:
            raise HTTPException(
                status_code=400,
                detail="Invalid subtype: 'project_subtype' is not applicable for 'OTHER' documents."
            )

        docs = await doc_store.search_by_metadata(
            doc_type=doc_type,
            project_subtype=project_subtype,
            other_subtype=other_subtype
        )
        return [DocumentResponse(**doc) for doc in docs]
    except HTTPException as e:
        logger.log_error(f"HTTPException in get_documents_by_type: {e.detail}")
        raise
    except Exception as e:
        logger.log_error(f"Error getting documents by type '{doc_type}': {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve documents by type.")

@app.post("/search", response_model=List[SearchResult])
async def search_documents(
    request: SearchRequest,
    doc_store: DocumentStore = Depends(get_document_store)
) -> List[SearchResult]:
    """
    Search documents using embedding types: 'none', 'query', 'document'.
    """
    try:
        results = await doc_store.search_by_text(
            query_text=request.query,
            k=request.k,
            filter_types=request.filter_types,
            embedding_type=request.embedding_type  # Pass embedding_type directly
        )
        
        for idx, r in enumerate(results):
            logger.log_info(f"Result {idx}: Doc ID: {r['doc_id']}, Chunk ID: {r['chunk_id']}")
            if 'metadata' in r:
                logger.log_info(f"Result {idx} metadata: {r['metadata']}")
    
        # Ensure 'content' is included in SearchResult
        return [
            SearchResult(
                doc_id=r['doc_id'],  # Include doc_id
                chunk_id=r['chunk_id'],
                score=r['score'],
                content=r['content'],  # Include 'content' in the response
                metadata=r['metadata']
            )
            for r in results
        ]
    except Exception as e:
        logger.log_error(f"Error searching documents: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to perform search.")

# Error Handlers
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    logger.log_error(f"ValueError: {str(exc)}")
    return JSONResponse(status_code=400, content={"detail": str(exc)})

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.log_error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})
