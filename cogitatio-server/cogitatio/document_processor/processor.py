# cogitatio-virtualis/cogitatio-server/cogitatio/document_processor/processor.py

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
            logger.log_info("Initializing DocumentProcessor")
            
            # Get Voyage config and initialize client
            voyage_config = get_voyage_client_config()
            logger.log_info("Loaded VoyageAI configuration", {
                "model": voyage_config.get("model"),
                "api_key_present": bool(voyage_config.get("api_key"))
            })
            
            self.embedding_client = voyageai.Client(
                api_key=voyage_config["api_key"]
            )
            self.model = voyage_config["model"]
            
            self.vector_manager = vector_manager
            self.document_map: Dict[str, str] = {}  # path -> doc_id mapping
            
            # Validate paths on startup
            validate_paths()
            logger.log_info("DocumentProcessor initialized successfully", {
                "model": self.model,
                "batch_size": BATCH_SIZE,
                "max_tokens": MAX_TOKENS
            })
            
        except Exception as e:
            logger.log_error("Failed to initialize DocumentProcessor", {"error": str(e)})
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
                logger.log_info("Force reprocess requested. Resetting vector store and clearing document map.")
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
            # Identify all valid markdown files
            markdown_files = [
                path for path in DOCUMENTS_DIR.rglob("*.md")
                if not any(fnmatch(str(path), pattern) for pattern in IGNORED_PATHS)
            ]
            logger.log_info("Found markdown files", {
                "total_files": len(markdown_files),
                "ignored_patterns": IGNORED_PATHS
            })
            
            # Handle obsolete documents during reprocess
            if force_reprocess:
                current_paths = {str(path) for path in markdown_files}
                for file_path in list(self.document_map.keys()):
                    if file_path not in current_paths:
                        doc_id = self.document_map.pop(file_path)
                        try:
                            self.vector_manager.remove_document(doc_id)
                            logger.log_info("Removed obsolete document", {"file_path": file_path})
                        except Exception as e:
                            logger.log_error("Failed to remove obsolete document", {
                                "file_path": file_path, "error": str(e)
                            })
            
            # Process each markdown file
            for path in markdown_files:
                try:
                    logger.log_info("Processing individual document", {"file_path": str(path)})
                    self.process_document(str(path))
                    processed += 1
                except Exception as e:
                    errors += 1
                    logger.log_error("Failed to process document", {
                        "file_path": str(path), "error": str(e)
                    })
                    
            logger.log_info("Batch processing complete", {
                "processed": processed,
                "errors": errors,
                "total_files": len(markdown_files)
            })
            
        except Exception as e:
            logger.log_error("Error during batch document processing", {"error": str(e)})
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
        logger.log_info("Processing document", {"file_path": file_path})
        
        try:
            # Parse document
            content = Path(file_path).read_text()
            if not content:
                logger.log_error("File is empty or unreadable", {"file_path": file_path})
                raise ValueError("File content is empty")
            
            document, content = self._parse_document(content, file_path)
            
            # Generate or retrieve document ID
            doc_id = self.document_map.get(file_path, str(uuid.uuid4()))
            
            # Remove existing vectors for this document if it exists
            if file_path in self.document_map:
                try:
                    self.vector_manager.remove_document(doc_id)
                    logger.log_info("Removed existing vectors for document", {"file_path": file_path})
                except Exception as e:
                    logger.log_error("Failed to remove existing vectors", {
                        "file_path": file_path, "error": str(e)
                    })
            
            # Update document map
            self.document_map[file_path] = doc_id
            logger.log_info("Document map updated", {"file_path": file_path, "doc_id": doc_id})
            
            # Process content into chunks
            chunks = self._prepare_chunks(content, doc_id, document, file_path)
            
            # Process chunks in batches
            self._process_chunks(chunks)
            
            logger.log_info("Successfully processed document", {
                "file_path": file_path, "doc_id": doc_id, "chunks": len(chunks)
            })
            return doc_id
            
        except Exception as e:
            logger.log_error("Failed to process document", {
                "file_path": file_path, "error": str(e), "doc_type": self._get_doc_type(file_path)
            })
            raise

    def _parse_document(self, content: str, file_path: str) -> Tuple[BaseDocument, str]:
        """Parse and validate document frontmatter and content."""
        logger.log_info("Parsing document", {"file_path": file_path})
        parts = content.split("---", 2)
        if len(parts) < 3:
            logger.log_error("Invalid document format", {"file_path": file_path})
            raise ValueError(f"Invalid document format in {file_path}")
            
        try:
            metadata = yaml.safe_load(parts[1])
            if "type" not in metadata:
                metadata["type"] = self._get_doc_type(file_path)
                
            document = DocumentFactory.create_document(metadata)
            logger.log_info("Parsed document metadata", {
                "file_path": file_path, "metadata": metadata
            })
            return document, parts[2].strip()
            
        except Exception as e:
            logger.log_error("Failed to parse document metadata", {
                "file_path": file_path, "error": str(e), "frontmatter": parts[1][:100]
            })
            raise

    def _get_doc_type(self, file_path: str) -> str:
        """Extract document type from path."""
        doc_type = Path(file_path).parent.name
        logger.log_info("Determined document type", {"file_path": file_path, "doc_type": doc_type})
        return doc_type

    def _split_sections(self, content: str) -> List[str]:
        """Split content into sections by markdown headers."""
        logger.log_info("Splitting content into sections", {
            "content_preview": content[:100],
            "total_length": len(content)
        })
        
        sections = []
        current_section = []

        for line in content.splitlines():  # Split by lines, not just '\n'
            logger.log_info("line: %r", line)  # Log each line for debugging
            line = line.strip()  # Remove leading/trailing whitespace
            if line.startswith("## "):
                if current_section:
                    sections.append("\n".join(current_section))
                current_section = [line]
            else:
                current_section.append(line)
        
        if current_section:
            sections.append("\n".join(current_section))
        
        logger.log_info("Completed splitting sections", {
            "total_sections": len(sections),
            "section_sizes": [len(s) for s in sections]
        })
        return sections if sections else [content]


    def _prepare_chunks(self, content: str, doc_id: str, document: BaseDocument, file_path: str) -> List[Dict]:
        """Prepare document chunks with metadata."""
        logger.log_info("Preparing chunks for document", {
            "file_path": file_path, "doc_id": doc_id
        })
        sections = self._split_sections(content)
        chunks = []
        metadata = document.dict(exclude_none=True)
        
        for idx, section in enumerate(sections):
            chunk_id = f"{doc_id}_{idx}"  # Unique chunk_id based on doc_id and chunk index
            chunk = {
                "id": doc_id,  # 'id' corresponds to the document ID
                "chunk_id": chunk_id,  # Unique identifier for the chunk
                "content": section,
                "metadata": {
                    "doc_id": doc_id,
                    "chunk_id": chunk_id,  # Include chunk_id in metadata if needed
                    "chunk_index": idx,
                    "total_chunks": len(sections),
                    "source_file": file_path,
                    **metadata
                }
            }
            chunks.append(chunk)
            logger.log_info("Prepared chunk", {
                "chunk_id": chunk_id, "content_preview": section[:100]
            })
        
        logger.log_info("All chunks prepared", {
            "total_chunks": len(chunks), "file_path": file_path
        })
        return chunks

    def _process_chunks(self, chunks: List[Dict]) -> None:
        """Generate embeddings for chunks and store them."""
        logger.log_info("Starting chunk processing", {
            "total_chunks": len(chunks)
        })
        for i in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[i:i + BATCH_SIZE]
            try:
                texts = [chunk["content"] for chunk in batch]
                embeddings_response = self.embedding_client.embed(
                    texts,
                    model=self.model,
                    input_type="document"
                )
                
                vectors = []
                for chunk, embedding in zip(batch, embeddings_response.embeddings):
                    vectors.append({
                        "id": chunk["id"],  # Document ID
                        "chunk_id": chunk["chunk_id"],  # Unique Chunk ID
                        "values": embedding,
                        "metadata": chunk["metadata"],
                        "content": chunk["content"]
                    })
                
                self.vector_manager.store_vectors(vectors)
                logger.log_info("Processed chunk batch", {
                    "batch_size": len(batch), "start_index": i
                })
                
            except Exception as e:
                logger.log_error("Failed to process chunk batch", {
                    "error": str(e), "batch_size": len(batch)
                })
                raise
