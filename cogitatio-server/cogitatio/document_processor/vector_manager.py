# server/document_processor/vector_manager.py

import os
import faiss
import numpy as np
import tempfile
import json
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
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
        
        logger.log_info("Vector store initialized", {
            "dimension": dimension,
            "total_vectors": self.index.ntotal,
            "data_dir": str(self.data_dir)
        })

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
        index = faiss.IndexFlatL2(self.dimension)
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
                    metadata TEXT NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_doc_id ON metadata(doc_id)")

    def store_vectors(self, vectors: List[Dict[str, Any]]) -> None:
        """
        Store vectors and their metadata with automatic backup.
        
        Args:
            vectors: List of dicts containing:
                - 'id': Unique identifier
                - 'values': Vector values as numpy array
                - 'metadata': Dict of metadata
        """
        try:
            # Prepare vectors for FAISS
            vector_data = np.array([v['values'] for v in vectors]).astype('float32')
            
            # Add to FAISS
            start_idx = self.index.ntotal
            self.index.add(vector_data)
            
            # Store metadata
            with sqlite3.connect(self.db_path) as conn:
                for i, vec in enumerate(vectors):
                    vector_id = start_idx + i
                    conn.execute(
                        "INSERT OR REPLACE INTO metadata (vector_id, doc_id, metadata) VALUES (?, ?, ?)",
                        (vector_id, vec['id'], json.dumps(vec['metadata']))
                    )
            
            # Save index after successful update
            self._save_index()
            
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
            
            # Search index
            distances, indices = self.index.search(query_vector, k)
            
            # Get metadata for results
            metadata_list = []
            with sqlite3.connect(self.db_path) as conn:
                for idx in indices[0]:
                    if idx != -1:  # -1 indicates no match found
                        result = conn.execute(
                            "SELECT metadata FROM metadata WHERE vector_id = ?",
                            (int(idx),)
                        ).fetchone()
                        if result:
                            metadata_list.append(json.loads(result[0]))
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
            # Get vectors to remove
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "SELECT vector_id FROM metadata WHERE doc_id LIKE ?",
                    (f"{doc_id}%",)
                )
                vector_ids = [row[0] for row in cursor.fetchall()]
                
                if not vector_ids:
                    logger.log_warning(f"No vectors found for document: {doc_id}")
                    return
                
                # Create mask for kept vectors
                kept_vectors = np.ones(self.index.ntotal, dtype=bool)
                kept_vectors[vector_ids] = False
                
                # Create new index with kept vectors
                new_index = faiss.IndexFlatL2(self.dimension)
                vectors_to_keep = [self.index.reconstruct(i) for i in range(self.index.ntotal) 
                                 if i not in vector_ids]
                
                if vectors_to_keep:
                    vectors_array = np.array(vectors_to_keep).astype('float32')
                    new_index.add(vectors_array)
                
                # Remove metadata
                conn.execute("DELETE FROM metadata WHERE doc_id LIKE ?", (f"{doc_id}%",))
                
                # Swap indices
                self.index = new_index
                self._save_index()
                
                logger.log_info(f"Removed vectors for document: {doc_id}", {
                    "vectors_removed": len(vector_ids),
                    "total_vectors": self.index.ntotal
                })
                
        except Exception as e:
            logger.log_error(f"Failed to remove document: {doc_id}", {"error": str(e)})
            raise

    def _save_index(self) -> None:
        """Safely save the FAISS index with backup."""
        try:
            # Create backup of current index if it exists
            if self.index_path.exists():
                self.index_path.rename(self.backup_path)
            
            # Save new index
            faiss.write_index(self.index, str(self.index_path))
            
            # Remove backup if save successful
            if self.backup_path.exists():
                self.backup_path.unlink()
                
        except Exception as e:
            logger.log_error("Failed to save index", {"error": str(e)})
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
            new_index = faiss.IndexFlatL2(self.dimension)
            
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