# Deploying COGITATIO VIRTUALIS (Vercel-only)

The app deploys entirely to Vercel. There is no server to run: vector search
happens inside Next.js API routes against Postgres (pgvector), and chat
threads live in the same database via Prisma.

`cogitatio-server` is **not deployed**. It runs locally, next to the private
source documents, and publishes the processed corpus to Postgres. The public
repository never contains document content — only code and templates.

```
[your machine]                         [hosted]
documents/ ─▶ document processor ─▶ publish_index.py ─▶ Neon Postgres
                (FAISS + SQLite,         (pgvector)        ▲
                 stays local)                              │ DATABASE_URL
                                                   Vercel (Next.js app)
```

## One-time setup

### 1. Create the database (Neon)

Create a free [Neon](https://neon.tech) project. Any Postgres with the
`pgvector` extension works; Neon's free tier is more than enough for a CV.
Copy the **pooled** connection string.

### 2. Create the thread tables

From `virtualis-terminal/` with `DATABASE_URL` pointing at the database:

```bash
DATABASE_URL=postgres://... npx prisma db push
```

### 3. Publish the corpus

From `cogitatio-server/`, after the document processor has built the local
index (same as always):

```bash
pip install 'psycopg[binary]'   # or: pip install -e '.[publish]'
VECTOR_DATABASE_URL=postgres://... python scripts/publish_index.py
```

The publish is a transactional full replace — rerun it whenever the
documents change. It creates the `vector_chunks` table and the pgvector
extension on first run.

### 4. Create the Vercel project

Import the repository in Vercel with **Root Directory** set to
`virtualis-terminal`. Framework preset: Next.js (defaults are fine —
`prisma generate` already runs in `prebuild`).

Environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the pooled Neon connection string |
| `VOYAGE_API_KEY` | your Voyage AI key (query embeddings at runtime) |
| `VOYAGE_MODEL` | the model the corpus was published with (must match) |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `ANTHROPIC_CHAT_MODEL` / `ANTHROPIC_BOOT_MODEL` / `ANTHROPIC_HAIKU_MODEL` | as in `.env.example` |

Deploy.

## Updating the CV

1. Edit documents locally; let the processor reindex (it watches the
   directory, as always).
2. `python scripts/publish_index.py`

No redeploy needed — the app reads the database at query time.

## Local development

Point `DATABASE_URL` at any Postgres with pgvector — a Neon branch database
or `docker run -e POSTGRES_PASSWORD=pg -p 5432:5432 pgvector/pgvector:pg17`
both work. Then `npx prisma db push`, publish the corpus (or a test corpus),
and `npm run dev`.
