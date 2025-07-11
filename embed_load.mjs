// ---------- load_vectors.mjs ----------------------
import fs from 'node:fs';
import pg from 'pg';
import pLimit from 'p-limit';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
dotenv.config();

// ----- config --------------------------------------------------
const infile   = 'mpks_chunks.json';
const table    = 'documents';
const batchSz  = parseInt(process.env.BATCH || '100', 10);
const model    = process.env.MODEL || 'text-embedding-3-small';

// ----- init clients -------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const db     = new pg.Client({ connectionString: process.env.PG_URL });
await db.connect();

// ----- helpers -------------------------------------------------
async function embedBatch(chunks) {
  const res = await openai.embeddings.create({
    model,
    input: chunks.map(c => c.text)
  });
  return res.data.map(obj => obj.embedding);   // list<float[1536]>
}

async function insertRows(meta, vectors) {
  const tpl = `INSERT INTO ${table}
    (url, title, chunk_index, text, embedding)
    VALUES ($1,$2,$3,$4,$5::vector)`;
  const q   = pLimit(4);   // parallelise Postgres inserts a little
  await Promise.all(meta.map((m, i) => q(() =>
    db.query(tpl, [
      m.url, m.title, m.chunk_index, m.text,
      '[' + vectors[i].join(',') + ']'
    ])
  )));
}

// ----- main pipeline ------------------------------------------
const allChunks = JSON.parse(fs.readFileSync(infile, 'utf8'));
console.log(`Embedding ${allChunks.length} chunks …`);

for (let i = 0; i < allChunks.length; i += batchSz) {
  const slice   = allChunks.slice(i, i + batchSz);
  const vectors = await embedBatch(slice);
  await insertRows(slice, vectors);
  console.log(`✓ ${Math.min(i + batchSz, allChunks.length)} / ${allChunks.length}`);
}

await db.end();
console.log('✅  All chunks embedded & stored.');
