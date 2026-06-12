#!/usr/bin/env python
# cogitatio-virtualis/cogitatio-server/scripts/publish_index.py
"""
Publish the local FAISS/SQLite index to a Postgres (pgvector) database.

This is the bridge between the private document pipeline (which runs on your
machine, next to the source documents) and the deployed app (which only ever
sees the processed chunks in Postgres). Run it after the document processor
has (re)built the local index:

    VECTOR_DATABASE_URL=postgres://... python scripts/publish_index.py

The publish is a full, transactional replace: either the new corpus lands
completely or the old one remains untouched.

Requires the optional publish dependency:  pip install 'psycopg[binary]'
"""

import json
import os
import sqlite3
import sys
from pathlib import Path

import psycopg

# Allow running directly from the repo without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cogitatio.document_processor.vector_manager import VectorManager
from cogitatio.utils.logging import ComponentLogger

logger = ComponentLogger("publish_index")

DDL = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS vector_chunks (
    vector_id integer PRIMARY KEY,
    doc_id    text    NOT NULL,
    chunk_id  text    NOT NULL,
    content   text    NOT NULL,
    metadata  jsonb   NOT NULL,
    embedding vector({dimension}) NOT NULL
);

CREATE INDEX IF NOT EXISTS vector_chunks_doc_id_idx
    ON vector_chunks (doc_id);
CREATE INDEX IF NOT EXISTS vector_chunks_type_idx
    ON vector_chunks ((metadata->>'type'));
"""


def vector_literal(values) -> str:
    """pgvector accepts a '[v1,v2,...]' literal cast to ::vector."""
    return "[" + ",".join(f"{float(v):.8f}" for v in values) + "]"


def main() -> int:
    url = os.environ.get("VECTOR_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        print(
            "Set VECTOR_DATABASE_URL (or DATABASE_URL) to the Postgres "
            "connection string before publishing.",
            file=sys.stderr,
        )
        return 1

    vector_manager = VectorManager()
    index = vector_manager.index

    with sqlite3.connect(vector_manager.db_path) as conn:
        rows = conn.execute(
            "SELECT vector_id, doc_id, chunk_id, metadata, content FROM metadata"
        ).fetchall()

    if not rows:
        print("Local index is empty; nothing to publish.", file=sys.stderr)
        return 1

    dimension = vector_manager.dimension
    logger.log_info(
        "Publishing index to Postgres",
        {"chunks": len(rows), "dimension": dimension},
    )

    with psycopg.connect(url) as pg:
        with pg.cursor() as cur:
            cur.execute(DDL.format(dimension=dimension))
            cur.execute("TRUNCATE vector_chunks")
            for vector_id, doc_id, chunk_id, metadata_json, content in rows:
                embedding = index.reconstruct(int(vector_id))
                cur.execute(
                    """
                    INSERT INTO vector_chunks
                        (vector_id, doc_id, chunk_id, content, metadata, embedding)
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s::vector)
                    """,
                    (
                        int(vector_id),
                        doc_id,
                        chunk_id,
                        content,
                        json.dumps(json.loads(metadata_json)),
                        vector_literal(embedding),
                    ),
                )
        pg.commit()

    logger.log_info("Publish complete", {"chunks": len(rows)})
    print(f"Published {len(rows)} chunks to vector_chunks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
