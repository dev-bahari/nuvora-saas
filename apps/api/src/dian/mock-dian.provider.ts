import { Injectable } from '@nestjs/common';

export type DianOutcome = 'ACCEPTED' | 'REJECTED' | 'PENDING';

export interface DianSubmissionResult {
  outcome: DianOutcome;
  trackingId: string;
  rejectionReason?: string | undefined;
}

/**
 * MockDianProvider — deterministic stub for local development and tests.
 * Override `scenarioOverrides` per test to simulate reject/pending paths.
 */
@Injectable()
export class MockDianProvider {
  private scenarioOverrides = new Map<string, DianOutcome>();

  setScenario(documentId: string, outcome: DianOutcome): void {
    this.scenarioOverrides.set(documentId, outcome);
  }

  clearScenarios(): void {
    this.scenarioOverrides.clear();
  }

  async submit(documentId: string): Promise<DianSubmissionResult> {
    const outcome = this.scenarioOverrides.get(documentId) ?? 'ACCEPTED';
    const trackingId = `MOCK-${documentId.slice(0, 8).toUpperCase()}`;
    const result: DianSubmissionResult = { outcome, trackingId };
    if (outcome === 'REJECTED') {
      result.rejectionReason = 'Mock DIAN rechazo: datos de prueba inválidos';
    }
    return result;
  }

  async pollStatus(trackingId: string): Promise<DianOutcome> {
    // Mock poll always resolves PENDING → ACCEPTED after one call
    void trackingId;
    return 'ACCEPTED';
  }
}
