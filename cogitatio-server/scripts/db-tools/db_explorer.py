import argparse
import sys
from pathlib import Path
import numpy as np
import faiss
import sqlite3
import json
from typing import List, Dict, Any, Optional
from tabulate import tabulate
from cogitatio.utils.logging import ComponentLogger
from cogitatio.document_processor import config  # Import your config module

logger = ComponentLogger("db_explorer")

class DatabaseExplorer:
    def __init__(self, data_dir: Optional[Path] = None):
        # Use data directory from config if not provided
        if data_dir is None:
            data_dir = config.DATA_DIR

        self.data_dir = Path(data_dir)
        self.index_path = self.data_dir / "vectors.index"
        self.db_path = self.data_dir / "metadata.db"
        
        # Load FAISS index
        if self.index_path.exists():
            self.index = faiss.read_index(str(self.index_path))
        else:
            raise FileNotFoundError(f"No FAISS index found at {self.index_path}")
            
    def get_metadata_by_doc_id(self, doc_id: str) -> List[Dict]:
        """Get all metadata entries for a document ID"""
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT vector_id, metadata FROM metadata WHERE doc_id LIKE ?",
                (f"%{doc_id}%",)
            ).fetchall()
                
        return [
            {
                "vector_id": row[0],
                **json.loads(row[1])
            }
            for row in rows
        ]
    
    def search_vectors(self, vector_id: int, k: int = 5) -> List[Dict]:
        """Find k nearest neighbors to a given vector"""
        # Get the vector
        vector = self.index.reconstruct(vector_id)
        
        # Search for similar vectors
        D, I = self.index.search(vector.reshape(1, -1), k)
        
        # Get metadata for results
        results = []
        with sqlite3.connect(self.db_path) as conn:
            for dist, idx in zip(D[0], I[0]):
                meta = conn.execute(
                    "SELECT metadata FROM metadata WHERE vector_id = ?",
                    (int(idx),)
                ).fetchone()
                    
                if meta:
                    results.append({
                        "vector_id": int(idx),
                        "distance": float(dist),
                        **json.loads(meta[0])
                    })
        
        return results
    
    def search_by_content_type(self, doc_type: str) -> List[Dict]:
        """Find all documents of a specific type"""
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT vector_id, doc_id, metadata FROM metadata WHERE json_extract(metadata, '$.type') = ?",
                (doc_type,)
            ).fetchall()
                
        return [
            {
                "vector_id": row[0],
                "doc_id": row[1],
                **json.loads(row[2])
            }
            for row in rows
        ]
    
    def get_database_stats(self) -> Dict[str, Any]:
        """Get comprehensive database statistics"""
        stats = {
            "faiss_index": {
                "total_vectors": self.index.ntotal,
                "dimension": self.index.d,
                "index_size_mb": self.index_path.stat().st_size / (1024 * 1024)
            }
        }
        
        with sqlite3.connect(self.db_path) as conn:
            # Get document counts by type (using real doc_id)
            type_counts = conn.execute("""
                SELECT 
                    json_extract(metadata, '$.type') as doc_type,
                    COUNT(DISTINCT json_extract(metadata, '$.doc_id')) as doc_count,
                    COUNT(*) as chunk_count
                FROM metadata
                GROUP BY doc_type
            """).fetchall()
                
            # Get total unique documents
            total_docs = conn.execute("""
                SELECT COUNT(DISTINCT json_extract(metadata, '$.doc_id'))
                FROM metadata
            """).fetchone()[0]
                
            # Get average chunks per document
            chunks_per_doc = self.index.ntotal / total_docs if total_docs > 0 else 0
                
            stats["documents"] = {
                "total_unique_documents": total_docs,
                "total_chunks": self.index.ntotal,
                "average_chunks_per_document": round(chunks_per_doc, 2),
                "by_type": {
                    doc_type: {
                        "documents": doc_count,
                        "chunks": chunk_count,
                        "avg_chunks": round(chunk_count / doc_count, 2) if doc_count > 0 else 0
                    }
                    for doc_type, doc_count, chunk_count in type_counts
                }
            }
        
        return stats

    def get_random_vector(self) -> Dict[str, Any]:
        """Retrieve a random vector, its metadata, and the associated text."""
        with sqlite3.connect(self.db_path) as conn:
            # Get a random vector_id and its metadata from the database
            row = conn.execute("""
                SELECT vector_id, content, metadata 
                FROM metadata 
                ORDER BY RANDOM() 
                LIMIT 1
            """).fetchone()

            if not row:
                raise ValueError("No vectors found in the database.")
            
            vector_id = row[0]
            raw_content = row[1]
            metadata = json.loads(row[2])

            # Assign "No text available" if content is None or empty
            content = raw_content if raw_content else "No text available"
        
        return {
            "vector_id": vector_id,
            "metadata": metadata,
            "text": content  # Include the associated text
        }


def format_results(results: List[Dict], format_type: str = 'table') -> str:
    """Format results for display"""
    if not results:
        return "No results found."
        
    if format_type == 'json':
        return json.dumps(results, indent=2)
        
    # For table format, flatten the first result to get columns
    columns = []
    first_item = results[0]
    for key, value in first_item.items():
        if isinstance(value, (dict, list)):
            # Flatten complex values
            columns.append(key)
        else:
            columns.append(key)
    
    # Prepare rows
    rows = []
    for item in results:
        row = []
        for col in columns:
            value = item.get(col)
            if isinstance(value, (dict, list)):
                row.append(str(value))
            else:
                row.append(value)
        rows.append(row)
    
    return tabulate(rows, headers=columns, tablefmt="grid")

def main():
    parser = argparse.ArgumentParser(description='Database Explorer for FAISS/SQLite Vector Store')
    
    # Remove the data-dir argument since we'll use config.py
    # parser.add_argument('--data-dir', default='./data', help='Directory containing database files')
    
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Stats command
    subparsers.add_parser('stats', help='Show database statistics')
    
    # Document search
    doc_parser = subparsers.add_parser('doc', help='Search by document ID')
    doc_parser.add_argument('doc_id', help='Document ID to search for')
    
    # Vector similarity search
    vec_parser = subparsers.add_parser('similar', help='Find similar vectors')
    vec_parser.add_argument('vector_id', type=int, help='Vector ID to search from')
    vec_parser.add_argument('--k', type=int, default=5, help='Number of similar vectors to return')
    
    # Type search
    type_parser = subparsers.add_parser('type', help='Search by document type')
    type_parser.add_argument('doc_type', help='Document type to search for')
    
    # Random vector retrieval
    subparsers.add_parser('random', help='Retrieve a random vector with its metadata and text')
    
    # Format option for all commands
    parser.add_argument('--format', choices=['table', 'json'], default='table',
                       help='Output format')
    
    args = parser.parse_args()
    
    try:
        explorer = DatabaseExplorer()
        
        if args.command == 'stats':
            stats = explorer.get_database_stats()
            print(format_results([stats], args.format))
                
        elif args.command == 'doc':
            results = explorer.get_metadata_by_doc_id(args.doc_id)
            print(format_results(results, args.format))
                
        elif args.command == 'similar':
            results = explorer.search_vectors(args.vector_id, args.k)
            print(format_results(results, args.format))
                
        elif args.command == 'type':
            results = explorer.search_by_content_type(args.doc_type)
            print(format_results(results, args.format))
                
        elif args.command == 'random':
            result = explorer.get_random_vector()
            print(json.dumps(result, indent=2))
                
        else:
            parser.print_help()
                
    except Exception as e:
        logger.log_error(f"Error during database exploration: {e}")
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
