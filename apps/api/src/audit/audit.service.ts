import { Injectable } from '@nestjs/common';
import type { DbTx } from '../tenancy/tenant-transaction.js';

export interface AuditEventInput {
  tenantId: string;
  documentId?: string | undefined;
  eventType: string;
  actorId?: string | undefined;
  requestId?: string | undefined;
  payload?: Record<string, unknown> | undefined;
}

@Injectable()
export class AuditService {
  async append(tx: DbTx, event: AuditEventInput): Promise<void> {
    await tx.query(
      `INSERT INTO audit_events
         (tenant_id, document_id, event_type, actor_id, request_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        event.tenantId,
        event.documentId ?? null,
        event.eventType,
        event.actorId ?? null,
        event.requestId ?? null,
        JSON.stringify(event.payload ?? {}),
      ],
    );
  }
}
