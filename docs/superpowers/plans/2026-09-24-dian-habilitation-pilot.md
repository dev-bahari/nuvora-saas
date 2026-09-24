# DIAN Habilitation Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable only David Caro Morales' pilot tenant to submit DIAN habilitation documents safely and record the real result.

**Architecture:** Keep fiscal orchestration provider-neutral through one DIAN port. A direct adapter signs, packages and sends the immutable document outside the fiscal transaction through the existing outbox; a tenant-gated selector leaves every non-pilot tenant on mock. Secrets are stored encrypted and no document or audit record is modified after issuance.

**Tech Stack:** Node.js 24, TypeScript, NestJS/Fastify, PostgreSQL 16/RLS, `pg`, `node:crypto`, DIAN UBL 2.1/SOAP/XAdES, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-dian-habilitation-pilot-design.md`

## Global Constraints

- DIAN direct mode is enabled only when the configured pilot tenant ID exactly matches the current tenant ID.
- Currency and fiscal hashes use decimal strings; no `parseFloat` or JavaScript floating point in fiscal calculation.
- Every tenant query runs inside `withTenant` with RLS forced.
- Issued documents, audit entries and submitted XML/ZIP artifacts are append-only.
- The job payload is `{ tenantId, requestId, entityId, schemaVersion, idempotencyKey, payload }`.
- Certificate material, PIN, PFX password and technical key never enter a response, log, audit payload or Git.
- DIAN sandbox acceptance is external evidence; offline tests must never pretend it was performed.

## Review Focus

- A tenant configured as direct but not equal to the pilot ID is rejected before secret decryption or network access.
- A timeout after DIAN receives a ZIP reconciles through status lookup rather than resending a fiscal document.
- A PFX with only an end-entity certificate fails clearly when DIAN-required CA chain material is absent.
- A SOAP rejection preserves the DIAN error and keeps the immutable submitted payload for diagnosis.
- A retry cannot issue a second number, change CUFE/CUDE, or submit a completed outbox item again.

---

### Task 1: Define the DIAN boundary and pilot selection

**Files:**
- Create: `apps/api/src/dian/fiscal-authority.provider.ts`
- Create: `apps/api/src/dian/dian-provider-selector.service.ts`
- Modify: `apps/api/src/dian/mock-dian.provider.ts`
- Modify: `apps/api/src/dian/dian.module.ts`
- Modify: `apps/api/src/documents/issue-document.service.ts`
- Test: `apps/api/test/dian-provider-selector.spec.ts`

**Interfaces:**
- Produces `FiscalAuthorityProvider.submit(input: DianSubmission): Promise<DianSubmissionResult>` and `poll(input: DianStatusQuery): Promise<DianSubmissionResult>`.
- `DianSubmission` has `tenantId`, `documentId`, `idempotencyKey`, `environment`, `testSetId`, and `zipBase64`; it has no raw secret fields.

- [ ] **Step 1: Write the failing selector tests**

```ts
it('denies DIRECT before resolver access for a non-pilot tenant', async () => {
  await expect(selector.forTenant(nonPilotDirectTenant)).rejects.toThrow('Direct DIAN is restricted to the pilot tenant');
  expect(secretResolver.load).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter api test -- dian-provider-selector`

Expected: FAIL because `DianProviderSelectorService` does not exist.

- [ ] **Step 3: Implement the smallest port and selector**

```ts
export const FISCAL_AUTHORITY_PROVIDER = Symbol('FISCAL_AUTHORITY_PROVIDER');

async forTenant(tenantId: string, mode: 'MOCK' | 'DIRECT_HABILITACION') {
  if (mode === 'DIRECT_HABILITACION' && tenantId !== this.pilotTenantId) {
    throw new ForbiddenException('Direct DIAN is restricted to the pilot tenant');
  }
  return mode === 'DIRECT_HABILITACION' ? this.direct : this.mock;
}
```

Replace direct imports of `MockDianProvider` in issuance with the selector. Preserve mock behavior for all existing tests.

- [ ] **Step 4: Run focused and existing issuance tests**

Run: `pnpm --filter api test -- dian-provider-selector issue-workflow`

Expected: PASS, with no test requiring a network connection.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/dian apps/api/src/documents/issue-document.service.ts apps/api/test/dian-provider-selector.spec.ts
git commit -m "feat: add pilot-gated DIAN provider port"
```

### Task 2: Store fiscal credentials safely and preserve RLS

**Files:**
- Create: `db/migrations/0014_dian_credentials.sql`
- Create: `apps/api/src/dian/secrets/dian-secret.service.ts`
- Create: `apps/api/src/dian/secrets/dian-credentials.repository.ts`
- Modify: `apps/api/src/settings/settings.service.ts`
- Test: `tests/integration/dian-credentials.spec.ts`

**Interfaces:**
- Produces `DianSecretService.seal(plain: Buffer): Promise<EncryptedSecret>` and `open(secret: EncryptedSecret): Promise<Buffer>` using authenticated encryption.
- Produces `DianCredentialsRepository.loadForSubmission(ctx): Promise<DianCredentials>`; callers never receive credentials through settings reads.

- [ ] **Step 1: Write failing security and isolation tests**

```ts
it('stores encrypted PFX bytes and never returns its password from settings', async () => {
  await repository.save(ctxA, fixtureCredentials);
  expect(await settings.get(ctxA)).not.toHaveProperty('dianSoftwarePin');
  expect(await rawCiphertext()).not.toContain(fixtureCredentials.pfx.toString('base64'));
});

it('does not reveal pilot credentials to another tenant', async () => {
  await expect(repository.loadForSubmission(ctxB)).rejects.toThrow();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec vitest run tests/integration/dian-credentials.spec.ts`

Expected: FAIL because the credentials relation and repository do not exist.

- [ ] **Step 3: Implement migration and AES-256-GCM envelope**

```ts
const cipher = createCipheriv('aes-256-gcm', this.key, iv);
const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
return { ciphertext, iv, authTag: cipher.getAuthTag(), keyVersion: 1 };
```

Create a tenant-scoped `dian_credentials` table with ciphertext, IV, auth tag,
certificate fingerprint, expiry, software metadata and `test_set_id`. Enable and
force RLS. Read the 32-byte master key only from `DIAN_SECRETS_KEY`; fail startup
in direct mode when it is absent. Remove PIN and technical-key writes from the
general settings API.

- [ ] **Step 4: Run migration and isolation tests**

Run: `pnpm db:migrate && pnpm exec vitest run tests/integration/dian-credentials.spec.ts tests/integration/tenant-isolation.spec.ts`

Expected: PASS with ciphertext only in the database and denied cross-tenant access.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0014_dian_credentials.sql apps/api/src/dian/secrets apps/api/src/settings/settings.service.ts tests/integration/dian-credentials.spec.ts
git commit -m "feat: protect tenant DIAN credentials"
```

### Task 3: Produce canonical UBL and signed fiscal packages

**Files:**
- Create: `apps/api/src/dian/ubl/dian-document-renderer.service.ts`
- Create: `apps/api/src/dian/signing/xades-signer.service.ts`
- Create: `apps/api/src/dian/signing/pfx-chain-loader.service.ts`
- Create: `tests/fixtures/dian/invoice-minimal.json`
- Create: `apps/api/test/xades-signer.spec.ts`
- Modify: `apps/api/src/artifacts/xml-generator.service.ts`
- Modify: `apps/api/src/artifacts/cufe.service.ts`

**Interfaces:**
- Produces `XadesSigner.sign(unsignedXml: Buffer, credentials: DianCredentials): Promise<Buffer>`.
- Produces `DianDocumentRenderer.render(document: FiscalDocumentSnapshot): Promise<Buffer>`.

- [ ] **Step 1: Write the failing rendering and signing tests**

```ts
it('produces a signed Invoice without a placeholder and with the certificate chain', async () => {
  const signed = await signer.sign(await renderer.render(fixture), testCredentials);
  expect(signed.toString()).toContain('<ds:SignatureValue>');
  expect(signed.toString()).toContain('<xades:SigningCertificate>');
  expect(signed.toString()).not.toContain('placeholder');
});

it('rejects a certificate bundle without the required CA chain', async () => {
  await expect(signer.sign(unsignedXml, endEntityOnly)).rejects.toThrow('certificate chain');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter api test -- xades-signer`

Expected: FAIL because no signer or chain loader exists.

- [ ] **Step 3: Implement canonical signing and ZIP creation**

Use a maintained XML canonicalization/signature package only where Node standard
library cannot implement XMLDSig/XAdES safely. Pin it in `apps/api/package.json`.
Load the PFX and chain in memory, validate its expiry and key usage, construct the
DIAN XAdES policy fields, validate the signed XML against versioned UBL fixtures,
and package exactly one XML file into a ZIP. Replace all fiscal `parseFloat`
formatting in the touched generation and CUFE paths with decimal string helpers.

- [ ] **Step 4: Run signing, CUFE and XML tests**

Run: `pnpm --filter api test -- xades-signer cufe xml-generator`

Expected: PASS; no real certificate or DIAN call is used.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/dian/ubl apps/api/src/dian/signing apps/api/src/artifacts tests/fixtures/dian apps/api/test/xades-signer.spec.ts
git commit -m "feat: sign DIAN UBL documents with XAdES"
```

### Task 4: Implement DIAN SOAP habilitation and response translation

**Files:**
- Create: `apps/api/src/dian/direct/direct-dian.provider.ts`
- Create: `apps/api/src/dian/direct/dian-soap-client.ts`
- Create: `apps/api/src/dian/direct/dian-response-parser.ts`
- Create: `apps/api/test/direct-dian.provider.spec.ts`
- Create: `tests/fixtures/dian/soap-accepted.xml`
- Create: `tests/fixtures/dian/soap-rejected.xml`
- Create: `tests/fixtures/dian/soap-pending.xml`

**Interfaces:**
- Produces `DirectDianProvider` implementing `FiscalAuthorityProvider`.
- `DianSoapClient.sendTestSet(zipBase64, testSetId)` and `sendBillSync(zipBase64)` return parsed DIAN responses; requests have bounded timeout.

- [ ] **Step 1: Write failing SOAP translation tests**

```ts
it('sends the test set operation and maps an accepted response', async () => {
  const result = await provider.submit(habilitationSubmission);
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('WcfDianCustomerServices.svc'), expect.any(Object));
  expect(result).toMatchObject({ outcome: 'ACCEPTED' });
});

it('keeps DIAN validation messages on rejection and returns PENDING after timeout', async () => {
  await expect(provider.submit(rejectedSubmission)).resolves.toMatchObject({ outcome: 'REJECTED' });
  await expect(provider.submit(timeoutSubmission)).resolves.toMatchObject({ outcome: 'PENDING' });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter api test -- direct-dian.provider`

Expected: FAIL because the direct provider does not exist.

- [ ] **Step 3: Implement the minimal SOAP client**

Build the SOAP envelope and WS-Security signature using the in-memory certificate.
Use `SendTestSetAsync` only for `HABILITACION` submissions containing `testSetId`;
use production operations only when the selector admits a separately configured
production state. Parse DIAN SOAP faults and application responses into stable
outcomes. Timeout/network ambiguity returns `PENDING`, never `REJECTED`.

- [ ] **Step 4: Run direct adapter tests**

Run: `pnpm --filter api test -- direct-dian.provider`

Expected: PASS with accepted, rejected, pending and SOAP-fault fixtures.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/dian/direct apps/api/test/direct-dian.provider.spec.ts tests/fixtures/dian
git commit -m "feat: submit DIAN habilitation documents"
```

### Task 5: Make submission durable, idempotent and visible

**Files:**
- Create: `apps/api/src/dian/dian-submission-worker.service.ts`
- Create: `apps/api/src/jobs/dian-jobs.module.ts`
- Modify: `apps/api/src/documents/issue-document.service.ts`
- Modify: `apps/api/src/documents/credit-notes/credit-notes.service.ts`
- Modify: `db/migrations/0007_submissions_jobs.sql`
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/api/src/artifacts/artifacts.service.ts`
- Create: `tests/integration/dian-submission-worker.spec.ts`

**Interfaces:**
- Produces `DianSubmissionWorker.process(ctx, outboxId): Promise<void>`.
- Outbox payload follows the global envelope and terminal result is persisted once.

- [ ] **Step 1: Write failing worker tests**

```ts
it('reconciles an uncertain transmission before retrying', async () => {
  await worker.process(ctx, pendingOutboxId);
  expect(provider.poll).toHaveBeenCalledOnce();
  expect(provider.submit).not.toHaveBeenCalled();
});

it('does not process a completed outbox row twice', async () => {
  await worker.process(ctx, completedOutboxId);
  expect(provider.submit).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm exec vitest run tests/integration/dian-submission-worker.spec.ts`

Expected: FAIL because issuance still submits synchronously.

- [ ] **Step 3: Move I/O after the transaction**

Keep number reservation, status transition, audit event and outbox insertion in
one tenant transaction. Install `pg-boss` and publish only after the transaction
commits using the standard job envelope. Remove synchronous mock/direct submission
from issuance. The worker locks one due row, restores tenant context, loads
immutable snapshot, stores signed XML/ZIP/response artifacts with hashes, and
updates only permitted submission state. Retry bounded transient failures;
persist a visible terminal failure after `max_attempts`.

- [ ] **Step 4: Run worker and workflow tests**

Run: `pnpm exec vitest run tests/integration/dian-submission-worker.spec.ts tests/integration/issue-workflow.spec.ts tests/integration/adjustments.spec.ts`

Expected: PASS with no duplicate number or network submission.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/dian/dian-submission-worker.service.ts apps/api/src/jobs apps/api/src/documents db/migrations/0007_submissions_jobs.sql apps/api/src/artifacts tests/integration/dian-submission-worker.spec.ts
git commit -m "feat: process DIAN submissions through durable outbox"
```

### Task 6: Add the pilot operator flow, runbook and gates

**Files:**
- Modify: `apps/api/src/settings/settings.controller.ts`
- Modify: `apps/api/src/settings/settings.service.ts`
- Modify: `apps/web/app/app/settings/page.tsx`
- Create: `apps/web/app/app/settings/dian/page.tsx`
- Create: `docs/runbooks/dian-habilitacion.md`
- Modify: `docs/coordination/decisions.md`
- Modify: `docs/coordination/implementation-status.md`
- Test: `tests/e2e/dian-habilitation.spec.ts`

**Interfaces:**
- Produces a pilot-only DIAN configuration action that accepts certificate upload and secret inputs once, then returns masked metadata and submission progress.

- [ ] **Step 1: Write failing route and UI tests**

```ts
test('non-pilot tenant cannot open DIAN direct configuration', async ({ page }) => {
  await page.goto('/app/settings/dian');
  await expect(page.getByText('Available only for the pilot tenant')).toBeVisible();
});

test('the configured PIN is never rendered after save', async ({ page }) => {
  await page.getByLabel('Software PIN').fill('test-secret');
  await page.getByRole('button', { name: 'Guardar configuración DIAN' }).click();
  await expect(page.getByText('test-secret')).toHaveCount(0);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm test:e2e -- dian-habilitation`

Expected: FAIL because the protected DIAN settings flow does not exist.

- [ ] **Step 3: Implement the smallest secure operator flow**

Expose only masked certificate fingerprint, expiration, environment, test-set
identifier, current DIAN outcome and rejection detail. Require an explicit
confirmation dialog before starting each submission. Create the runbook with the
manual DIAN portal steps, secret rotation, certificate chain validation, expected
set source, sandbox evidence capture and production activation checklist.

- [ ] **Step 4: Run all offline quality gates**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm test:e2e && pnpm build`

Expected: PASS. If live credentials are absent, record sandbox execution as `NOT_VERIFIABLE`; do not report DIAN acceptance.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/settings apps/web/app/app/settings docs/runbooks/dian-habilitacion.md docs/coordination tests/e2e/dian-habilitation.spec.ts
git commit -m "feat: add DIAN pilot habilitation operator flow"
```

## Final external acceptance

After offline gates pass, David uploads a newly rotated certificate bundle and
credentials through the pilot-only settings flow. The operator creates exactly
the documents currently required by the DIAN portal, submits them through the
test-set flow and preserves DIAN’s response artifacts. The team reports
`HABILITADO` only when the DIAN portal itself shows that status.
