# cogitatio-virtualis/cogitatio-server/cogitatio/document_processor/document_store.py

import numpy as np
import faiss
import sqlite3
import json
from pathlib import Path
import voyageai
from typing import List, Dict, Any, Optional, Tuple, Union
from cogitatio.utils.logging import ComponentLogger
from cogitatio.types.schemas import DocumentType, OtherSubType, ProjectSubType
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
        Get random chunk contents without metadata, useful for system messages.
        
        Args:
            n: Number of random texts to retrieve
            
        Returns:
            List of random text chunks
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Retrieve the 'content' field directly instead of 'chunk_text' from metadata
                rows = conn.execute("""
                    SELECT content
                    FROM metadata
                    ORDER BY RANDOM()
                    LIMIT ?
                """, (n,)).fetchall()
            
            texts = [row[0] for row in rows if row[0]]
            return texts
        except Exception as e:
            logger.log_error("Failed to get random texts", {"error": str(e)})
            return []

    async def get_document(self, doc_id: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get all chunks of a document by ID.

        Args:
            doc_id: Document identifier

        Returns:
            List of document chunks with metadata and content, or None if not found
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                rows = conn.execute("""
                    SELECT 
                        chunk_id, 
                        json_extract(metadata, '$.total_chunks') AS total_chunks, 
                        metadata, 
                        content 
                    FROM metadata 
                    WHERE doc_id = ? 
                    ORDER BY json_extract(metadata, '$.chunk_index')
                """, (doc_id,)).fetchall()

            if not rows:
                return None

            chunks = []
            for chunk_id, total_chunks, meta, content in rows:
                metadata = json.loads(meta)
                chunks.append({
                    "doc_id": metadata.get("doc_id"),
                    "chunk_id": chunk_id,
                    "total_chunks": total_chunks,
                    "content": content,
                    "metadata": metadata
                })

            logger.log_info(f"Retrieved {len(chunks)} chunks for document {doc_id}", {
                "doc_id": doc_id,
                "chunks_retrieved": len(chunks)
            })
            return chunks

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
                            embedding_type: str = "none") -> List[Dict[str, Any]]:
        """
        Handle embedding_type directly: 'none', 'query', 'document'.
        """
        try:
            # Handle embedding based on type
            if embedding_type == "query":
                query_vector = await self.encode_query(query_text)
            elif embedding_type == "document":
                query_vector = await self.encode_document(query_text)
            elif embedding_type == "none":
                response = self.embedding_client.embed([query_text])
                query_vector = np.array(response.embeddings[0])
            else:
                raise ValueError(f"Invalid embedding type: {embedding_type}")
            
            # Perform the similarity search
            return await self.search_similar(query_vector, k=k, filter_types=filter_types)
        except Exception as e:
            logger.log_error("Failed text search", {
                "error": str(e),
                "embedding_type": embedding_type,
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
            search_k = k * 2 if filter_types else k
            distances, indices = self.vector_manager.index.search(
                query_vector,
                search_k
            )
            
            results = []
            with sqlite3.connect(self.db_path) as conn:
                for dist, idx in zip(distances[0], indices[0]):
                    if idx == -1:  # No match
                        continue
                        
                    # Modify the SQL query to retrieve both metadata and content
                    meta_row = conn.execute(
                        "SELECT doc_id, chunk_id, metadata, content FROM metadata WHERE vector_id = ?",
                        (int(idx),)
                    ).fetchone()
                    
                    if meta_row:
                        doc_id, chunk_id, metadata_json, content = meta_row
                        metadata = json.loads(metadata_json)
                        metadata['doc_id'] = doc_id
                        metadata['chunk_id'] = chunk_id
                        metadata['content'] = content
                        
                        # Apply type filter if specified
                        if (not filter_types or
                            DocumentType(metadata.get('type', '')) in filter_types):
                            results.append({
                                'doc_id': doc_id,
                                'chunk_id': chunk_id,
                                'score': float(1 - dist),
                                'content': content,  # Use the 'content' field
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
                # Modify the SQL query to retrieve both metadata and content
                rows = conn.execute("""
                    SELECT metadata, content
                    FROM metadata 
                    WHERE doc_id = ? 
                    ORDER BY json_extract(metadata, '$.chunk_index')
                """, (doc_id,)).fetchall()
                
            if not rows:
                raise ValueError(f"No document found: {doc_id}")
                
            chunks = [json.loads(row[0]) for row in rows]
            contents = [row[1] for row in rows]  # Retrieve 'content' from each row
            
            # Extract common metadata (from first chunk)
            metadata = chunks[0].copy()
            for field in ['chunk_id', 'doc_id', 'chunk_index', 'total_chunks']:
                metadata.pop(field, None)
                
            # Combine content in order
            content = "\n".join(contents)
            
            logger.log_info(f"Reconstructed document: {doc_id}", {
                "chunks": len(chunks)
            })
            
            return metadata, content
                
        except Exception as e:
            logger.log_error(f"Failed to reconstruct: {doc_id}", {"error": str(e)})
            raise

    async def search_by_metadata(
        self,
        doc_type: Optional[DocumentType] = None,
        project_subtype: Optional[ProjectSubType] = None,
        other_subtype: Optional[OtherSubType] = None
    ) -> List[Dict[str, Any]]:
        """
        Search individual document chunks by type and their respective subtypes.
        
        Args:
            doc_type: Main document type (required).
            project_subtype: Subtype for project documents.
            other_subtype: Subtype for other documents.
            
        Returns:
            List of matching document chunks with metadata.
        """
        try:
            if doc_type not in DocumentType:
                raise ValueError(f"Unsupported document type: {doc_type}")

            # Modify the SQL query to select individual chunks
            query = "SELECT chunk_id, json_extract(metadata, '$.total_chunks') AS total_chunks, metadata, content FROM metadata WHERE json_extract(metadata, '$.type') = ?"
            params = [doc_type.value]

            # Add subtype filters based on the document type
            if doc_type == DocumentType.PROJECT and project_subtype:
                query += " AND json_extract(metadata, '$.sub_type') = ?"
                params.append(project_subtype.value)
            elif doc_type == DocumentType.OTHER and other_subtype:
                query += " AND json_extract(metadata, '$.sub_type') = ?"
                params.append(other_subtype.value)

            with sqlite3.connect(self.db_path) as conn:
                rows = conn.execute(query, params).fetchall()

            chunks = []
            for chunk_id, total_chunks, meta, content in rows:
                metadata = json.loads(meta)
                chunks.append({
                    "doc_id": metadata.get("doc_id"),
                    "chunk_id": chunk_id,
                    "total_chunks": total_chunks,
                    "content": content,
                    "metadata": metadata
                })

            logger.log_info("Metadata search completed", {
                "doc_type": doc_type.value,
                "project_subtype": project_subtype.value if project_subtype else None,
                "other_subtype": other_subtype.value if other_subtype else None,
                "results": len(chunks)
            })
            logger.log_info("SQL Query Executed", {"query": query, "params": params})
            return chunks

        except Exception as e:
            logger.log_error("Failed metadata search", {
                "error": str(e),
                "doc_type": doc_type.value if doc_type else None,
                "project_subtype": project_subtype.value if project_subtype else None,
                "other_subtype": other_subtype.value if other_subtype else None
            })
            raise
