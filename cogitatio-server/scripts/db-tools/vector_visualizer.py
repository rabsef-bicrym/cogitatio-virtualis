# vector_visualizer.py

from flask import Flask, render_template_string, jsonify, request
import numpy as np
import faiss
import sqlite3
import json
from pathlib import Path
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from typing import List, Dict, Any, Tuple
from threading import Timer
import webbrowser
from cogitatio.utils.logging import ComponentLogger
from cogitatio.document_processor import config  # Import your config module

# Initialize Flask app
app = Flask(__name__)

# Set up logging
logger = ComponentLogger("vector_visualizer")

class VectorVisualizer:
    def __init__(self, data_dir: Path = None):
        # Use data directory from config if not provided
        if data_dir is None:
            data_dir = config.DATA_DIR

        self.data_dir = data_dir
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

    def get_vector_data(self, max_vectors: int = 1000, filters: Dict[str, Any] = None) -> Tuple[np.ndarray, List[Dict]]:
        """Get vectors and their metadata"""
        try:
            # Prepare filters
            where_clause = ""
            params = []
            if filters:
                clauses = []
                for key, value in filters.items():
                    clauses.append(f"json_extract(metadata, '$.{key}') = ?")
                    params.append(value)
                where_clause = "WHERE " + " AND ".join(clauses)

            # Get vector IDs matching filters
            with sqlite3.connect(self.db_path) as conn:
                query = f"SELECT vector_id, metadata FROM metadata {where_clause} LIMIT ?"
                params.append(max_vectors)
                rows = conn.execute(query, params).fetchall()

            if not rows:
                raise ValueError("No vectors found matching the criteria")

            vector_ids = [row[0] for row in rows]
            metadata = [json.loads(row[1]) for row in rows]
            total_vectors = len(vector_ids)

            # Get vectors
            vectors = np.zeros((total_vectors, self.index.d), dtype=np.float32)
            for idx, vector_id in enumerate(vector_ids):
                vectors[idx] = self.index.reconstruct(vector_id)

            return vectors, metadata

        except Exception as e:
            logger.log_error(f"Error getting vector data: {e}")
            raise

    def reduce_dimensions(self, vectors: np.ndarray, method: str = 'pca', n_components: int = 2) -> np.ndarray:
        """Reduce vectors to n dimensions using specified method"""
        try:
            if method == 'pca':
                reducer = PCA(n_components=n_components)
            elif method == 'tsne':
                reducer = TSNE(n_components=n_components, perplexity=30, n_iter=1000)
            else:
                raise ValueError(f"Unsupported dimensionality reduction method: {method}")

            reduced = reducer.fit_transform(vectors)
            logger.log_info(f"Reduced vectors to {n_components} dimensions using {method.upper()}")
            return reduced
        except Exception as e:
            logger.log_error(f"Error reducing dimensions: {e}")
            raise

visualizer = VectorVisualizer()

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Vector Space Explorer</title>
    <!-- Tailwind CSS CDN -->
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <!-- Plotly.js CDN -->
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <!-- Lodash CDN -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script>
    <style>
        /* Custom loader */
        .loader {
            border: 8px solid #f3f3f3;
            border-top: 8px solid #3490dc;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Additional custom styles */
        body { background-color: #f7fafc; }
        #loadingOverlay { background-color: rgba(255, 255, 255, 0.75); }
    </style>
</head>
<body class="bg-gray-100">
    <div id="app" class="container mx-auto p-6">
        <div class="bg-white shadow rounded p-4">
            <h1 class="text-2xl font-bold mb-4">Vector Space Explorer</h1>

            <!-- Controls -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                    <label for="viewType" class="block text-sm font-medium text-gray-700">View Type</label>
                    <select id="viewType" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                        <option value="2d">2D View</option>
                        <option value="3d">3D View</option>
                    </select>
                </div>
                <div>
                    <label for="reductionMethod" class="block text-sm font-medium text-gray-700">Reduction Method</label>
                    <select id="reductionMethod" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                        <option value="pca">PCA</option>
                        <option value="tsne">t-SNE</option>
                    </select>
                </div>
                <div>
                    <label for="colorBy" class="block text-sm font-medium text-gray-700">Color By</label>
                    <select id="colorBy" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                        <option value="doc_type">Document Type</option>
                        <option value="chunk_index">Chunk Index</option>
                    </select>
                </div>
                <div>
                    <label for="maxVectors" class="block text-sm font-medium text-gray-700">Max Vectors</label>
                    <input type="number" id="maxVectors" value="1000" min="100" max="10000" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                </div>
            </div>

            <!-- Filter Controls -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label for="docTypeFilter" class="block text-sm font-medium text-gray-700">Filter by Document Type</label>
                    <input type="text" id="docTypeFilter" placeholder="e.g., article, report" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                </div>
                <!-- Add more filters as needed -->
            </div>

            <!-- Plot Area -->
            <div id="plotArea" class="w-full h-96"></div>

            <!-- Selected Point Details -->
            <div id="pointDetails" class="mt-4 hidden">
                <h2 class="text-xl font-bold mb-2">Selected Point Details</h2>
                <pre class="bg-gray-100 p-4 rounded overflow-x-auto"></pre>
            </div>
        </div>
    </div>

    <!-- Loading Overlay -->
    <div id="loadingOverlay" class="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 hidden">
        <div class="text-center">
            <div class="loader mb-4"></div>
            <p class="text-lg font-semibold">Loading...</p>
        </div>
    </div>

    <!-- Custom JavaScript -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            const plotArea = document.getElementById('plotArea');
            const pointDetails = document.getElementById('pointDetails');
            const pointDetailsPre = pointDetails.querySelector('pre');

            const controls = {
                viewType: document.getElementById('viewType'),
                reductionMethod: document.getElementById('reductionMethod'),
                colorBy: document.getElementById('colorBy'),
                maxVectors: document.getElementById('maxVectors'),
                docTypeFilter: document.getElementById('docTypeFilter'),
            };

            const fetchDataAndPlot = async () => {
                // Show loading overlay
                loadingOverlay.classList.remove('hidden');

                try {
                    const params = new URLSearchParams();
                    params.append('max_vectors', controls.maxVectors.value);
                    params.append('dimensions', controls.viewType.value === '3d' ? '3' : '2');
                    params.append('reduction', controls.reductionMethod.value);

                    // Add filters
                    if (controls.docTypeFilter.value.trim()) {
                        params.append('doc_type', controls.docTypeFilter.value.trim());
                    }

                    const response = await fetch(`/data?${params.toString()}`);
                    const data = await response.json();

                    if (data.error) {
                        throw new Error(data.error);
                    }

                    plotData(data);
                } catch (error) {
                    console.error('Error fetching data:', error);
                    alert(`Error: ${error.message}`);
                } finally {
                    // Hide loading overlay
                    loadingOverlay.classList.add('hidden');
                }
            };

            const plotData = (data) => {
                const { coords, metadata } = data;
                const viewType = controls.viewType.value;
                const colorBy = controls.colorBy.value;

                // Prepare data for Plotly
                const uniqueValues = [...new Set(metadata.map(item => item[colorBy]))];
                const colorScale = Plotly.d3.scale.category10();
                const traces = [];

                uniqueValues.forEach((value, idx) => {
                    const indices = metadata
                        .map((item, index) => item[colorBy] === value ? index : -1)
                        .filter(index => index !== -1);

                    const trace = {
                        x: indices.map(i => coords[i][0]),
                        y: indices.map(i => coords[i][1]),
                        text: indices.map(i => JSON.stringify(metadata[i], null, 2)),
                        mode: 'markers',
                        name: value,
                        marker: {
                            size: 6,
                            color: colorScale(idx),
                            line: { width: 0.5, color: 'white' },
                        },
                    };

                    if (viewType === '3d') {
                        trace.z = indices.map(i => coords[i][2] || 0);
                        trace.type = 'scatter3d';
                    } else {
                        trace.type = 'scatter';
                    }

                    traces.push(trace);
                });

                const layout = {
                    title: 'Vector Space Visualization',
                    hovermode: 'closest',
                    margin: { l: 0, r: 0, t: 50, b: 0 },
                    showlegend: true,
                };

                Plotly.newPlot(plotArea, traces, layout);

                // Event listener for point clicks
                plotArea.on('plotly_click', (eventData) => {
                    const pointData = eventData.points[0];
                    const metadata = JSON.parse(pointData.text);
                    pointDetailsPre.textContent = JSON.stringify(metadata, null, 2);
                    pointDetails.classList.remove('hidden');
                });
            };

            // Event listeners
            controls.viewType.addEventListener('change', fetchDataAndPlot);
            controls.reductionMethod.addEventListener('change', fetchDataAndPlot);
            controls.colorBy.addEventListener('change', fetchDataAndPlot);
            controls.maxVectors.addEventListener('change', fetchDataAndPlot);
            controls.docTypeFilter.addEventListener('input', _.debounce(fetchDataAndPlot, 500));

            // Initial fetch and plot
            fetchDataAndPlot();
        });
    </script>
</body>
</html>
'''

@app.route('/')
def home():
    return render_template_string(HTML_TEMPLATE)

@app.route('/data')
def get_data():
    try:
        max_vectors = min(int(request.args.get('max_vectors', 1000)), 10000)
        dimensions = int(request.args.get('dimensions', 2))
        reduction_method = request.args.get('reduction', 'pca')
        filters = {}

        # Handle filters from query parameters
        filter_keys = ['doc_type']
        for key in filter_keys:
            value = request.args.get(key)
            if value:
                filters[key] = value

        vectors, metadata = visualizer.get_vector_data(max_vectors, filters)
        coords = visualizer.reduce_dimensions(vectors, method=reduction_method, n_components=dimensions)

        return jsonify({
            'coords': coords.tolist(),
            'metadata': metadata
        })
    except Exception as e:
        logger.log_error(f"Error processing request: {e}")
        return jsonify({'error': str(e)}), 500

def open_browser():
    webbrowser.open('http://127.0.0.1:5000/')

if __name__ == '__main__':
    # Use a Timer to delay browser opening slightly
    Timer(1, open_browser).start()
    app.run(debug=True)
