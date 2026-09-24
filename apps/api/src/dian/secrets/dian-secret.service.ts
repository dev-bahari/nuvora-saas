import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';

export interface SealedSecret { ciphertext: Buffer; iv: Buffer; authTag: Buffer; }

@Injectable()
export class DianSecretService {
  private readonly key: Buffer;

  constructor(@Optional() @Inject('DIAN_SECRETS_KEY') key = process.env['DIAN_SECRETS_KEY'] ?? (process.env['NODE_ENV'] === 'test' ? '0'.repeat(64) : undefined)) {
    if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error('DIAN_SECRETS_KEY must be 32 bytes encoded as hex');
    this.key = Buffer.from(key, 'hex');
  }

  seal(value: Buffer): SealedSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    return { ciphertext: Buffer.concat([cipher.update(value), cipher.final()]), iv, authTag: cipher.getAuthTag() };
  }

  open(secret: SealedSecret): Buffer {
    const decipher = createDecipheriv('aes-256-gcm', this.key, secret.iv);
    decipher.setAuthTag(secret.authTag);
    return Buffer.concat([decipher.update(secret.ciphertext), decipher.final()]);
  }
}
