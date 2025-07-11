// ---------- crawl.mjs (final, working) ----------
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import FirecrawlApp from '@mendable/firecrawl-js';

const app = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY
});

(async () => {
  try {
    /* 1️⃣  SCRAPE THE HOME PAGE */
    const single = await app.scrapeUrl('https://www.mpks.gov.my/', {
      formats: ['markdown', 'html']
    });
    if (!single.success) throw new Error(single.error);

    console.log('\n=== MPKS HOME PAGE (FULL MARKDOWN) ===\n');
    console.log(single.markdown);

    /* 2️⃣  CRAWL THE WHOLE SITE  */
    const crawl = await app.crawlUrl('https://www.mpks.gov.my/', {
      limit: 1000,                // raise/remove for deeper coverage
      maxConcurrency: 1,         // free-tier safe (avoids “browser limit”)
      // allowSubdomains: true,  // uncomment if MPKS adds sub-domains
      // crawlEntireDomain: true // uncomment to include sibling paths
      scrapeOptions: { formats: ['markdown', 'html'] }
    });
    if (!crawl.success) throw new Error(crawl.error);

    console.log(`\n=== FINISHED: ${crawl.data.length} PAGES CRAWLED ===\n`);

    /* 3️⃣  PRINT **ONLY** URL + length */
    crawl.data.forEach((doc, i) => {
    console.log(`[${i + 1}] ${doc.url} → ${doc.markdown.length} chars`);
    });

    /* 4️⃣  SAVE EVERYTHING TO DISK */
    const outfile = 'mpks_firecrawl.json';
    writeFileSync(outfile, JSON.stringify(crawl.data, null, 2));

    console.log('Handles still open:', process._getActiveHandles().length);
    console.log('Requests still open:', process._getActiveRequests().length);

    console.log(`\n✅  Full crawl written to ${outfile}`);
  } catch (err) {
    console.error('Firecrawl error:', err.message);
  }
})();
