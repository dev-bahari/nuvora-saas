import { Injectable } from '@nestjs/common';
import type { DbTx } from '../tenancy/tenant-transaction.js';

export interface ReservedNumber {
  prefix: string;
  number: number;
}

@Injectable()
export class NumberingService {
  /**
   * Reserves the next number in the tenant's document sequence.
   * Must be called inside a withTenant() transaction — the UPDATE takes a
   * row-level exclusive lock, serializing concurrent reservations automatically.
   */
  async reserveNextNumber(
    tx: DbTx,
    tenantId: string,
    documentType: string,
  ): Promise<ReservedNumber> {
    // Auto-create sequence on first use
    await tx.query(
      `INSERT INTO document_sequences (tenant_id, document_type)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id, document_type) DO NOTHING`,
      [tenantId, documentType],
    );

    const { rows } = await tx.query<{ prefix: string; current_number: string }>(
      `UPDATE document_sequences
       SET current_number = current_number + 1, updated_at = NOW()
       WHERE tenant_id = $1 AND document_type = $2 AND is_active = TRUE
       RETURNING prefix, current_number`,
      [tenantId, documentType],
    );

    if (!rows[0]) {
      throw new Error(`No active numbering sequence for document type "${documentType}"`);
    }

    return {
      prefix: rows[0].prefix,
      number: parseInt(rows[0].current_number, 10),
    };
  }
}
