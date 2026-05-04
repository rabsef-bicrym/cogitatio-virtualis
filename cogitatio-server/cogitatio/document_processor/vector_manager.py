# cogitatio-virtualis/cogitatio-server/cogitatio/document_processor/vector_manager.py

import os
import faiss
import numpy as np
import tempfile
import json
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from cogitatio.utils.logging import ComponentLogger
from .config import DATA_DIR, VECTOR_DIMENSION

logger = ComponentLogger("vector_store")


class VectorManager:
    """
    Manages vector storage and indexing operations using FAISS.
    Handles vector storage, retrieval, and safe index management with automatic backups.
    """
    
    def __init__(self, dimension: int = VECTOR_DIMENSION):
        """
        Initialize vector store with specified dimensionality.
        
        Args:
            dimension: Vector dimension (default: from config.py)
        """
        self.dimension = dimension
        self.data_dir = DATA_DIR
        self.data_dir.mkdir(exist_ok=True, parents=True)
        
        # Index paths
        self.index_path = self.data_dir / "vectors.index"
        self.backup_path = self.data_dir / "vectors.backup.index"
        
        # Initialize FAISS index
        self.index = self._load_or_create_index()
        
        # Initialize SQLite for metadata
        self.db_path = self.data_dir / "metadata.db"
        self._init_db()
        
        logger.log_info(
            "Vector store initialized",
            {
                "dimension": dimension,
                "total_vectors": self.index.ntotal,
                "data_dir": str(self.data_dir),
            },
        )

    def _load_or_create_index(self) -> faiss.Index:
        """Load existing index or create new one with proper error handling."""
        if self.index_path.exists():
            try:
                index = faiss.read_index(str(self.index_path))
                logger.log_info(f"Loaded existing index with {index.ntotal} vectors")
                return index
            except Exception as e:
                logger.log_error(f"Failed to load index: {e}")
                # Attempt to restore from backup
                if self.backup_path.exists():
                    try:
                        index = faiss.read_index(str(self.backup_path))
                        logger.log_info("Restored index from backup")
                        return index
                    except Exception as backup_e:
                        logger.log_error(f"Failed to restore backup: {backup_e}")

        # Create new index if loading fails
        index = faiss.IndexFlatIP(self.dimension)  # Use inner product
        faiss.write_index(index, str(self.index_path))
        logger.log_info("Created new index")
        return index

    def _init_db(self) -> None:
        """Initialize SQLite database for metadata storage."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS metadata (
                    vector_id INTEGER PRIMARY KEY,
                    doc_id TEXT NOT NULL,             
                    chunk_id TEXT NOT NULL UNIQUE,
                    metadata TEXT NOT NULL,
                    content TEXT NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_doc_id ON metadata(doc_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_chunk_id ON metadata(chunk_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_vector_id ON metadata(vector_id)")

    def store_vectors(self, vectors: List[Dict[str, Any]]) -> None:
        """
        Store vectors and their metadata with automatic backup.
        
        Args:
            vectors: List of dicts containing:
                - 'id': Unique document identifier
                - 'chunk_id': Unique chunk identifier
                - 'values': Vector values as numpy array
                - 'metadata': Dict of metadata
                - 'content': Content of the chunk
        """
        try:
            # Validate that each vector has 'chunk_id'
            for vec in vectors:
                if 'chunk_id' not in vec:
                    raise ValueError("Each vector must have a 'chunk_id' field.")

            # Prepare vectors for FAISS
            vector_data = np.array([v['values'] for v in vectors]).astype('float32')
            vector_data = self._normalize_vectors(vector_data)
            
            # Add to FAISS
            start_idx = self.index.ntotal
            self.index.add(vector_data)
            
            # Store metadata and content
            with sqlite3.connect(self.db_path) as conn:
                for i, vec in enumerate(vectors):
                    vector_id = start_idx + i
                    conn.execute(
                        "INSERT OR REPLACE INTO metadata (vector_id, doc_id, chunk_id, metadata, content) VALUES (?, ?, ?, ?, ?)",
                        (
                            vector_id,
                            vec['id'],
                            vec['chunk_id'],
                            json.dumps(vec['metadata']),
                            vec.get('content', '')  # Ensure 'content' is provided
                        ),
                    )
            
            # Save index after successful update
            self._save_index(self.index)
            
            logger.log_info(f"Stored {len(vectors)} vectors", {
                "total_vectors": self.index.ntotal
            })
            
        except Exception as e:
            logger.log_error("Failed to store vectors", {"error": str(e)})
            raise

    def search_vectors(self, query_vector: np.ndarray, k: int = 5) -> Tuple[List[float], List[Dict[str, Any]]]:
        """
        Search for similar vectors.
        
        Args:
            query_vector: Vector to search for
            k: Number of results to return
            
        Returns:
            Tuple of (distances, metadata_list)
        """
        try:
            # Ensure vector is in correct shape
            query_vector = query_vector.reshape(1, -1).astype('float32')
            query_vector = self._normalize_vectors(query_vector)

            # Search index
            distances, indices = self.index.search(query_vector, k)

            # Get metadata and content for results
            metadata_list = []
            with sqlite3.connect(self.db_path) as conn:
                for idx in indices[0]:
                    if idx != -1:  # -1 indicates no match found
                        result = conn.execute(
                            "SELECT metadata, content, chunk_id FROM metadata WHERE vector_id = ?",
                            (int(idx),)
                        ).fetchone()
                        if result:
                            metadata_json, content, chunk_id = result
                            metadata_dict = json.loads(metadata_json)
                            metadata_dict['content'] = content
                            metadata_dict['chunk_id'] = chunk_id
                            metadata_list.append(metadata_dict)
                        else:
                            metadata_list.append(None)
                    else:
                        metadata_list.append(None)

            return distances[0].tolist(), metadata_list

        except Exception as e:
            logger.log_error("Failed to search vectors", {"error": str(e)})
            raise

    def remove_document(self, doc_id: str) -> None:
        """
        Remove all vectors associated with a document.
        
        Args:
            doc_id: Document ID to remove
        """
        try:
            vectors_removed = self._remove_vectors_where(
                "doc_id LIKE ?",
                (f"{doc_id}%",),
            )

            if vectors_removed == 0:
                logger.log_warning(f"No vectors found for document: {doc_id}")
                return

            logger.log_info(
                f"Removed vectors for document: {doc_id}",
                {
                    "vectors_removed": vectors_removed,
                    "total_vectors": self.index.ntotal,
                },
            )

        except Exception as e:
            logger.log_error(f"Failed to remove document: {doc_id}", {"error": str(e)})
            raise

    def remove_vector_by_chunk_id(self, chunk_id: str) -> None:
        """
        Remove a specific vector based on its chunk_id.
        
        Args:
            chunk_id: Unique identifier of the chunk to remove
        """
        try:
            vectors_removed = self._remove_vectors_where(
                "chunk_id = ?",
                (chunk_id,),
            )

            if vectors_removed == 0:
                logger.log_warning(f"No vector found with chunk_id: {chunk_id}")
                return

            logger.log_info(
                f"Removed vector with chunk_id: {chunk_id}",
                {
                    "vectors_removed": vectors_removed,
                    "total_vectors": self.index.ntotal,
                },
            )

        except Exception as e:
            logger.log_error(f"Failed to remove vector with chunk_id: {chunk_id}", {"error": str(e)})
            raise

    def _normalize_vectors(self, vectors: np.ndarray) -> np.ndarray:
        """
        Normalize vectors for cosine similarity while rejecting zero vectors.
        """
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        if np.any(norms == 0):
            raise ValueError("Cannot store or search zero-length vectors")
        return vectors / norms

    def _build_index(self, vectors: List[np.ndarray]) -> faiss.Index:
        """
        Build a fresh FAISS index from vectors ordered by their target positions.
        """
        new_index = faiss.IndexFlatIP(self.dimension)
        if vectors:
            vectors_array = np.array(vectors).astype('float32')
            new_index.add(self._normalize_vectors(vectors_array))
        return new_index

    def _remove_vectors_where(self, where_clause: str, params: Tuple[Any, ...]) -> int:
        """
        Remove vectors matching a metadata predicate and remap survivor vector IDs.
        """
        old_index = self.index
        index_file_replaced = False

        with sqlite3.connect(self.db_path) as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                rows = conn.execute(
                    "SELECT vector_id, chunk_id FROM metadata ORDER BY vector_id"
                ).fetchall()
                rows_to_remove = conn.execute(
                    f"SELECT vector_id FROM metadata WHERE {where_clause}",
                    params,
                ).fetchall()
                vector_ids_to_remove = {int(row[0]) for row in rows_to_remove}

                if not vector_ids_to_remove:
                    conn.rollback()
                    return 0

                vectors_to_keep = []
                survivor_remap = []
                for vector_id, chunk_id in rows:
                    vector_id = int(vector_id)
                    if vector_id in vector_ids_to_remove:
                        continue
                    if vector_id < 0 or vector_id >= old_index.ntotal:
                        raise ValueError(
                            f"Metadata vector_id {vector_id} is outside FAISS index size {old_index.ntotal}"
                        )
                    vectors_to_keep.append(old_index.reconstruct(vector_id))
                    survivor_remap.append((len(survivor_remap), chunk_id))

                new_index = self._build_index(vectors_to_keep)

                conn.execute(f"DELETE FROM metadata WHERE {where_clause}", params)
                conn.execute("UPDATE metadata SET vector_id = -vector_id - 1")
                conn.executemany(
                    "UPDATE metadata SET vector_id = ? WHERE chunk_id = ?",
                    survivor_remap,
                )
                self._assert_index_metadata_consistency(conn, new_index)

                self._save_index(new_index)
                index_file_replaced = True
                conn.commit()
                self.index = new_index
                return len(vector_ids_to_remove)
            except Exception:
                conn.rollback()
                self.index = old_index
                if index_file_replaced:
                    self._save_index(old_index)
                raise

    def _assert_index_metadata_consistency(
        self,
        conn: sqlite3.Connection,
        index: faiss.Index,
    ) -> None:
        """
        Verify that persisted metadata IDs exactly match FAISS row positions.
        """
        rows = conn.execute(
            "SELECT vector_id FROM metadata ORDER BY vector_id"
        ).fetchall()
        vector_ids = [int(row[0]) for row in rows]
        expected_ids = list(range(index.ntotal))
        if vector_ids != expected_ids:
            raise ValueError(
                f"Metadata vector IDs {vector_ids} do not match FAISS positions {expected_ids}"
            )

    def _save_index(self, index: Optional[faiss.Index] = None) -> None:
        """Safely save the FAISS index with backup."""
        index_to_save = index if index is not None else self.index
        tmp_path = None

        try:
            with tempfile.NamedTemporaryFile(
                delete=False,
                dir=self.data_dir,
                suffix=".index.tmp",
            ) as tmp_file:
                tmp_path = Path(tmp_file.name)

            faiss.write_index(index_to_save, str(tmp_path))

            # Create backup of current index if it exists
            if self.index_path.exists():
                if self.backup_path.exists():
                    self.backup_path.unlink()
                self.index_path.rename(self.backup_path)

            os.replace(tmp_path, self.index_path)
            
            # Remove backup if save successful
            if self.backup_path.exists():
                self.backup_path.unlink()
                
        except Exception as e:
            logger.log_error("Failed to save index", {"error": str(e)})
            if tmp_path and tmp_path.exists():
                tmp_path.unlink()
            # Attempt to restore backup
            if self.backup_path.exists():
                self.backup_path.rename(self.index_path)
            raise

    def get_stats(self) -> Dict[str, Any]:
        """Get current statistics about the vector store."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                doc_count = conn.execute(
                    "SELECT COUNT(DISTINCT doc_id) FROM metadata"
                ).fetchone()[0]
                vector_count = conn.execute(
                    "SELECT COUNT(*) FROM metadata"
                ).fetchone()[0]
            
            return {
                "total_vectors": self.index.ntotal,
                "total_documents": doc_count,
                "vectors_in_metadata": vector_count,
                "dimension": self.dimension,
                "index_size_mb": self.index_path.stat().st_size / (1024 * 1024)
                if self.index_path.exists() else 0,
                "data_directory": str(self.data_dir)
            }
        except Exception as e:
            logger.log_error("Failed to get stats", {"error": str(e)})
            return {"error": str(e)}

    def reset_store(self) -> None:
        """
        Atomically reset the vector store using safe operations.
        Maintains table structure while clearing all data.
        """
        try:
            logger.log_info("Initiating vector store reset")
            
            # 1. Clear metadata atomically within a transaction
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("BEGIN TRANSACTION")
                try:
                    # Simple DELETE is atomic and safe
                    conn.execute("DELETE FROM metadata")
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                    raise e
            
            # 2. Create new empty FAISS index
            new_index = faiss.IndexFlatIP(self.dimension)
            
            # 3. Atomic replacement of index file using tempfile
            with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                faiss.write_index(new_index, tmp_file.name)
                # os.replace is atomic on POSIX systems
                os.replace(tmp_file.name, str(self.index_path))
            
            # 4. Update the in-memory index
            self.index = new_index
            
            logger.log_info("Vector store reset completed", {
                "dimension": self.dimension,
                "total_vectors": 0
            })
            
        except Exception as e:
            logger.log_error("Failed to reset vector store", {"error": str(e)})
            raise

    def update_vector_metadata(self, chunk_id: str, new_metadata: Dict[str, Any], new_content: Optional[str] = None) -> None:
        """
        Update metadata and/or content of a specific vector identified by chunk_id.
        
        Args:
            chunk_id: Unique identifier of the chunk to update
            new_metadata: New metadata dictionary to update
            new_content: New content string to update (optional)
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Check if the chunk_id exists
                result = conn.execute(
                    "SELECT vector_id FROM metadata WHERE chunk_id = ?",
                    (chunk_id,)
                ).fetchone()
                
                if not result:
                    logger.log_warning(f"No vector found with chunk_id: {chunk_id}")
                    return
                
                # Prepare update fields
                update_fields = []
                update_values = []
                
                if new_metadata:
                    update_fields.append("metadata = ?")
                    update_values.append(json.dumps(new_metadata))
                
                if new_content is not None:
                    update_fields.append("content = ?")
                    update_values.append(new_content)
                
                if not update_fields:
                    logger.log_warning("No updates provided for vector metadata.")
                    return
                
                update_values.append(chunk_id)
                
                # Execute update
                conn.execute(
                    f"UPDATE metadata SET {', '.join(update_fields)} WHERE chunk_id = ?",
                    tuple(update_values)
                )
                
                logger.log_info(f"Updated metadata for chunk_id: {chunk_id}")
                
        except Exception as e:
            logger.log_error(f"Failed to update metadata for chunk_id: {chunk_id}", {"error": str(e)})
            raise

    def get_vector_by_chunk_id(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve vector information based on chunk_id.
        
        Args:
            chunk_id: Unique identifier of the chunk to retrieve
        
        Returns:
            Dictionary containing metadata and content if found, else None
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                result = conn.execute(
                    "SELECT vector_id, metadata, content FROM metadata WHERE chunk_id = ?",
                    (chunk_id,)
                ).fetchone()
                
                if result:
                    vector_id, metadata_json, content = result
                    metadata_dict = json.loads(metadata_json)
                    metadata_dict['content'] = content
                    metadata_dict['vector_id'] = vector_id
                    return metadata_dict
                else:
                    logger.log_warning(f"No vector found with chunk_id: {chunk_id}")
                    return None
                
        except Exception as e:
            logger.log_error(f"Failed to retrieve vector with chunk_id: {chunk_id}", {"error": str(e)})
            raise
