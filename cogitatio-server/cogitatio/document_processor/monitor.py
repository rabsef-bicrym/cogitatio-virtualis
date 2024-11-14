# cogitatio-virtualis/cogitatio-server/cogitatio/document_processor/monitor.py

from watchdog.observers import Observer
from watchdog.observers.api import BaseObserver
from watchdog.events import FileSystemEventHandler
from pathlib import Path
import threading
import time
from threading import Timer
from typing import Dict, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from watchdog.observers.api import BaseObserver

from .config import DOCUMENTS_DIR, IGNORED_PATHS, DEBOUNCE_SECONDS
from cogitatio.utils.logging import ComponentLogger

logger = ComponentLogger("document_monitor")

def should_process_file(file_path: str) -> bool:
    """Check if file should be processed based on path rules"""
    try:
        # rel_path = Path(file_path).relative_to(DOCUMENTS_DIR)
        
        # Check against ignored paths
        for ignored in IGNORED_PATHS:
            if Path(file_path).match(ignored):
                return False
                
        # Must be .md file
        if not file_path.endswith('.md'):
            return False
            
        return True
    except ValueError:
        # Path not relative to DOCUMENTS_DIR
        return False

class DocumentHandler(FileSystemEventHandler):
    def __init__(self, processor: Any):
        self.processor = processor
        self.processing_lock = threading.Lock()
        self.pending_changes: Dict[str, float] = {}
        
    def handle_change(self, event):
        """Debounced change handler"""
        if not should_process_file(event.src_path):
            return
            
        path = event.src_path
        current_time = time.time()
        self.pending_changes[path] = current_time
        
        # Schedule check after debounce period
        Timer(DEBOUNCE_SECONDS, 
              self.process_change, 
              args=[path, current_time]).start()

    def process_change(self, path: str, change_time: float):
        """Process change after debounce period"""
        with self.processing_lock:
            # Only process if this is still the latest change
            if self.pending_changes.get(path) == change_time:
                try:
                    self.processor.process_document(path)
                except Exception as e:
                    logger.log_failure(
                        f"Failed to process document: {path}",
                        {"error": str(e)}
                    )
                finally:
                    # Clean up pending change
                    self.pending_changes.pop(path, None)

    def on_created(self, event):
        """Handle file creation"""
        self.handle_change(event)
    
    def on_modified(self, event):
        """Handle file modification"""
        self.handle_change(event)
    
    def on_deleted(self, event):
        """Handle file deletion"""
        if should_process_file(event.src_path):
            try:
                # Remove document metadata and vectors
                self.processor.remove_document(event.src_path)
                
                # Trigger a reindex after deleting vectors
                logger.log_info(f"Reindexing required after document deletion: {event.src_path}")
                self.processor.reindex_vectors()  # New method to trigger a reindex
                
            except Exception as e:
                logger.log_failure(
                    f"Failed to remove document and reindex: {event.src_path}",
                    {"error": str(e)}
                )

def setup_document_monitor(processor: Any) -> BaseObserver:
    """Initialize and start the document monitor"""
    event_handler = DocumentHandler(processor)
    observer = Observer()
    observer.schedule(event_handler, str(DOCUMENTS_DIR), recursive=True)
    observer.start()
    return observer