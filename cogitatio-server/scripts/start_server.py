#!/usr/bin/env python3
# cogitatio-virtualis/cogitatio-server/cogitatio/scripts/start_server.py

import subprocess
import sys
import os
import signal
import time
import argparse
from pathlib import Path
from typing import List, Optional
from cogitatio.utils.logging import ComponentLogger

logger = ComponentLogger("server_manager")

class ServiceManager:
    """
    Manages the lifecycle of Cogitatio server processes.
    Handles graceful startup, monitoring, and shutdown of services.
    """
    
    def __init__(self):
        self.processes: List[subprocess.Popen] = []
        self.setup_signal_handlers()

    def setup_signal_handlers(self):
        """Configure signal handlers for graceful shutdown"""
        signal.signal(signal.SIGINT, self.handle_shutdown)
        signal.signal(signal.SIGTERM, self.handle_shutdown)

    def handle_shutdown(self, signum, frame):
        """Handle graceful shutdown of all services"""
        logger.log_info("Initiating graceful shutdown of services")
        for process in self.processes:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    logger.log_warning("Process did not terminate gracefully, forcing kill")
                    process.kill()
        logger.log_info("All services shut down successfully")
        sys.exit(0)

    def start_document_processor(self, args: argparse.Namespace) -> Optional[subprocess.Popen]:
        """
        Start the document processor service with specified arguments.
        
        Args:
            args: Command line arguments including processing options
        """
        cmd = [
            sys.executable,
            "-m",
            "cogitatio.document_processor.main"
        ]
        
        # Add optional flags based on arguments
        if args.reprocess_all:
            cmd.append("--reprocess-all")
        if args.dry_run:
            cmd.append("--dry-run")
        if args.watch_only:
            cmd.append("--watch-only")
        if args.no_watch:
            cmd.append("--no-watch")
        
        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            self.processes.append(process)
            logger.log_info("Started document processor", {
                "pid": process.pid,
                "command": " ".join(cmd)
            })
            return process
        except Exception as e:
            logger.log_error("Failed to start document processor", {"error": str(e)})
            return None

    def start_api_server(self, args: argparse.Namespace) -> Optional[subprocess.Popen]:
        """
        Start the FastAPI server with specified configuration using gunicorn.
        
        Args:
            args: Command line arguments including server options
        """
        host = os.getenv("HOST", "127.0.0.1")
        port = os.getenv("PORT", "8000")
        workers = os.getenv("WORKERS", "1")
        debug = os.getenv("DEBUG", "false").lower() == "true"
        
        cmd = [
            sys.executable,
            "-m",
            "gunicorn",
            "cogitatio.api.routes:app",
            "--bind", f"{host}:{port}",
            "--workers", workers,
            "--worker-class", "uvicorn.workers.UvicornWorker"
        ]
        if debug:
            cmd.append("--reload")
        
        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            self.processes.append(process)
            logger.log_info("Started API server", {
                "pid": process.pid,
                "host": host,
                "port": port,
                "workers": workers,
                "debug": debug
            })
            return process
        except Exception as e:
            logger.log_error("Failed to start API server", {"error": str(e)})
            return None

    def print_process_output(self, process: subprocess.Popen, prefix: str):
        """Print process output with prefix for identification"""
        def print_stream(stream, prefix):
            for line in stream:
                if line.strip():
                    logger.log_info(f"{prefix}: {line.strip()}")

        import threading
        stdout_thread = threading.Thread(
            target=print_stream, 
            args=(process.stdout, f"{prefix} OUT"),
            daemon=True
        )
        stderr_thread = threading.Thread(
            target=print_stream, 
            args=(process.stderr, f"{prefix} ERR"),
            daemon=True
        )
        
        stdout_thread.start()
        stderr_thread.start()

    def monitor_processes(self):
        """Monitor running processes and handle failures"""
        while True:
            time.sleep(1)
            for process in self.processes:
                if process.poll() is not None:
                    exit_code = process.poll()
                    logger.log_error("Service terminated unexpectedly", {
                        "pid": process.pid,
                        "exit_code": exit_code
                    })
                    self.handle_shutdown(None, None)

def parse_arguments() -> argparse.Namespace:
    """Parse and validate command line arguments"""
    parser = argparse.ArgumentParser(
        description='Start Cogitatio Virtualis services',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    # Service control
    parser.add_argument(
        '--api-only',
        action='store_true',
        help='Start only the API server'
    )
    parser.add_argument(
        '--processor-only',
        action='store_true',
        help='Start only the document processor'
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
    if args.dry_run and not args.processor_only:
        parser.error("--dry-run can only be used with --processor-only")
    
    return args

def main(argv=None):
    """
    Main entry point with proper error handling and cleanup.
    
    Returns:
        int: Exit code (0 for success, 1 for failure)
    """
    try:
        args = parse_arguments()
        manager = ServiceManager()
        
        logger.log_info("Starting Cogitatio Virtualis services", {
            "api_only": args.api_only,
            "processor_only": args.processor_only,
            "reprocess_all": args.reprocess_all,
            "dry_run": args.dry_run,
            "watch_only": args.watch_only,
            "no_watch": args.no_watch
        })
        
        # Start document processor if requested
        if not args.api_only:
            doc_processor = manager.start_document_processor(args)
            if doc_processor:
                manager.print_process_output(doc_processor, "PROCESSOR")
                time.sleep(2)  # Allow processor time to initialize
            else:
                logger.log_error("Failed to start document processor")
                return 1

        # Start API server if requested
        if not args.processor_only:
            api_server = manager.start_api_server(args)
            if api_server:
                manager.print_process_output(api_server, "API")
            else:
                logger.log_error("Failed to start API server")
                return 1

        # Monitor running processes
        manager.monitor_processes()
        return 0
        
    except Exception as e:
        logger.log_error("Fatal error in main process", {"error": str(e)})
        return 1

if __name__ == "__main__":
    sys.exit(main())
