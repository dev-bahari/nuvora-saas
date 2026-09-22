import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  console.log('[empyra] Running database migrations...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const migrationsDir = path.join(process.cwd(), 'db/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const { rowCount } = await client.query(
      'SELECT name FROM _schema_migrations WHERE name = $1',
      [file],
    );
    if ((rowCount ?? 0) > 0) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`[empyra] Applying migration: ${file}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  console.log('[empyra] Migrations complete. Starting API...');
} finally {
  client.release();
  await pool.end();
}

await import('./dist/main.js');
