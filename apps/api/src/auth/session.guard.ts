import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import crypto from 'node:crypto';
import pg from 'pg';
import type { FastifyRequest } from 'fastify';
import type { RequestContext } from '../tenancy/tenant-context.js';
import { PermissionsService } from '../tenancy/permissions.service.js';

const COOKIE_NAME = 'nuvora_session';

function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1] ?? '') : undefined;
}

@Injectable()
export class SessionGuard implements CanActivate {
  private pool: pg.Pool;

  constructor(private readonly permissionsService: PermissionsService) {
    this.pool = new pg.Pool({
      connectionString:
        process.env['DATABASE_URL'] ??
        'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_dev',
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest & { context?: RequestContext }>();

    const rawToken =
      parseCookie(req.headers['cookie'], COOKIE_NAME) ??
      (req.headers['authorization'] as string | undefined)?.replace('Bearer ', '');

    if (!rawToken) throw new UnauthorizedException('No session');

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const res = await this.pool.query<{ user_id: string; tenant_id: string; expires_at: Date }>(
      `SELECT user_id, tenant_id, expires_at FROM sessions WHERE session_token_hash = $1`,
      [tokenHash],
    );

    const row = res.rows[0];
    if (!row || new Date(row.expires_at) <= new Date()) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    const permissions = await this.permissionsService.getEffectivePermissions(
      row.tenant_id,
      row.user_id,
      this.pool,
    );

    (req as FastifyRequest & { context: RequestContext }).context = {
      userId: row.user_id,
      tenantId: row.tenant_id,
      permissions,
      requestId: crypto.randomUUID(),
    };

    return true;
  }
}
