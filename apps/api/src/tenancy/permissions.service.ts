import { Injectable, Optional } from '@nestjs/common';
import pg from 'pg';
import type { Permission } from './tenant-context.js';

@Injectable()
export class PermissionsService {
  constructor(@Optional() private readonly pool?: pg.Pool) {}

  /**
   * Resolves effective permissions for a user within a specific tenant by querying
   * PostgreSQL active membership, role permissions, and positive/negative overrides.
   */
  async getEffectivePermissions(
    tenantId: string,
    userId: string,
    executor?: pg.Pool | pg.PoolClient,
  ): Promise<Permission[]> {
    const client = executor ?? this.pool;
    if (!client) {
      return [];
    }

    const result = await client.query<{ permission_name: Permission }>(
      `SELECT permission_name FROM get_effective_permissions($1, $2)`,
      [tenantId, userId],
    );

    return result.rows.map((row) => row.permission_name);
  }
}
