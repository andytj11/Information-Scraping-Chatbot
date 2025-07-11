"""
Quick similarity check on documents_openai
------------------------------------------
• pip install openai psycopg[binary]
• export OPENAI_API_KEY   (and PG_URL if you like)
"""

import os, sys, openai, psycopg
from textwrap import shorten

PG_URL = os.getenv(
    "PG_URL",
    "postgresql://postgres:YOUR_DOCKER_PASSWORD@localhost:6543/mpks"
)
openai.api_key = os.environ["OPENAI_API_KEY"]
MODEL = "text-embedding-3-small"          # same model used to load

# ── helpers ────────────────────────────────────────────────────────────────
def as_pgvector(v):           # list[float] → '[0.123,-0.456,…]'
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"

# ── take query text from CLI or prompt ─────────────────────────────────────
query = " ".join(sys.argv[1:]) or input("Query: ").strip()
if not query:
    sys.exit("No query supplied.")

vec  = openai.embeddings.create(model=MODEL, input=query).data[0].embedding
vecL = as_pgvector(vec)

SQL = """
SELECT id,
       chunk_index,
       LEFT(text,120) AS preview,
       1 - (embedding <=> %s) AS sim
FROM   documents_openai
ORDER  BY embedding <=> %s
LIMIT  5;
"""

with psycopg.connect(PG_URL) as conn, conn.cursor() as cur:
    cur.execute(SQL, (vecL, vecL))
    rows = cur.fetchall()

print(f"\nTop-5 matches for: {query!r}\n")
for id_, idx, pv, sim in rows:
    print(f"{sim:6.3f} | id={id_:>4} | chunk={idx:<3} | {shorten(pv,100)}")
