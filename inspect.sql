-- Show the first five chunks that were stored
SELECT  id,
        url,
        chunk_index,
        LEFT(text, 120) AS preview        -- first 120 characters
FROM    documents
LIMIT   5;                                -- or FETCH FIRST 5 ROWS ONLY;

-- Confirm total rows
SELECT COUNT(*) AS total_chunks FROM documents;
