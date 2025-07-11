# load_openai.py  (place in firecrawlmpks/)
import json, os, sys
import openai, psycopg2, tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter
from tqdm import tqdm

from openai import OpenAI
client = OpenAI() 

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    sys.exit("Set OPENAI_API_KEY first")
openai.api_key = OPENAI_API_KEY

PG_CONN = os.getenv("PG_CONN")  # postgresql://...
if not PG_CONN:
    sys.exit("Set PG_CONN first")

# 1. read your scraped text -------------
with open("mpks_chunks.json", encoding="utf-8") as f:
    docs = json.load(f)

# 2. split (optional – if mpks_chunks.json already holds chunks, skip) ----
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
all_chunks = []
for d in docs:
    for i, chunk in enumerate(splitter.split_text(d["text"])):
        all_chunks.append({"url": d.get("url",""), "index": i, "text": chunk})

# 3. embed & insert ---------------------
conn = psycopg2.connect(PG_CONN)
cur  = conn.cursor()


def embed(text: str) -> list[float]:
    resp = client.embeddings.create(
        model="text-embedding-3-small",   # or whichever model you set
        input=text
    )
    # resp.data[0].embedding  → Python list[float]
    return resp.data[0].embedding

sql = """INSERT INTO documents_openai (url, chunk_index, text, embedding)
         VALUES (%s, %s, %s, %s);"""

for c in tqdm(all_chunks, desc="Embedding & inserting"):
    vec = embed(c["text"])
    cur.execute(sql, (c["url"], c["index"], c["text"], vec))

conn.commit()
cur.close(); conn.close()
print("✓ Done – inserted", len(all_chunks), "rows into documents_openai")
