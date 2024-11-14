# cogitatio-virtualis/cogitatio-server/cogitatio/document_processor/config.py

from pathlib import Path
import os
from dotenv import load_dotenv
from typing import Optional

# Load environment variables
load_dotenv()

# Required API Configuration
VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY")
if not VOYAGE_API_KEY:
    raise ValueError("VOYAGE_API_KEY environment variable is required")

VOYAGE_MODEL = os.getenv("VOYAGE_MODEL")
if not VOYAGE_MODEL:
    raise ValueError("VOYAGE_MODEL environment variable is required")

# Base paths
PROJECT_ROOT = Path(__file__).parent.parent.parent  # Up to cogitatio-virtualis/
BASE_DIR = PROJECT_ROOT / 'documents'
DOCUMENTS_DIR = BASE_DIR

# Data directory configuration
DEFAULT_DATA_DIR = PROJECT_ROOT / 'data'
DATA_DIR = Path(os.getenv('DATA_DIR', str(DEFAULT_DATA_DIR)))

def validate_paths() -> bool:
    """Validate and create required paths"""
    paths = {
        'data': DATA_DIR,
        'vectors': DATA_DIR / 'vectors',
        'metadata': DATA_DIR / 'metadata',
        'documents': DOCUMENTS_DIR,
    }
    
    for name, path in paths.items():
        try:
            path.mkdir(parents=True, exist_ok=True)
            # Test writeability
            test_file = path / '.write_test'
            test_file.touch()
            test_file.unlink()
        except Exception as e:
            raise RuntimeError(f"Cannot write to {name} directory at {path}: {str(e)}")
    
    return True

def get_voyage_client_config() -> dict:
    """Get Voyage API configuration, fail fast if missing"""
    return {
        "api_key": VOYAGE_API_KEY,
        "model": VOYAGE_MODEL
    }

# Document Processing
IGNORED_PATHS = {
    '*/templates/*',     # Match any path that includes /templates/
    '*/.git/*',          # Match any path that includes /.git/
    '*/node_modules/*',
    '*/__pycache__/*',
    '*.swp',
    '*.tmp'
}

# File watching
DEBOUNCE_SECONDS = 1.0  # Seconds to wait before processing file changes

# Vector & Embedding Configuration
VECTOR_DIMENSION = 1024  # embedding dimension
BATCH_SIZE = 100        # Number of vectors to upload at once
MAX_TOKENS = 32000      # voyage-3 context length