import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
  CustomDecorator,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission, RequestContext } from './tenant-context.js';
import { PermissionsService } from './permissions.service.js';

export const PERMISSION_KEY = 'required_permission';

/**
 * Decorator to enforce that the active tenant context possesses a specific permission.
 */
export const RequirePermission = (permission: Permission): CustomDecorator<string> =>
  SetMetadata(PERMISSION_KEY, permission);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly permissionsService?: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ context?: RequestContext }>();
    const ctx = request.context;

    if (!ctx || !ctx.tenantId || !ctx.userId) {
      throw new ForbiddenException('Tenant context not established on request');
    }

    // SessionGuard resolves effective permissions from the active membership on every request.
    // Prefer that request-bound value: PermissionsService may not have a pool when Nest creates
    // the global guard, whereas the session guard always supplies one.
    if (ctx.permissions.includes(requiredPermission)) {
      return true;
    }

    // Retain a database lookup for callers that establish a tenant context without SessionGuard.
    if (this.permissionsService) {
      const effective = await this.permissionsService.getEffectivePermissions(
        ctx.tenantId,
        ctx.userId,
      );
      if (!effective.includes(requiredPermission)) {
        throw new ForbiddenException(`Missing required permission: ${requiredPermission}`);
      }
      return true;
    }

    // Fallback if no database service is injected (e.g., isolated controller unit tests)
    if (!ctx.permissions || !ctx.permissions.includes(requiredPermission)) {
      throw new ForbiddenException(`Missing required permission: ${requiredPermission}`);
    }

    return true;
  }
}
