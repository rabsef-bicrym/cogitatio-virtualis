# cogitatio-virtualis/server/tools/vector_visualizer.py

from flask import Flask, render_template_string, jsonify, request
import numpy as np
import faiss
import sqlite3
import json
from pathlib import Path
from sklearn.decomposition import PCA
from typing import List, Dict, Any, Tuple
import webbrowser
from threading import Timer
from cogitatio.utils.logging import ComponentLogger

app = Flask(__name__)
logger = ComponentLogger("vector_visualizer")

class VectorVisualizer:
    def __init__(self, data_dir: str = "./data"):
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

visualizer = VectorVisualizer()

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Vector Space Explorer</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <style>
        .loading { background: rgba(255, 255, 255, 0.9); display: none; }
        .loading.active { display: flex; }
    </style>
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="loading fixed inset-0 z-50 flex items-center justify-center">
        <div class="bg-white p-4 rounded-lg shadow-lg">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p class="mt-2">Loading vectors...</p>
        </div>
    </div>

    <div class="container mx-auto px-4 py-8">
        <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h1 class="text-2xl font-bold mb-4">Vector Space Explorer</h1>
            
            <!-- Controls -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">View Type</label>
                    <select id="viewType" class="w-full rounded border-gray-300 shadow-sm">
                        <option value="2d">2D View</option>
                        <option value="3d">3D View</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Color By</label>
                    <select id="colorBy" class="w-full rounded border-gray-300 shadow-sm">
                        <option value="doc_type">Document Type</option>
                        <option value="chunk_index">Chunk Index</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Max Vectors</label>
                    <input type="number" id="maxVectors" value="1000" min="100" max="10000" 
                           class="w-full rounded border-gray-300 shadow-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Point Size</label>
                    <input type="range" id="pointSize" min="2" max="10" value="6" class="w-full">
                </div>
            </div>
            
            <!-- Error display -->
            <div id="errorDisplay" class="hidden bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            </div>
            
            <!-- Stats display -->
            <div id="statsDisplay" class="text-sm text-gray-600 mb-4"></div>
            
            <!-- Plot container -->
            <div id="plot" class="w-full h-[600px]"></div>
        </div>
        
        <!-- Selected point info -->
        <div id="pointInfo" class="bg-white rounded-lg shadow-lg p-6 hidden">
            <h2 class="text-xl font-bold mb-4">Selected Point Details</h2>
            <pre class="bg-gray-100 p-4 rounded overflow-x-auto"></pre>
        </div>
    </div>

    <script>
        const loading = document.querySelector('.loading');
        const pointInfo = document.getElementById('pointInfo');
        const errorDisplay = document.getElementById('errorDisplay');
        const statsDisplay = document.getElementById('statsDisplay');
        let currentPlot = null;
        let currentData = null;
        
        function showError(message) {
            errorDisplay.textContent = `Error: ${message}`;
            errorDisplay.classList.remove('hidden');
        }
        
        function hideError() {
            errorDisplay.classList.add('hidden');
        }
        
        function updateStats(data) {
            const stats = {
                'Total Vectors': data.metadata.length,
                'Document Types': new Set(data.metadata.map(m => m.doc_type)).size,
                'Max Chunk Index': Math.max(...data.metadata.map(m => m.chunk_index))
            };
            
            statsDisplay.innerHTML = Object.entries(stats)
                .map(([key, value]) => `<span class="mr-4">${key}: ${value}</span>`)
                .join('');
        }
        
        async function fetchAndPlot() {
            loading.classList.add('active');
            hideError();
            
            const maxVectors = document.getElementById('maxVectors').value;
            const dims = document.getElementById('viewType').value === '2d' ? 2 : 3;
            
            try {
                const response = await fetch(`/data?max_vectors=${maxVectors}&dimensions=${dims}`);
                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }
                
                const data = await response.json();
                if (data.error) {
                    throw new Error(data.error);
                }
                
                currentData = data;
                updateStats(data);
                updatePlot(data);
            } catch (error) {
                console.error('Error:', error);
                showError(error.message);
            } finally {
                loading.classList.remove('active');
            }
        }
        
        function updatePlot(data) {
            if (!data.coords || !data.metadata || data.coords.length === 0) {
                showError('No data to display');
                return;
            }
            
            const viewType = document.getElementById('viewType').value;
            const colorBy = document.getElementById('colorBy').value;
            const pointSize = document.getElementById('pointSize').value;
            
            const uniqueValues = [...new Set(data.metadata.map(m => m[colorBy]))];
            const colors = uniqueValues.map((_, i) => 
                `hsl(${(i * 360) / uniqueValues.length}, 70%, 50%)`
            );
            
            const traces = uniqueValues.map(value => {
                const indices = data.metadata
                    .map((m, i) => m[colorBy] === value ? i : -1)
                    .filter(i => i !== -1);
                
                const trace = {
                    type: viewType === '2d' ? 'scatter' : 'scatter3d',
                    mode: 'markers',
                    name: value,
                    text: indices.map(i => JSON.stringify(data.metadata[i], null, 2)),
                    hoverinfo: 'text',
                    marker: {
                        size: pointSize,
                        color: colors[uniqueValues.indexOf(value)]
                    },
                    customdata: indices.map(i => data.metadata[i])
                };
                
                // Add coordinates based on view type
                if (viewType === '2d') {
                    trace.x = indices.map(i => data.coords[i][0]);
                    trace.y = indices.map(i => data.coords[i][1]);
                } else {
                    trace.x = indices.map(i => data.coords[i][0]);
                    trace.y = indices.map(i => data.coords[i][1]);
                    trace.z = indices.map(i => data.coords[i][2] || 0);  // Ensure z exists
                }
                
                return trace;
            });
            
            const layout = {
                margin: { l: 0, r: 0, t: 0, b: 0 },
                showlegend: true,
                legend: { x: 1, y: 0.5 }
            };
            
            if (viewType === '3d') {
                layout.scene = {
                    camera: currentPlot && Plotly.d3.select('#plot').layout?.scene?.camera 
                        ? Plotly.d3.select('#plot').layout.scene.camera 
                        : {
                            eye: {x: 1.5, y: 1.5, z: 1.5},
                            center: {x: 0, y: 0, z: 0},
                            up: {x: 0, y: 0, z: 1}
                        }
                };
                layout.scene.aspectmode = 'cube';  // Force equal scaling
                layout.dragmode = 'orbit';  // Better 3D interaction
            }
            
            Plotly.newPlot('plot', traces, layout);
            currentPlot = true;
            
            // Handle click events
            document.getElementById('plot').on('plotly_click', function(data) {
                const point = data.points[0];
                const metadata = point.customdata;
                
                pointInfo.classList.remove('hidden');
                pointInfo.querySelector('pre').textContent = 
                    JSON.stringify(metadata, null, 2);
            });
        }
        
        // Event listeners
        ['colorBy', 'viewType'].forEach(id => {
            document.getElementById(id).addEventListener('change', fetchAndPlot);
        });
        
        document.getElementById('maxVectors').addEventListener('change', 
            _.debounce(fetchAndPlot, 500));
            
        document.getElementById('pointSize').addEventListener('input', 
            _.debounce(() => {
                if (currentData) updatePlot(currentData);
            }, 100));
        
        // Initial load
        fetchAndPlot();
    </script>
</body>
</html>
"""

@app.route('/')
def home():
    return render_template_string(HTML_TEMPLATE)

@app.route('/data')
def get_data():
    try:
        max_vectors = min(int(request.args.get('max_vectors', 1000)), 10000)
        dimensions = int(request.args.get('dimensions', 2))
        
        vectors, metadata = visualizer.get_vector_data(max_vectors)
        coords = visualizer.reduce_dimensions(vectors, dimensions)
        
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
    Timer(1, open_browser).start()
    app.run(debug=True)