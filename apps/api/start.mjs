// Railway entry point: run migrations then start API
import pg from 'pg';
import { runMigrations } from '../../db/migrate.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

console.log('[empyra] Running database migrations...');
await runMigrations(pool);
await pool.end();

console.log('[empyra] Migrations complete. Starting API...');
await import('./dist/main.js');
