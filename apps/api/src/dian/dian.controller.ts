import { Body, BadRequestException, Controller, ForbiddenException, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';
import { DianCredentialsService, type DianCredentialInput } from './dian-credentials.service.js';

type AuthRequest = FastifyRequest & { context: RequestContext };
@Controller('settings/dian')
@UseGuards(SessionGuard, PermissionGuard)
export class DianController {
  constructor(private readonly credentials: DianCredentialsService) {}
  @Get() @RequirePermission('dian.configure') get(@Req() req: AuthRequest) {
    this.requirePilot(req.context);
    return this.credentials.getStatus(req.context);
  }
  @Put('credentials') @RequirePermission('dian.configure') async save(@Req() req: AuthRequest, @Body() body: DianCredentialInput) {
    this.requirePilot(req.context);
    return this.credentials.save(req.context, req.isMultipart() ? await multipartCredentials(req) : body);
  }

  private requirePilot(ctx: RequestContext) {
    if (!process.env['DIAN_PILOT_TENANT_ID'] || ctx.tenantId !== process.env['DIAN_PILOT_TENANT_ID']) {
      throw new ForbiddenException('La configuración DIAN directa está restringida al tenant piloto');
    }
  }
}

async function multipartCredentials(req: AuthRequest): Promise<DianCredentialInput> {
  const fields: Record<string, string> = {};
  for await (const part of req.parts()) {
    if (part.type === 'file') {
      if (part.fieldname === 'pfx') fields['pfxBase64'] = (await part.toBuffer()).toString('base64');
      else if (part.fieldname === 'caChain') fields['caChainBase64'] = (await part.toBuffer()).toString('base64');
      else throw new BadRequestException('Archivo de credencial DIAN no reconocido');
    } else {
      fields[part.fieldname] = String(part.value);
    }
  }
  return fields as unknown as DianCredentialInput;
}
