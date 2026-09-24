import { describe, expect, it } from 'vitest';
import { DianSecretService } from '../src/dian/secrets/dian-secret.service.js';

describe('DianSecretService', () => {
  it('round-trips PFX bytes without storing plaintext', () => {
    const service = new DianSecretService('a'.repeat(64));
    const sealed = service.seal(Buffer.from('pfx-private-material'));
    expect(sealed.ciphertext.equals(Buffer.from('pfx-private-material'))).toBe(false);
    expect(service.open(sealed).toString()).toBe('pfx-private-material');
  });
});
