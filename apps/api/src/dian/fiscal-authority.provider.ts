import type { DianOutcome, DianSubmissionResult } from './mock-dian.provider.js';

export type DianMode = 'MOCK' | 'DIRECT_HABILITACION';

export interface FiscalAuthorityProvider {
  submit(documentId: string): Promise<DianSubmissionResult>;
  pollStatus(trackingId: string): Promise<DianOutcome>;
}
