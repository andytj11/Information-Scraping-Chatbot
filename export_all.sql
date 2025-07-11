\pset pager off
\x off
\copy (SELECT id, COALESCE(NULLIF(url,''),'[no-url]') AS url, chunk_index, text, embedding FROM documents ORDER BY id) TO 'C:/Users/andy/firecrawlmpks/documents_dump.csv' CSV HEADER
