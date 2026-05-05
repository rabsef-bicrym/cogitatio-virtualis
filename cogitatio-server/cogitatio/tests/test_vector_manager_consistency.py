import sqlite3

import numpy as np

from cogitatio.document_processor import vector_manager as vector_manager_module
from cogitatio.document_processor.vector_manager import VectorManager


def make_vector(doc_id: str, chunk_id: str, values: list[float]) -> dict:
    """Build a minimal vector payload for VectorManager tests."""
    return {
        "id": doc_id,
        "chunk_id": chunk_id,
        "values": np.array(values, dtype="float32"),
        "metadata": {
            "doc_id": doc_id,
            "chunk_id": chunk_id,
            "type": "project",
            "chunk_index": 0,
            "total_chunks": 1,
        },
        "content": f"content for {chunk_id}",
    }


def vector_rows(manager: VectorManager) -> list[tuple[int, str, str]]:
    """Read persisted vector IDs in FAISS-position order."""
    with sqlite3.connect(manager.db_path) as conn:
        return conn.execute(
            "SELECT vector_id, doc_id, chunk_id FROM metadata ORDER BY vector_id"
        ).fetchall()


def make_manager(tmp_path, monkeypatch) -> VectorManager:
    """Create a VectorManager isolated to a temporary data directory."""
    monkeypatch.setattr(vector_manager_module, "DATA_DIR", tmp_path)
    return VectorManager(dimension=3)


def test_remove_document_remaps_surviving_metadata_vector_ids(tmp_path, monkeypatch):
    manager = make_manager(tmp_path, monkeypatch)
    manager.store_vectors(
        [
            make_vector("doc-a", "chunk-a", [1.0, 0.0, 0.0]),
            make_vector("doc-b", "chunk-b", [0.0, 1.0, 0.0]),
            make_vector("doc-c", "chunk-c", [0.0, 0.0, 1.0]),
        ]
    )

    manager.remove_document("doc-a")

    assert manager.index.ntotal == 2
    assert vector_rows(manager) == [
        (0, "doc-b", "chunk-b"),
        (1, "doc-c", "chunk-c"),
    ]

    distances, results = manager.search_vectors(np.array([0.0, 1.0, 0.0]), k=1)
    assert distances[0] == 1.0
    assert results[0]["chunk_id"] == "chunk-b"
    assert results[0]["content"] == "content for chunk-b"


def test_remove_vector_by_chunk_id_remaps_surviving_metadata_vector_ids(
    tmp_path,
    monkeypatch,
):
    manager = make_manager(tmp_path, monkeypatch)
    manager.store_vectors(
        [
            make_vector("doc-a", "chunk-a", [1.0, 0.0, 0.0]),
            make_vector("doc-b", "chunk-b", [0.0, 1.0, 0.0]),
            make_vector("doc-c", "chunk-c", [0.0, 0.0, 1.0]),
        ]
    )

    manager.remove_vector_by_chunk_id("chunk-b")

    assert manager.index.ntotal == 2
    assert vector_rows(manager) == [
        (0, "doc-a", "chunk-a"),
        (1, "doc-c", "chunk-c"),
    ]
    assert manager.get_vector_by_chunk_id("chunk-c")["vector_id"] == 1
