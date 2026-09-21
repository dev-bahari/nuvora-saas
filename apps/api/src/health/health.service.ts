import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

const { Pool } = pg;

@Injectable()
export class HealthService implements OnModuleDestroy {
  private pool: pg.Pool;

  constructor() {
    const connectionString =
      process.env['DATABASE_URL'] ??
      'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_dev';
    this.pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 2000,
    });
  }

  async checkDatabase(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end().catch(() => {});
  }
}
