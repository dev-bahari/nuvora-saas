import type { Pool, PoolClient } from 'pg';
import type { RequestContext } from './tenant-context.js';

export type DbTx = PoolClient;

/**
 * Executes a callback within a PostgreSQL transaction where `app.tenant_id` and `app.user_id`
 * are set locally for the transaction duration (SET LOCAL / set_config is_local=true).
 *
 * This enforces Row Level Security (RLS) and prevents cross-tenant access.
 */
export async function withTenant<T>(
  pool: Pool,
  ctx: RequestContext,
  work: (tx: DbTx) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Switch to non-superuser application role so RLS is strictly enforced
    await client.query(`SET LOCAL ROLE nuvora_app_user`);

    // set_config with third parameter 'true' makes the setting local to the current transaction (equivalent to SET LOCAL)
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [ctx.tenantId]);
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [ctx.userId]);

    const result = await work(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback error if connection was dropped
    }
    throw error;
  } finally {
    client.release();
  }
}
