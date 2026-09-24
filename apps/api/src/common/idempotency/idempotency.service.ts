import crypto from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import type { DbTx } from '../../tenancy/tenant-transaction.js';

// ponytail: idempotency as a plain service; promote to NestJS interceptor when
// more than 2 endpoints need it

export type IdempotencyStatus = 'IN_FLIGHT' | 'COMPLETED' | 'FAILED';

interface IdempotencyRow {
  id: string;
  status: IdempotencyStatus;
  request_hash: string;
  response_body: unknown;
  inserted: boolean;
}

export class IdempotencyService {
  static hashKey(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  static hashBody(body: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  }

  /**
   * Tries to begin an idempotent operation.
   * Returns null → proceed (new or failed key).
   * Returns response body → replay (COMPLETED).
   * Throws ConflictException → same key, different body (misuse).
   * Throws ConflictException → same key still IN_FLIGHT (duplicate concurrent call).
   */
  static async begin(
    tx: DbTx,
    tenantId: string,
    operation: string,
    idempotencyKey: string,
    requestBody: unknown,
    ttlSeconds = 86_400,
  ): Promise<unknown | null> {
    const keyHash = this.hashKey(`${tenantId}:${operation}:${idempotencyKey}`);
    const requestHash = this.hashBody(requestBody);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const { rows } = await tx.query<IdempotencyRow>(
      `INSERT INTO idempotency_keys
         (tenant_id, key_hash, operation, request_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, key_hash) DO UPDATE
         SET updated_at = NOW()
       RETURNING id, status, request_hash, response_body, (xmax = 0) AS inserted`,
      [tenantId, keyHash, operation, requestHash, expiresAt],
    );

    const row = rows[0];
    if (!row) throw new Error('Idempotency insert failed');
    if (row.inserted) return null;

    if (row.status === 'COMPLETED') {
      if (row.request_hash !== requestHash) {
        throw new ConflictException(
          'Idempotency key already used with a different request body',
        );
      }
      return row.response_body;
    }

    if (row.status === 'IN_FLIGHT') {
      if (row.request_hash !== requestHash) {
        throw new ConflictException(
          'Idempotency key already used with a different request body',
        );
      }
      throw new ConflictException('Duplicate concurrent request — retry after the first completes');
    }

    return null;
  }

  static async complete(
    tx: DbTx,
    tenantId: string,
    operation: string,
    idempotencyKey: string,
    responseBody: unknown,
    documentId?: string,
  ): Promise<void> {
    const keyHash = this.hashKey(`${tenantId}:${operation}:${idempotencyKey}`);
    await tx.query(
      `UPDATE idempotency_keys
       SET status = 'COMPLETED', response_body = $1, document_id = $2, updated_at = NOW()
       WHERE tenant_id = $3 AND key_hash = $4`,
      [JSON.stringify(responseBody), documentId ?? null, tenantId, keyHash],
    );
  }

  static async fail(
    tx: DbTx,
    tenantId: string,
    operation: string,
    idempotencyKey: string,
  ): Promise<void> {
    const keyHash = this.hashKey(`${tenantId}:${operation}:${idempotencyKey}`);
    await tx.query(
      `UPDATE idempotency_keys
       SET status = 'FAILED', updated_at = NOW()
       WHERE tenant_id = $1 AND key_hash = $2`,
      [tenantId, keyHash],
    );
  }
}
