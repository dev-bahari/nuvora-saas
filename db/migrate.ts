import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

const connectionString =
  process.env['DATABASE_URL'] ??
  'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_dev';

export async function runMigrations(poolOrDir?: pg.Pool | string): Promise<string[]> {
  const externalPool = typeof poolOrDir === 'object' ? poolOrDir : undefined;
  const dir = typeof poolOrDir === 'string' ? poolOrDir : path.join(process.cwd(), 'db/migrations');
  const pool = externalPool ?? new Pool({ connectionString });
  const client = await pool.connect();

  try {
    // Serialize test workers and deploy replicas applying the same migration set.
    await client.query(`SELECT pg_advisory_lock(hashtext('nuvora:migrations'))`);
    // Create migrations tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const applied: string[] = [];

    for (const file of files) {
      const checkRes = await client.query(
        'SELECT name FROM _schema_migrations WHERE name = $1',
        [file],
      );
      if ((checkRes.rowCount ?? 0) > 0) {
        continue;
      }

      const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
      console.log(`Applying migration: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    return applied;
  } finally {
    await client.query(`SELECT pg_advisory_unlock(hashtext('nuvora:migrations'))`).catch(() => undefined);
    client.release();
    if (!externalPool) await pool.end();
  }
}

// If invoked directly from CLI
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then((applied) => {
      console.log(`Migrations complete. Applied: ${applied.length}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
