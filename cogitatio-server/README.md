# COGITATIO VIRTUALIS - Cogitatio Server

Backend server component for Cogitatio Virtualis, providing vector search and document processing capabilities.

## Project Status
- **(✓_✓) Vector Store**
  - FAISS integration
  - SQLite metadata storage
  - Safe index management

- **(✓_✓) Document Processing**
  - File watching
  - Markdown parsing
  - Vector generation
  - Metadata extraction
  - Type validation

- **(✓_✓) API Layer**
  - FastAPI routes
  - Document endpoints
  - Search implementation
  - Response optimization

- **(✗_✗) Testing**
  - Manual Testing Complete
  - TODO: Automated testing suite

## Quick Start

### Prerequisites with Conda
1. Install `miniconda` (https://docs.anaconda.com/miniconda/install/#quick-command-line-install)
2. Create a conda environment using the included `conda_env.yml` file
  - We suggest you call it `cv_env`
  - If you do not, you will need to change the `cogitatio.service` file to reflect your correct environment's name
3. Navigate to the project's root directory (`cogitatio-server`)

### Installation
```bash
# Install package in editable mode with development dependencies 
pip install -e .
```

### Running the Server

Start both API server and document watcher:
```bash
python -m cogitatio-server.scripts.start_server
```

Start API server only:
```bash
python -m cogitatio-server.scripts.start_server --api-only
```

Start document processor watcher only:
```bash
python -m cogitatio-server.scripts.start_server --processor-only --watch-only
```

Trigger a full reprocessing of all documents:
```bash
python -m cogitatio-server.scripts.start_server --reprocess-all
```

### Environment Configuration
Copy `.env.example` to `.env` and configure:
```bash
COGITATIO_ENV=development
VOYAGE_MODEL=voyage-3
VOYAGE_API_KEY=your_key_here
DATA_DIR=./data
DOCUMENTS_DIR=./documents
COGITATIO_LOG_PATH=./logs
HOST=127.0.0.1
PORT=8000
```

### Automatic Startup
Copy the `cogitatio.service` to the appropriate `systemd` directory
```bash
sudo cp ./cogitatio.service /etc/systemd/system/cogitatio.service
```
Then, perform the following commands to reload `systemd`, start the service on boot, and start it immediately, then check its status:
```bash
sudo systemctl daemon-reload
sudo systemctl enable cogitatio.service
sudo systemctl start cogitatio.service
sudo systemctl status cogitatio.service
```

To stop the service:
```bash
sudo systemctl stop cogitatio.service
```

To disable the service:
```bash
sudo systemctl disable cogitatio.service
```

To examine the running service:
```bash
sudo journalctl -fu cogitatio.service
```

## Project Structure
```
cogitatio-server/
├── pyproject.toml
├── requirements.txt
├── scripts/
│   ├── start_server.py
│   └── db_tools/
│       ├── db_explorer.py
│       └── vector_visualizer.py
└── cogitatio/
    ├── api/
    │   └── routes.py
    ├── document_processor/
    │   ├── config.py
    │   ├── document_store.py
    │   ├── processor.py
    │   ├── monitor.py
    │   └── vector_manager.py
    ├── types/
    │   └── schemas.py
    └── utils/
        └── logging.py
```

## Features

### Document Processing
- Real-time document monitoring
- Markdown and YAML frontmatter parsing
- Automatic vector embedding generation
- Document chunking and metadata extraction
- Type validation and schema enforcement

### Vector Store
- FAISS vector index management
- SQLite metadata database
- Atomic write operations
- Automatic backup system
- Safe index updates

### API Endpoints
```
GET  /health              - Health check
GET  /stats              - Database statistics
GET  /documents/{doc_id} - Get document by ID
POST /search             - Vector search
```

### Search Capabilities
- Similarity search
- Semantic search
- HyDE (Hypothetical Document Embeddings)
- Metadata filtering
- Document reconstruction

## Development Tools

### Database Explorer
View and analyze the vector database:
```bash
python -m cogitatio.scripts.db_tools.db_explorer --data-dir ./data
```

Commands:
```bash
stats                    - Show database statistics
doc <doc_id>            - Search by document ID
similar <vector_id>     - Find similar vectors
type <doc_type>         - Search by document type
```

### Vector Visualizer
Visualize the vector space:
```bash
python -m cogitatio.scripts.db_tools.vector_visualizer
```

Features:
- 2D/3D visualization
- Interactive clustering
- Color coding by document type
- Real-time updates
- Dimension reduction view

## Error Handling
- Automatic index recovery
- Safe write operations
- Backup management
- Structured logging
- Operation tracking

## Performance
- Batch vector processing
- Connection pooling
- Query optimization
- Efficient chunking
- Atomic operations

## Document Types
```python
EXPERIENCE       # Professional experience
EDUCATION       # Educational background
PROJECT         # Project documentation
OTHER           # Additional document types
```

## Configuration

### Document Processing
```python
VECTOR_DIMENSION = 1024  # Embedding dimension
BATCH_SIZE = 100        # Vectors per batch
MAX_TOKENS = 32000      # Context length
```

### File Watching
```python
DEBOUNCE_SECONDS = 1.0  # File change debounce
IGNORED_PATHS = {       # Ignored patterns
    '*/templates/*',
    '*/.git/*',
    '*/node_modules/*'
}
```
