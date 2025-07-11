// ---------- load_vectors.mjs ----------------------------------------------
// Load chunked JSON  →  call Ollama (nomic-embed-text)  →  insert into Postgres

import 'dotenv/config';                 // loads .env automatically
import fs     from 'node:fs';
import pg     from 'pg';
import fetch  from 'node-fetch';        // npm i pg node-fetch@^3 dotenv

/* ───────────────────────────────── ENV ─────────────────────────────────── */

const {
  PG_URL      = 'postgresql://postgres:password@localhost:5432/mpks',
  OLLAMA_HOST = 'http://localhost:11434',
  MODEL       = 'nomic-embed-text',     // 768-D vectors
  BATCH       = '20'                    // how many chunks to process per DB write
} = process.env;

const BATCH_SIZE = Number(BATCH);

/* ────────────────────────────── DATABASE ──────────────────────────────── */

const pool = new pg.Pool({ connectionString: PG_URL });

function toPgVector(arr) {
  // pgvector wants:  [0.1,0.2,0.3]
  return '[' + arr.join(',') + ']';
}

async function insertRows(rows) {
  const client = await pool.connect();
  try {
    const text =
      `INSERT INTO documents (url,title,chunk_index,text,embedding)
       VALUES ${rows.map((_, i) =>
         `($${i*5+1},$${i*5+2},$${i*5+3},$${i*5+4},$${i*5+5}::vector)`).join(',')}
       ON CONFLICT DO NOTHING`;

    const values = rows.flatMap(r => [
      r.url,
      r.title,
      r.chunk_index,
      r.text,
      toPgVector(r.embedding)           // ← converted here
    ]);

    await client.query(text, values);
  } finally {
    client.release();
  }
}

/* ────────────────────────── EMBEDDING CALL ────────────────────────────── */

async function embedOne(text) {
  const res = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ model: MODEL, prompt: text })
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Ollama ${res.status}: ${msg}`);
  }
  const { embedding } = await res.json();   // single vector
  return embedding;
}

/* ─────────────────────────────── MAIN ─────────────────────────────────── */

const chunks = JSON.parse(fs.readFileSync('mpks_chunks.json', 'utf8'));
console.log(`Embedding ${chunks.length} chunks …`);

for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
  const slice = chunks.slice(i, i + BATCH_SIZE);
  const rows  = [];

  for (const chunk of slice) {
    try {
      const vec = await embedOne(chunk.text);
      rows.push({ ...chunk, embedding: vec });
    } catch (err) {
      console.warn(`⚠️  Chunk ${chunk.chunk_index} failed: ${err.message}`);
    }
  }

  if (rows.length) {
    try {
      await insertRows(rows);
      console.log(`✅  Inserted ${i + rows.length} / ${chunks.length}`);
    } catch (dbErr) {
      console.error(`❌  DB error on batch starting at ${i}: ${dbErr.message}`);
    }
  }
}

await pool.end();
console.log('🎉  All done');
