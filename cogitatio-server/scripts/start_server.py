#!/usr/bin/env python3

import subprocess
import sys
import os
import signal
import time
from pathlib import Path
import argparse
from typing import List
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('cogitatio-server')

class ServiceManager:
    def __init__(self):
        self.processes: List[subprocess.Popen] = []
        self.setup_signal_handlers()

    def setup_signal_handlers(self):
        signal.signal(signal.SIGINT, self.handle_shutdown)
        signal.signal(signal.SIGTERM, self.handle_shutdown)

    def handle_shutdown(self, signum, frame):
        logger.info("Shutting down services...")
        for process in self.processes:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
        sys.exit(0)

    def start_document_processor(self):
        """Start the document processor service"""
        cmd = [
            sys.executable,
            "-m",  # Use -m to run as module instead
            "cogitatio.document_processor.main",
            "--watch-only"
        ]
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        self.processes.append(process)
        return process

    def start_api_server(self):
        """Start the FastAPI server"""
        cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "cogitatio.api.routes:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000"
        ]
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        self.processes.append(process)
        return process

    def print_process_output(self, process: subprocess.Popen, prefix: str):
        """Print process output with a prefix"""
        def print_stream(stream, prefix):
            for line in stream:
                logger.info(f"{prefix}: {line.strip()}")

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

def main(argv=None):
    parser = argparse.ArgumentParser(description='Start Cogitatio Virtualis services')
    parser.add_argument('--api-only', action='store_true', help='Start only the API server')
    parser.add_argument('--processor-only', action='store_true', help='Start only the document processor')
    args = parser.parse_args(argv)

    manager = ServiceManager()
    
    try:
        if not args.api_only:
            logger.info("Starting document processor in watch-only mode...")
            doc_processor = manager.start_document_processor()
            manager.print_process_output(doc_processor, "PROCESSOR")
            time.sleep(2)

        if not args.processor_only:
            logger.info("Starting API server...")
            api_server = manager.start_api_server()
            manager.print_process_output(api_server, "API")

        while True:
            time.sleep(1)
            for process in manager.processes:
                if process.poll() is not None:
                    logger.error("One of the services has terminated unexpectedly!")
                    manager.handle_shutdown(None, None)

    except Exception as e:
        logger.error(f"Error starting services: {e}")
        manager.handle_shutdown(None, None)

if __name__ == "__main__":
    main()