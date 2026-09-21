import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
  CustomDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission, RequestContext } from './tenant-context.js';

export const PERMISSION_KEY = 'required_permission';

/**
 * Decorator to enforce that the active tenant context possesses a specific permission.
 */
export const RequirePermission = (permission: Permission): CustomDecorator<string> =>
  SetMetadata(PERMISSION_KEY, permission);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ context?: RequestContext }>();
    const ctx = request.context;

    if (!ctx || !ctx.permissions) {
      throw new ForbiddenException('Tenant context not established on request');
    }

    if (!ctx.permissions.includes(requiredPermission)) {
      throw new ForbiddenException(`Missing required permission: ${requiredPermission}`);
    }

    return true;
  }
}
