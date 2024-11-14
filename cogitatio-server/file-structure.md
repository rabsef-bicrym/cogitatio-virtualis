cogitatio-virtualis/                  # Monorepo root
├── README.md                         # Main project documentation
├── .gitignore                   
├── cogitatio-terminal/               # Next.js frontend (existing, unchanged)
│   └── ... (existing files)
└── cogitatio-server/                 # Renamed from 'server'
    ├── pyproject.toml                # NEW: Package configuration
    ├── requirements.txt              # MOVED: Dependencies
    ├── .env                          # MOVED: Combined environment file
    ├── .env.example                  # MOVED: Combined example environment
    ├── README.md                     # NEW: Backend documentation
    ├── scripts/                      # NEW: Directory for executable scripts
    │   ├── __init__.py
    │   ├── start_server.py           # MOVED/MODIFIED: Main entry script
    │   └── db_tools/
    │       ├── __init__.py
    │       ├── db_explorer.py        # MOVED: From tools/
    │       └── vector_visualizer.py  # MOVED: From tools/
    └── cogitatio/                    # NEW: Main package (replaces server/)
        ├── __init__.py               # NEW: Package marker
        ├── api/
        │   ├── __init__.py           # NEW: Package marker
        │   └── routes.py             # MOVED: From server/api/
        ├── document_processor/
        │   ├── __init__.py           # NEW: Package marker
        │   ├── config.py             # MOVED: From server/document_processor/
        │   ├── document_store.py
        │   ├── main.py
        │   ├── monitor.py
        │   ├── processor.py
        │   └── vector_manager.py
        ├── types/
        │   ├── __init__.py           # NEW: Package marker
        │   └── schemas.py            # MOVED: From server/types/
        └── utils/
            ├── __init__.py           # NEW: Package marker
            └── logging.py            # MOVED: From server/utils/