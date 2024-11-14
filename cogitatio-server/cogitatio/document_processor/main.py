# cogitatio-virtualis/cogitatio-server/cogitatio/document_processor/main.py

import sys
import time
import argparse
from pathlib import Path
from typing import Optional

from .monitor import setup_document_monitor
from .processor import DocumentProcessor
from .vector_manager import VectorManager
from cogitatio.utils.logging import ComponentLogger
from .config import VECTOR_DIMENSION

logger = ComponentLogger("main")

def parse_arguments() -> argparse.Namespace:
    """Parse and validate command line arguments."""
    parser = argparse.ArgumentParser(
        description='Document Processing Service',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    # Processing control
    parser.add_argument(
        '--reprocess-all',
        action='store_true',
        help='Reset vector store and reprocess all documents'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Validate and process documents without storing vectors'
    )
    
    # Monitoring control
    parser.add_argument(
        '--no-watch',
        action='store_true',
        help='Disable file watching'
    )
    parser.add_argument(
        '--watch-only',
        action='store_true',
        help='Only watch for changes (skip initial processing)'
    )
    
    args = parser.parse_args()
    
    # Validate argument combinations
    if args.watch_only and args.no_watch:
        parser.error("Cannot specify both --watch-only and --no-watch")
    
    return args

def initialize_services(dry_run: bool = False) -> tuple[Optional[VectorManager], Optional[DocumentProcessor]]:
    """Initialize core services with proper error handling."""
    vector_manager = None
    processor = None
    
    try:
        if not dry_run:
            vector_manager = VectorManager(dimension=VECTOR_DIMENSION)
            logger.log_info("Vector manager initialized successfully")
        
        processor = DocumentProcessor(vector_manager)
        logger.log_info("Document processor initialized successfully")
        
        return vector_manager, processor
        
    except Exception as e:
        logger.log_error("Failed to initialize services", {"error": str(e)})
        # Clean up any partially initialized services
        if vector_manager:
            del vector_manager
        if processor:
            del processor
        raise

def run_document_monitor(processor: DocumentProcessor) -> None:
    """Run the document monitor with proper cleanup."""
    observer = None
    try:
        observer = setup_document_monitor(processor)
        logger.log_info("Document monitor started successfully")
        
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        logger.log_info("Received shutdown signal")
    except Exception as e:
        logger.log_error("Error in document monitor", {"error": str(e)})
        raise
    finally:
        if observer:
            observer.stop()
            observer.join()
            logger.log_info("Document monitor shutdown complete")

def main() -> int:
    """Main entry point with proper error handling and cleanup."""
    try:
        args = parse_arguments()
        
        # Initialize core services
        vector_manager, processor = initialize_services(dry_run=args.dry_run)
        if not processor:
            logger.log_error("Failed to initialize document processor")
            return 1
        
        # Initial document processing
        if not args.watch_only:
            logger.log_info("Starting initial document processing", {
                "reprocess_all": args.reprocess_all,
                "dry_run": args.dry_run
            })
            
            try:
                processor.process_all_documents(force_reprocess=args.reprocess_all)
            except Exception as e:
                logger.log_error("Failed during initial processing", {"error": str(e)})
                return 1
        
        # File watching
        if not args.no_watch:
            try:
                run_document_monitor(processor)
            except Exception as e:
                logger.log_error("Failed during file monitoring", {"error": str(e)})
                return 1
        
        return 0
        
    except Exception as e:
        logger.log_error("Fatal error in main process", {"error": str(e)})
        return 1
    finally:
        logger.log_info("Document processing service shutdown complete")

if __name__ == "__main__":
    sys.exit(main())