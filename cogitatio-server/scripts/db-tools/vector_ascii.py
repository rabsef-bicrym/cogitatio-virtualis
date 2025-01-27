# cogitatio-virtualis/server/tools/vector_ascii_visualizer.py

import sys
import numpy as np
import faiss
import sqlite3
import json
from pathlib import Path
from sklearn.decomposition import PCA
from typing import List, Dict, Any, Tuple
from collections import defaultdict
import argparse
from cogitatio.utils.logging import ComponentLogger
from cogitatio.document_processor import config  # Import your config module

logger = ComponentLogger("vector_ascii_visualizer")

class VectorASCIIVisualizer:
    def __init__(self, data_dir: Path = None):
        # Use data directory from config if not provided
        if data_dir is None:
            data_dir = config.DATA_DIR

        self.data_dir = Path(data_dir)
        self.index_path = self.data_dir / "vectors.index"
        self.db_path = self.data_dir / "metadata.db"

        # Load FAISS index
        if not self.index_path.exists():
            raise FileNotFoundError(f"No FAISS index found at {self.index_path}")

        try:
            self.index = faiss.read_index(str(self.index_path))
            logger.log_info(f"Loaded FAISS index with {self.index.ntotal} vectors")
        except Exception as e:
            logger.log_error(f"Failed to load FAISS index: {e}")
            raise

    def get_vector_data(self, max_vectors: int = 1000) -> Tuple[np.ndarray, List[Dict]]:
        """Get vectors and their metadata"""
        try:
            # Get all vectors
            total_vectors = min(self.index.ntotal, max_vectors)
            if total_vectors == 0:
                raise ValueError("No vectors found in index")

            vectors = np.zeros((total_vectors, self.index.d), dtype=np.float32)

            for i in range(total_vectors):
                vectors[i] = self.index.reconstruct(i)

            # Get metadata
            metadata = []
            with sqlite3.connect(self.db_path) as conn:
                for i in range(total_vectors):
                    row = conn.execute(
                        "SELECT metadata FROM metadata WHERE vector_id = ?",
                        (i,)
                    ).fetchone()
                    if row:
                        meta = json.loads(row[0])
                        # Ensure required fields exist
                        meta["doc_type"] = meta.get("type", "unknown")
                        meta["chunk_index"] = meta.get("chunk_index", 0)
                        metadata.append(meta)
                    else:
                        metadata.append({
                            "doc_type": "unknown",
                            "chunk_index": 0,
                            "error": "No metadata found"
                        })

            return vectors, metadata

        except Exception as e:
            logger.log_error(f"Error getting vector data: {e}")
            raise

    def reduce_dimensions(self, vectors: np.ndarray, n_components: int = 2) -> np.ndarray:
        """Reduce vectors to n dimensions using PCA"""
        try:
            pca = PCA(n_components=n_components)
            reduced = pca.fit_transform(vectors)
            logger.log_info(f"Reduced vectors to {n_components} dimensions")
            return reduced
        except Exception as e:
            logger.log_error(f"Error reducing dimensions: {e}")
            raise

    def map_to_grid(self, coords: np.ndarray, grid_width: int, grid_height: int) -> List[Tuple[int, int]]:
        """Map 2D coordinates to grid positions"""
        x_coords = coords[:, 0]
        y_coords = coords[:, 1]

        # Normalize coordinates to [0, 1]
        x_min, x_max = x_coords.min(), x_coords.max()
        y_min, y_max = y_coords.min(), y_coords.max()

        x_norm = (x_coords - x_min) / (x_max - x_min) if x_max > x_min else x_coords
        y_norm = (y_coords - y_min) / (y_max - y_min) if y_max > y_min else y_coords

        # Map to grid indices
        x_indices = (x_norm * (grid_width - 1)).astype(int)
        y_indices = (y_norm * (grid_height - 1)).astype(int)

        return list(zip(x_indices, y_indices))

    def render_ascii_grid(self, grid_width: int = 80, grid_height: int = 60, max_vectors: int = 1000):
        """Render the ASCII grid"""
        vectors, metadata = self.get_vector_data(max_vectors)
        coords = self.reduce_dimensions(vectors, 2)
        grid_positions = self.map_to_grid(coords, grid_width, grid_height)

        # Create a mapping from doc_type to ASCII characters
        doc_types = set(meta['doc_type'] for meta in metadata)
        ascii_chars = ['@', '#', '%', '&', '*', '+', '=', '-', '.', '~', '^', 'o', 'O']
        type_to_char = {doc_type: ascii_chars[i % len(ascii_chars)] for i, doc_type in enumerate(doc_types)}

        # Create the grid
        grid = [[' ' for _ in range(grid_width)] for _ in range(grid_height)]

        # Handle overlapping points by stacking characters
        grid_cells = defaultdict(list)
        for (x, y), meta in zip(grid_positions, metadata):
            grid_cells[(y, x)].append(meta['doc_type'])

        for (y, x), types in grid_cells.items():
            if len(types) == 1:
                grid[y][x] = type_to_char[types[0]]
            else:
                # If multiple types occupy the same cell, use '*' or other indicator
                grid[y][x] = '*'

        # Convert grid to string
        grid_lines = [''.join(row) for row in grid]
        ascii_art = '\n'.join(grid_lines)

        # Create the legend
        legend_lines = [f"{char} : {doc_type}" for doc_type, char in type_to_char.items()]
        legend = '\n'.join(legend_lines)

        return ascii_art, legend

def main():
    parser = argparse.ArgumentParser(description='Vector ASCII Visualizer')
    parser.add_argument('--grid-width', type=int, default=80, help='Width of the ASCII grid')
    parser.add_argument('--grid-height', type=int, default=60, help='Height of the ASCII grid')
    parser.add_argument('--max-vectors', type=int, default=1000, help='Maximum number of vectors to visualize')
    parser.add_argument('--output', type=str, default=None, help='Output file to save the ASCII art')
    args = parser.parse_args()

    # Ensure 4:3 aspect ratio
    aspect_ratio = args.grid_width / args.grid_height
    desired_ratio = 4 / 3
    if not np.isclose(aspect_ratio, desired_ratio, atol=0.05):
        logger.log_warning(f"Grid dimensions do not have a 4:3 aspect ratio. Adjusting grid height.")
        args.grid_height = int(args.grid_width / desired_ratio)

    visualizer = VectorASCIIVisualizer()

    try:
        ascii_art, legend = visualizer.render_ascii_grid(
            grid_width=args.grid_width,
            grid_height=args.grid_height,
            max_vectors=args.max_vectors
        )
        output = f"{ascii_art}\n\nLegend:\n{legend}"

        if args.output:
            with open(args.output, 'w') as f:
                f.write(output)
            print(f"ASCII art saved to {args.output}")
        else:
            print(output)

    except Exception as e:
        logger.log_error(f"Error generating ASCII art: {e}")
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
