import { describe, expect, it } from 'vitest';
import { PermissionGuard } from '../src/tenancy/permission.guard.js';

describe('PermissionGuard', () => {
  it('honors the effective permissions established by SessionGuard', async () => {
    const guard = new PermissionGuard(
      { getAllAndOverride: () => 'tenant.settings' } as never,
      { getEffectivePermissions: async () => [] } as never,
    );
    const request = {
      context: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        requestId: 'request-1',
        permissions: ['tenant.settings'],
      },
    };
    const executionContext = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    };

    await expect(guard.canActivate(executionContext as never)).resolves.toBe(true);
  });
});
