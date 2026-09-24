import { describe, expect, it } from 'vitest';
import { DianProviderSelectorService } from '../src/dian/dian-provider-selector.service.js';
import { MockDianProvider } from '../src/dian/mock-dian.provider.js';

describe('DianProviderSelectorService', () => {
  it('denies direct DIAN for a tenant other than the configured pilot', () => {
    const mock = new MockDianProvider();
    const direct = {} as never;
    const selector = new DianProviderSelectorService('pilot-tenant', mock, direct);

    expect(() => selector.forTenant('other-tenant', 'DIRECT_HABILITACION')).toThrow(
      'Direct DIAN is restricted to the pilot tenant',
    );
  });

  it('uses mock DIAN when direct mode is not requested', () => {
    const mock = new MockDianProvider();
    const selector = new DianProviderSelectorService('pilot-tenant', mock, {} as never);

    expect(selector.forTenant('other-tenant', 'MOCK')).toBe(mock);
  });
});
