// scripts/fix_encoding.mjs
// Fixes mojibake (UTF-8 read as Latin-1) in all done queries
import pg from 'pg';
const { Client } = pg;

// Use raw text protocol to get the actual stored text
const client = new Client({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'gamma',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'gamma',
});

await client.connect();
console.log('[fix-encoding] Connected');

// Get the raw text of result_json (as PostgreSQL would send it over the wire)
const { rows } = await client.query(`SELECT id, result_json::text as raw FROM queries WHERE status = 'done'`);
console.log(`[fix-encoding] Found ${rows.length} queries to check`);

for (const row of rows) {
  const rawStr = row.raw; // This is the JSONB field serialized to text by pg driver

  // Detect mojibake: Ã is the 0xC3 byte of 2-byte UTF-8 sequences (e.g., ó, á, é, ñ)
  // When stored as 0xC3 0xB3 but misread as 2 latin1 chars they appear as Ã³ (or ├│ in some display contexts)
  if (!rawStr.includes('├') && !rawStr.includes('\xC3') && !rawStr.includes('Ã')) {
    console.log(`  [skip] id=${row.id} — encoding looks correct`);
    continue;
  }

  // Fix: each character in rawStr that came from pg was decoded as UTF-8 by the pg driver
  // But the underlying bytes were already UTF-8 that were double-encoded
  // Strategy: treat each char's codepoint as a byte, reassemble bytes, decode as UTF-8
  
  try {
    // Build byte array from the string treating each char as a byte (latin1 interpretation)
    const bytes = Buffer.alloc(rawStr.length);
    for (let i = 0; i < rawStr.length; i++) {
      bytes[i] = rawStr.charCodeAt(i) & 0xFF;
    }
    const fixed = bytes.toString('utf8');
    
    // Verify it parses correctly
    JSON.parse(fixed);
    
    await client.query(`UPDATE queries SET result_json = $1::jsonb WHERE id = $2`, [fixed, row.id]);
    console.log(`  [ok] id=${row.id} encoding fixed`);
  } catch (e) {
    console.error(`  [error] id=${row.id}: ${e.message}`);
    
    // Alternative approach: fix field by field using regex replacement
    try {
      const fixedStr = rawStr.replace(/[\xC0-\xFF][\x80-\xBF]/g, (match) => {
        const bytes = Buffer.from([match.charCodeAt(0), match.charCodeAt(1)]);
        return bytes.toString('utf8');
      });
      JSON.parse(fixedStr);
      await client.query(`UPDATE queries SET result_json = $1::jsonb WHERE id = $2`, [fixedStr, row.id]);
      console.log(`  [ok-alt] id=${row.id} encoding fixed with alt method`);
    } catch(e2) {
      console.error(`  [error-alt] id=${row.id}: ${e2.message}`);
    }
  }
}

await client.end();
console.log('[fix-encoding] Done');
