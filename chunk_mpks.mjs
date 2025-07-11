// ---------- chunk_mpks.mjs ------------------------------------
import { readFileSync, writeFileSync } from 'node:fs';
import { unified }            from 'unified';
import remarkParse            from 'remark-parse';
import stripMarkdown          from 'strip-markdown';
import remarkStringify        from 'remark-stringify';
import { encoding_for_model } from 'tiktoken';
import { TextDecoder }        from 'util';

const enc      = encoding_for_model('gpt-3.5-turbo'); // ≈ nomic-embed-text
const td       = new TextDecoder('utf-8');
const CHUNK_TOKENS = 700;
const OVERLAP      = 50;

function markdownToPlain(md) {
  return unified()
    .use(remarkParse)
    .use(stripMarkdown)
    .use(remarkStringify)
    .processSync(md)
    .toString()
    .replace(/\s+\n/g, '\n')
    .trim();
}

function chunkText(text) {
  const tokens = enc.encode(text);
  const chunks = [];
  for (let i = 0; i < tokens.length; i += CHUNK_TOKENS - OVERLAP) {
    const slice = tokens.slice(i, i + CHUNK_TOKENS);
    chunks.push(td.decode(enc.decode(slice)));   // bytes ➜ UTF-8 string
  }
  return chunks;
}

// ---------------------------------------------------------------
const raw = JSON.parse(readFileSync('mpks_firecrawl.json', 'utf8'));
const out = [];

raw.forEach(doc => {
  const plain = markdownToPlain(doc.markdown ?? '');
  const parts = chunkText(plain);

  parts.forEach((chunk, idx) => {
    out.push({
      url        : doc.url,
      title      : doc.meta?.title ?? doc.title ?? '',
      chunk_index: idx,
      text       : chunk.trim()
    });
  });
});

writeFileSync('mpks_chunks.json', JSON.stringify(out, null, 2));
console.log(`✅  Wrote ${out.length} chunks to mpks_chunks.json`);
