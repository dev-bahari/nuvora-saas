import { ForbiddenException, Injectable } from '@nestjs/common';
import type { FiscalAuthorityProvider, DianMode } from './fiscal-authority.provider.js';
import { MockDianProvider } from './mock-dian.provider.js';

@Injectable()
export class DianProviderSelectorService {
  constructor(
    private readonly pilotTenantId: string | undefined,
    private readonly mock: MockDianProvider,
    private readonly direct: FiscalAuthorityProvider,
  ) {}

  forTenant(tenantId: string, mode: DianMode): FiscalAuthorityProvider {
    if (mode === 'MOCK') return this.mock;
    if (!this.pilotTenantId || tenantId !== this.pilotTenantId) {
      throw new ForbiddenException('Direct DIAN is restricted to the pilot tenant');
    }
    return this.direct;
  }
}
