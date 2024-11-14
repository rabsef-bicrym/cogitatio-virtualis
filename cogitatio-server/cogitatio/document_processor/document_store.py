# cogitatio-virtualis/cogitatio-server/cogitatio/document_processor/document_store.py

import numpy as np
import faiss
import sqlite3
import json
from pathlib import Path
import voyageai
from typing import List, Dict, Any, Optional, Tuple, Union
from cogitatio.utils.logging import ComponentLogger
from cogitatio.types.schemas import DocumentType, OtherDocumentType, ProjectSubType
from .vector_manager import VectorManager
from .config import get_voyage_client_config

logger = ComponentLogger("document_store")

class DocumentStore:
    """
    Manages document retrieval operations, providing interfaces for:
    - Random text sampling for system messages
    - Full document retrieval by ID
    - Similarity search (RAG) with query optimization
    - HyDE-based retrieval
    - Metadata-based document filtering
    """
    
    def __init__(self, vector_manager: VectorManager):
        """
        Initialize document store with vector manager.
        
        Args:
            vector_manager: Initialized VectorManager instance
        """
        self.vector_manager = vector_manager
        self.db_path = vector_manager.db_path

        try:
            # Initialize Voyage client
            voyage_config = get_voyage_client_config()
            self.embedding_client = voyageai.Client(
                api_key=voyage_config["api_key"]
            )
            self.model = voyage_config["model"]
            
            logger.log_info("Document store initialized", {
                "model": self.model,
                "vector_store": "connected"
            })
        except Exception as e:
            logger.log_error("Failed to initialize document store", {"error": str(e)})
            raise

    async def get_random_texts(self, n: int = 5) -> List[str]:
        """
        Get random chunk texts without metadata, useful for system messages.
        
        Args:
            n: Number of random texts to retrieve
            
        Returns:
            List of random text chunks
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Just get the chunk text, not the full document
                rows = conn.execute("""
                    SELECT metadata->>'chunk_text'
                    FROM metadata
                    ORDER BY RANDOM()
                    LIMIT ?
                """, (n,)).fetchall()
            
            texts = [row[0] for row in rows if row[0]]
            return texts
        except Exception as e:
            logger.log_error("Failed to get random texts", {"error": str(e)})
            return []

    async def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a complete document by ID.
        
        Args:
            doc_id: Document identifier
            
        Returns:
            Dict containing document metadata and content
        """
        try:
            metadata, content = await self.reconstruct_document(doc_id)
            return {
                "doc_id": doc_id,
                "content": content,
                "metadata": metadata
            }
        except Exception as e:
            logger.log_error(f"Failed to get document: {doc_id}", {"error": str(e)})
            return None

    async def encode_query(self, text: str) -> np.ndarray:
        """
        Encode query text with query optimization.
        
        Args:
            text: Query text to encode
            
        Returns:
            Query embedding
        """
        try:
            response = self.embedding_client.embed(
                [text],
                model=self.model,
                input_type="query"  # Optimize for query understanding
            )
            return np.array(response.embeddings[0])
        except Exception as e:
            logger.log_error("Failed to encode query", {"error": str(e), "text_len": len(text)})
            raise

    async def encode_document(self, text: str) -> np.ndarray:
        """
        Encode document text (for HyDE).
        
        Args:
            text: Document text to encode
            
        Returns:
            Document embedding
        """
        try:
            response = self.embedding_client.embed(
                [text],
                model=self.model,
                input_type="document"  # Match stored document encoding
            )
            return np.array(response.embeddings[0])
        except Exception as e:
            logger.log_error("Failed to encode document", {"error": str(e), "text_len": len(text)})
            raise

    async def search_by_text(self,
                           query_text: str,
                           k: int = 5,
                           filter_types: Optional[List[DocumentType]] = None,
                           use_hyde: bool = False) -> List[Dict[str, Any]]:
        """
        Search by text query, supporting both RAG and HyDE approaches.
        
        Args:
            query_text: Search query or hypothetical document
            k: Number of results to return
            filter_types: Optional list of document types to include
            use_hyde: Whether to use HyDE encoding
            
        Returns:
            List of relevant chunks with metadata and scores
        """
        try:
            # Encode query appropriately
            query_vector = await (
                self.encode_document(query_text) if use_hyde
                else self.encode_query(query_text)
            )
            
            return await self.search_similar(
                query_vector,
                k=k,
                filter_types=filter_types
            )
            
        except Exception as e:
            logger.log_error("Failed text search", {
                "error": str(e),
                "use_hyde": use_hyde,
                "filter_types": filter_types
            })
            raise

    async def search_similar(self,
                           query_vector: np.ndarray,
                           k: int = 5,
                           filter_types: Optional[List[DocumentType]] = None
                           ) -> List[Dict[str, Any]]:
        """
        Find k most similar chunks to the query vector.
        
        Args:
            query_vector: Query embedding
            k: Number of results
            filter_types: Optional document types to include
            
        Returns:
            List of matched chunks with scores and metadata
        """
        try:
            # Ensure vector is correct shape
            query_vector = np.array(query_vector).astype('float32').reshape(1, -1)
            
            # Get extra results for filtering
            distances, indices = self.vector_manager.index.search(
                query_vector,
                k * 2 if filter_types else k
            )
            
            results = []
            with sqlite3.connect(self.db_path) as conn:
                for dist, idx in zip(distances[0], indices[0]):
                    if idx == -1:  # No match
                        continue
                        
                    meta_row = conn.execute(
                        "SELECT metadata FROM metadata WHERE vector_id = ?",
                        (int(idx),)
                    ).fetchone()
                    
                    if meta_row:
                        metadata = json.loads(meta_row[0])
                        
                        # Apply type filter if specified
                        if (not filter_types or
                            DocumentType(metadata.get('type', '')) in filter_types):
                            results.append({
                                'chunk_id': f"{metadata.get('doc_id')}_{metadata.get('chunk_index')}",
                                'score': float(1 - dist),
                                'content': metadata.get('text', ''),
                                'metadata': metadata
                            })
                            
                            if len(results) >= k:
                                break
            
            logger.log_info("Similarity search completed", {
                "results": len(results),
                "filter_types": [t.value for t in filter_types] if filter_types else None
            })
            
            return results[:k]
            
        except Exception as e:
            logger.log_error("Failed similarity search", {"error": str(e)})
            raise

    async def reconstruct_document(self, doc_id: str) -> Tuple[Dict[str, Any], str]:
        """
        Reconstruct a complete document from its chunks.
        
        Args:
            doc_id: Document identifier
            
        Returns:
            Tuple of (metadata, content)
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                rows = conn.execute("""
                    SELECT metadata 
                    FROM metadata 
                    WHERE doc_id LIKE ? 
                    ORDER BY json_extract(metadata, '$.chunk_index')
                """, (f"{doc_id}%",)).fetchall()
                
            if not rows:
                raise ValueError(f"No document found: {doc_id}")
                
            chunks = [json.loads(row[0]) for row in rows]
            
            # Extract common metadata (from first chunk)
            metadata = chunks[0].copy()
            for field in ['chunk_index', 'total_chunks', 'text']:
                metadata.pop(field, None)
                
            # Combine content in order
            content = "\n".join(
                chunk.get('text', '') for chunk in chunks
            )
            
            logger.log_info(f"Reconstructed document: {doc_id}", {
                "chunks": len(chunks)
            })
            
            return metadata, content
            
        except Exception as e:
            logger.log_error(f"Failed to reconstruct: {doc_id}", {"error": str(e)})
            raise

    async def search_by_metadata(self,
                               doc_type: Optional[DocumentType] = None,
                               project_subtype: Optional[ProjectSubType] = None,
                               other_subtype: Optional[OtherDocumentType] = None
                               ) -> List[Dict[str, Any]]:
        """
        Search documents by type and optional subtypes.
        
        Args:
            doc_type: Main document type
            project_subtype: Subtype for project documents
            other_subtype: Subtype for other documents
            
        Returns:
            List of matching documents with metadata
        """
        try:
            query = "SELECT DISTINCT doc_id, metadata FROM metadata WHERE 1=1"
            params = []
            
            # Filter by main document type
            if doc_type:
                query += " AND json_extract(metadata, '$.type') = ?"
                params.append(doc_type.value)
            
            # Apply subtype filters based on document type
            if doc_type == DocumentType.PROJECT and project_subtype:
                query += " AND json_extract(metadata, '$.subtype') = ?"
                params.append(project_subtype.value)
            elif doc_type == DocumentType.OTHER and other_subtype:
                query += " AND json_extract(metadata, '$.subtype') = ?"
                params.append(other_subtype.value)
            
            with sqlite3.connect(self.db_path) as conn:
                rows = conn.execute(query, params).fetchall()
            
            documents = []
            for doc_id, meta in rows:
                metadata = json.loads(meta)
                try:
                    _, content = await self.reconstruct_document(doc_id)
                    documents.append({
                        "doc_id": doc_id,
                        "metadata": metadata,
                        "content": content
                    })
                except Exception as e:
                    logger.log_error(f"Failed to reconstruct document: {doc_id}", 
                                  {"error": str(e)})
                    continue
            
            logger.log_info("Metadata search completed", {
                "doc_type": doc_type.value if doc_type else None,
                "project_subtype": project_subtype.value if project_subtype else None,
                "other_subtype": other_subtype.value if other_subtype else None,
                "results": len(documents)
            })
            
            return documents
            
        except Exception as e:
            logger.log_error("Failed metadata search", {
                "error": str(e),
                "doc_type": doc_type.value if doc_type else None,
                "project_subtype": project_subtype.value if project_subtype else None,
                "other_subtype": other_subtype.value if other_subtype else None
            })
            raise