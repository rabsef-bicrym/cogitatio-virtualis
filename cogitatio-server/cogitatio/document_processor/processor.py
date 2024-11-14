# server/document_processor/processor.py

import yaml
import uuid
from pathlib import Path
from typing import List, Dict, Tuple
import voyageai
from .config import (
    DOCUMENTS_DIR,
    BATCH_SIZE,
    IGNORED_PATHS,
    validate_paths,
    get_voyage_client_config,
    MAX_TOKENS
)
from cogitatio.types.schemas import DocumentFactory, BaseDocument
from cogitatio.utils.logging import ComponentLogger
from .vector_manager import VectorManager
from fnmatch import fnmatch

logger = ComponentLogger("document_processor")

class DocumentProcessor:
    """
    Core document processing logic for converting markdown documents into vectors.
    Handles parsing, chunking, and embedding generation.
    """
    
    def __init__(self, vector_manager: 'VectorManager'):
        """
        Initialize document processor with required clients.
        
        Args:
            vector_manager: Vector storage manager instance
        """
        try:
            # Get Voyage config and initialize client
            voyage_config = get_voyage_client_config()
            self.embedding_client = voyageai.Client(
                api_key=voyage_config["api_key"]
            )
            self.model = voyage_config["model"]
            
            self.vector_manager = vector_manager
            self.document_map: Dict[str, str] = {}  # path -> doc_id mapping
            
            # Validate paths on startup
            validate_paths()
            logger.log_info("Document processor initialized", {
                "model": self.model,
                "batch_size": BATCH_SIZE,
                "max_tokens": MAX_TOKENS
            })
            
        except Exception as e:
            logger.log_error("Failed to initialize document processor", {"error": str(e)})
            raise

    def process_all_documents(self, force_reprocess: bool = False) -> None:
        """
        Process all markdown documents in the configured directory.
        
        Args:
            force_reprocess: If True, reset vector store before processing
        """
        logger.log_info("Starting batch document processing", {
            "force_reprocess": force_reprocess
        })
        
        if force_reprocess:
            try:
                # Clear existing document mapping when doing full reprocess
                self.document_map.clear()
                # Reset the vector store
                self.vector_manager.reset_store()
                logger.log_info("Vector store reset completed")
            except Exception as e:
                logger.log_error("Failed to reset vector store", {"error": str(e)})
                raise
        
        processed = 0
        errors = 0
        
        try:
            # First, identify all valid markdown files
            markdown_files = [
                path for path in DOCUMENTS_DIR.rglob("*.md")
                if not any(fnmatch(str(path), pattern) for pattern in IGNORED_PATHS)
            ]
            
            # If reprocessing, remove any documents not in the current file set
            if force_reprocess:
                current_paths = {str(path) for path in markdown_files}
                for file_path in list(self.document_map.keys()):
                    if file_path not in current_paths:
                        doc_id = self.document_map.pop(file_path)
                        try:
                            self.vector_manager.remove_document(doc_id)
                            logger.log_info(f"Removed obsolete document: {file_path}")
                        except Exception as e:
                            logger.log_error(f"Failed to remove document: {file_path}", {"error": str(e)})
            
            # Process each markdown file
            for path in markdown_files:
                try:
                    self.process_document(str(path))
                    processed += 1
                except Exception as e:
                    errors += 1
                    logger.log_error(f"Failed to process {path}", {"error": str(e)})
                    
            logger.log_info("Batch processing complete", {
                "processed": processed,
                "errors": errors,
                "total_files": len(markdown_files)
            })
            
        except Exception as e:
            logger.log_error("Failed during batch processing", {"error": str(e)})
            raise

    def process_document(self, file_path: str) -> str:
        """
        Process a single document into vectors.
        
        Args:
            file_path: Path to markdown document
            
        Returns:
            document_id: Unique identifier for the processed document
            
        Raises:
            ValueError: If document format is invalid
            Exception: For embedding or storage errors
        """
        logger.log_info(f"Processing document: {file_path}")
        
        try:
            # Parse document
            content = Path(file_path).read_text()
            document, content = self._parse_document(content, file_path)
            
            # Generate or retrieve document ID
            doc_id = self.document_map.get(file_path, str(uuid.uuid4()))
            
            # Remove existing vectors for this document if it exists
            if file_path in self.document_map:
                try:
                    self.vector_manager.remove_document(doc_id)
                except Exception as e:
                    logger.log_error(f"Failed to remove existing vectors for {file_path}", {"error": str(e)})
            
            # Update document map
            self.document_map[file_path] = doc_id
            
            # Process content into chunks
            chunks = self._prepare_chunks(content, doc_id, document, file_path)
            
            # Process chunks in batches
            self._process_chunks(chunks)
            
            logger.log_info(f"Successfully processed document: {file_path}", {
                "doc_id": doc_id,
                "chunks": len(chunks)
            })
            return doc_id
            
        except Exception as e:
            logger.log_error(f"Failed to process document: {file_path}", 
                           {"error": str(e), "doc_type": self._get_doc_type(file_path)})
            raise

    # [Rest of the methods remain the same as in your current implementation]
    def _parse_document(self, content: str, file_path: str) -> Tuple[BaseDocument, str]:
        """Parse and validate document frontmatter and content."""
        parts = content.split("---", 2)
        if len(parts) < 3:
            raise ValueError(f"Invalid document format in {file_path}")
            
        try:
            # Parse and validate frontmatter
            metadata = yaml.safe_load(parts[1])
            if "type" not in metadata:
                metadata["type"] = self._get_doc_type(file_path)
                
            document = DocumentFactory.create_document(metadata)
            return document, parts[2].strip()
            
        except Exception as e:
            logger.log_error(f"Failed to parse document: {file_path}", 
                           {"error": str(e), "content": parts[1][:100]})
            raise

    def _get_doc_type(self, file_path: str) -> str:
        """Extract document type from path."""
        return Path(file_path).parent.name

    def _split_sections(self, content: str) -> List[str]:
        """Split content into sections by markdown headers."""
        logger.log_info("=== Processing Content ===", {
            "content_preview": content[:100],
            "total_length": len(content)
        })
        
        sections = []
        current_section = []
        
        for line in content.split("\n"):
            if line.startswith("## "):
                # Add the previous section before starting a new one
                if current_section:
                    sections.append("\n".join(current_section))
                # Start new section WITH the header
                current_section = [line]
            else:
                current_section.append(line)
        
        # Don't forget the last section
        if current_section:
            sections.append("\n".join(current_section))
        
        logger.log_info("=== Completed Processing ===", {
            "total_sections": len(sections),
            "section_sizes": [len(s) for s in sections]
        })
        
        return sections if sections else [content]

    def _prepare_chunks(self, 
                    content: str, 
                    doc_id: str, 
                    document: BaseDocument,
                    file_path: str) -> List[Dict]:
        """Prepare document chunks with metadata."""
        sections = self._split_sections(content)
        chunks = []
        
        metadata = document.dict(exclude_none=True)
        
        for idx, section in enumerate(sections):
            chunk = {
                "id": f"{doc_id}_{idx}",
                "text": section,
                "metadata": {
                    "doc_id": doc_id,
                    "chunk_index": idx,
                    "total_chunks": len(sections),
                    "source_file": file_path,
                    "chunk_text": section,  # Store just this chunk's text
                    **metadata
                }
            }
            chunks.append(chunk)
        
        return chunks

    def _process_chunks(self, chunks: List[Dict]) -> None:
        """Generate embeddings for chunks and store them."""
        for i in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[i:i + BATCH_SIZE]
            
            try:
                # Generate embeddings
                texts = [chunk["text"] for chunk in batch]
                embeddings_response = self.embedding_client.embed(
                    texts,
                    model=self.model,
                    input_type="document"
                )
                
                # Prepare vectors for storage
                vectors = []
                for chunk, embedding in zip(batch, embeddings_response.embeddings):
                    vectors.append({
                        "id": chunk["id"],
                        "values": embedding,
                        "metadata": chunk["metadata"]
                    })
                
                # Store vectors
                self.vector_manager.store_vectors(vectors)
                
                logger.log_info(f"Processed chunk batch", {
                    "batch_size": len(batch),
                    "start_chunk": i
                })
                
            except Exception as e:
                logger.log_error(
                    "Failed to process chunk batch",
                    {
                        "error": str(e),
                        "chunk_ids": [c["id"] for c in batch],
                        "batch_size": len(batch)
                    }
                )
                raise