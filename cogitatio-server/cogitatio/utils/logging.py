# cogitatio-virtualis/server/utils/logging.py

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from dataclasses import dataclass, asdict
import logging
from logging.handlers import RotatingFileHandler

@dataclass
class LogEntry:
    component: str
    message: str
    data: Optional[Any]
    level: str = "ERROR"
    timestamp: str = datetime.utcnow().isoformat()

    def to_json(self) -> str:
        return json.dumps(asdict(self), default=str)

class SingleFileHandler(RotatingFileHandler):
    HEADER_MARKER = "--- SINGLE FILE MODE ACTIVE ---"
    HEADER_END_MARKER = "---"

    def __init__(self, filename: str, max_bytes: int):
        super().__init__(
            filename,
            maxBytes=max_bytes,
            backupCount=0  # We're handling rotation ourselves
        )
        self.max_bytes = max_bytes
        
    def do_rollover(self) -> None:
        """Custom rollover that keeps the most recent 50% of logs while preserving header."""
        if self.stream:
            self.stream.close()
            self.stream = None

        tmp_filename = f"{self.baseFilename}.tmp"
        header_lines = []
        content_lines = []
        in_header = False
        
        # Separate header from content
        with open(self.baseFilename, 'r') as f:
            for line in f:
                if self.HEADER_MARKER in line:
                    in_header = True
                if in_header:
                    header_lines.append(line)
                    if self.HEADER_END_MARKER in line and len(line.strip()) == len(self.HEADER_END_MARKER):
                        in_header = False
                else:
                    content_lines.append(line)
        
        # Keep the newer half of content
        midpoint = len(content_lines) // 2
        remaining = content_lines[midpoint:]
        
        # Write header and remaining content to temp file
        with open(tmp_filename, 'w') as f:
            # Write header
            f.writelines(header_lines)
            # Write remaining content
            f.writelines(remaining)
        
        # Replace original with temp
        os.replace(tmp_filename, self.baseFilename)
        
        if not self.delay:
            self.stream = self._open()

class ComponentLogger:
    def __init__(self, component: str):
        self.component = component
        self.env = os.getenv("COGITATIO_ENV", "development")
        self.base_path = Path(os.getenv("COGITATIO_LOG_PATH", "./logs"))
        self.max_size = int(os.getenv("COGITATIO_LOG_ROTATION_SIZE", 10_485_760))  # 10MB default
        self.backup_count = min(5, int(os.getenv("COGITATIO_LOG_BACKUP_COUNT", 5)))
        
        # Create logs directory if it doesn't exist
        self.base_path.mkdir(exist_ok=True)
        
        # Set up component and combined loggers
        self.component_logger = self._setup_logger(
            f"{component}_logger",
            self.base_path / f"{component}.log"
        )
        self.combined_logger = self._setup_logger(
            "combined_logger",
            self.base_path / "combined.log"
        )

    def _setup_logger(self, name: str, log_path: Path) -> logging.Logger:
        logger = logging.getLogger(name)
        logger.setLevel(logging.INFO)  # Set to INFO to capture all levels
        
        # Clear any existing handlers
        logger.handlers = []
        
        # File handler (either rotating or single file)
        if self.backup_count == 0:
            handler = SingleFileHandler(str(log_path), self.max_size)
            # Add single file mode header
            if not log_path.exists():
                with open(log_path, 'w') as f:
                    f.write(
                        "--- SINGLE FILE MODE ACTIVE ---\n"
                        f"Maximum file size: {self.max_size}\n"
                        f"Cleanup trigger: {int(self.max_size * 0.9)}\n"
                        "Content removal: 50% on trigger\n"
                        "---\n"
                    )
        else:
            handler = RotatingFileHandler(
                str(log_path),
                maxBytes=self.max_size,
                backupCount=self.backup_count
            )
        
        # Custom formatter for JSON output
        handler.setFormatter(logging.Formatter('%(message)s'))
        logger.addHandler(handler)
        
        # Console handler for development
        if self.env == "development":
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setFormatter(
                logging.Formatter(
                    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
                )
            )
            logger.addHandler(console_handler)
        
        return logger

    def log(self, level: str, message: str, data: Any = None) -> None:
        """General log method for all levels."""
        entry = LogEntry(
            component=self.component,
            message=message,
            data=data,
            level=level
        )
        
        json_entry = entry.to_json()
        
        # Log to component file
        logger_method = getattr(self.component_logger, level.lower(), self.component_logger.info)
        logger_method(json_entry)
        
        # Log to combined file
        combined_logger_method = getattr(self.combined_logger, level.lower(), self.combined_logger.info)
        combined_logger_method(json_entry)

    def log_info(self, message: str, data: Any = None) -> None:
        self.log('INFO', message, data)

    def log_warning(self, message: str, data: Any = None) -> None:
        self.log('WARNING', message, data)

    def log_error(self, message: str, data: Any = None) -> None:
        self.log('ERROR', message, data)

    def log_failure(self, message: str, data: Any = None) -> None:
        """For backward compatibility, same as log_error."""
        self.log_error(message, data)

# Example usage:
if __name__ == "__main__":
    # Test the logger
    logger = ComponentLogger("test_component")
    logger.log_info(
        "Test info message",
        {"status": "Everything is working fine"}
    )
    logger.log_warning(
        "Test warning message",
        {"warning": "This is a warning"}
    )
    logger.log_error(
        "Test error message",
        {"error": "Something went wrong", "code": 500}
    )
