#!/usr/bin/env python3
"""
One-off migration of chat threads from the legacy SQLite database to
Postgres. Run on the machine that holds prisma/dev.db (the old EC2 box):

    DATABASE_URL=postgres://... python3 scripts/migrate_threads.py [path/to/dev.db]

Idempotent: rows that already exist are skipped. Requires psycopg
(pip install 'psycopg[binary]'). Run `prisma db push` against the target
database first so the tables exist.
"""

import os
import sqlite3
import sys

import psycopg


def to_timestamp(value):
    """Prisma's SQLite adapter stores DateTime as ms-since-epoch."""
    if isinstance(value, (int, float)):
        return psycopg.TimestampFromTicks(value / 1000.0)
    return value  # already an ISO string


def main() -> int:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Set DATABASE_URL to the Postgres connection string.", file=sys.stderr)
        return 1

    db_path = sys.argv[1] if len(sys.argv) > 1 else "prisma/dev.db"
    if not os.path.exists(db_path):
        print(f"SQLite database not found: {db_path}", file=sys.stderr)
        return 1

    lite = sqlite3.connect(db_path)
    sessions = lite.execute(
        'SELECT id, createdAt, updatedAt, expiresAt, data, isActive, lastActivity '
        'FROM "Session"'
    ).fetchall()
    messages = lite.execute(
        'SELECT id, sessionId, role, content, timestamp FROM "ThreadMessage"'
    ).fetchall()

    migrated_sessions = migrated_messages = 0
    with psycopg.connect(url) as pg:
        with pg.cursor() as cur:
            for sid, created, updated, expires, data, active, last in sessions:
                cur.execute(
                    'INSERT INTO "Session" '
                    '(id, "createdAt", "updatedAt", "expiresAt", data, "isActive", "lastActivity") '
                    "VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
                    (
                        sid,
                        to_timestamp(created),
                        to_timestamp(updated),
                        to_timestamp(expires),
                        data,
                        bool(active),
                        to_timestamp(last),
                    ),
                )
                migrated_sessions += cur.rowcount
            for mid, sid, role, content, ts in messages:
                cur.execute(
                    'INSERT INTO "ThreadMessage" (id, "sessionId", role, content, timestamp) '
                    "VALUES (%s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
                    (mid, sid, role, content, to_timestamp(ts)),
                )
                migrated_messages += cur.rowcount
        pg.commit()

    print(
        f"Migrated {migrated_sessions}/{len(sessions)} sessions and "
        f"{migrated_messages}/{len(messages)} messages."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
