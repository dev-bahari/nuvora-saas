# Partial Tasks Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close partial Tasks 1, 3, and 5–15 with reproducible migrations, real tests, complete fiscal workflows, pilot-only direct DIAN, and green quality gates.

**Architecture:** Repair the shared database and contract foundation first, then complete fiscal processing in dependency order, finish operator UI, and close with DIAN pilot and operational hardening. Preserve the modular monolith, tenant transactions, PostgreSQL RLS, immutable fiscal records, and provider ports.

**Tech Stack:** Node.js 24, TypeScript, pnpm 12.5.1, NestJS/Fastify, Next.js App Router, PostgreSQL 16/RLS, `pg-boss`, Playwright, MinIO/S3, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-partial-tasks-correction-design.md`

## Global Constraints

- DIAN `DIRECT` is allowed only for the explicitly configured pilot tenant; every other tenant remains `MOCK`.
- Money stays PostgreSQL `NUMERIC` and decimal strings/Decimal in TypeScript; never JavaScript floating point.
- Every tenant query runs inside `withTenant`; PostgreSQL RLS remains mandatory.
- Issued documents, artifacts, audit entries, and automatic journal entries are immutable.
- Jobs use `{ tenantId, requestId, entityId, schemaVersion, idempotencyKey, payload }`.
- Fiscal status and delivery status remain independent.
- Do not add microservices, Kubernetes, distributed cache, or unrelated ERP scope.
- A test command that only prints text is a failure, not evidence.

## Review Focus

- Incremental migration from schema 0005 must produce the same schema as a clean migration through 0013.
- A non-pilot tenant configured as `DIRECT` must be rejected before any signing or network call.
- A worker crash after transmission but before persistence must reconcile instead of transmitting twice.
- Cross-tenant IDs and signed URLs must return no data even when the identifier is valid.
- Restore into an empty database must preserve hashes, counts, RLS, and fiscal immutability.

---

### Task 1: Restore the repository quality baseline (T1)

**Files:**
- Modify: `apps/web/app/app/invoices/new/page.tsx`
- Modify: `packages/contracts/src/documents.ts`
- Modify: `apps/api/src/artifacts/artifacts.module.ts`
- Modify: `apps/api/src/artifacts/artifacts.service.ts`
- Test: `apps/api/test/health.spec.ts`

**Interfaces:**
- Produces: `DraftDocument` with optional `numberPrefix`, `documentNumber`, `cufe`, and `cude` string fields used by issuance, accounting, XML, and PDF.

- [ ] Add a type contract test constructing both a draft without fiscal identifiers and an issued document with all four identifiers; run `pnpm typecheck` and preserve the current missing-property failure.
- [ ] Add a Nest testing-module assertion that resolves `ArtifactsService`; run `pnpm --filter api test` and preserve the current unresolved dependency failure.
- [ ] Extend `DraftDocument` only with the persisted fiscal identifiers, import runtime providers instead of type-only imports, and export/import the provider modules required by `ArtifactsService`.
- [ ] Replace the internal invoice anchor with `next/link`; run `pnpm lint`, `pnpm typecheck`, and `pnpm test` and require code 0.
- [ ] Commit with `fix: restore repository quality baseline`.

### Task 2: Make migrations clean and incremental (T7–T13 foundation)

**Files:**
- Modify: `db/migrate.ts`
- Modify: `db/migrations/0006_numbering_idempotency.sql`
- Modify: `db/migrations/0007_submissions_jobs.sql`
- Modify: `db/migrations/0008_artifacts.sql`
- Modify: `db/migrations/0009_adjustments.sql`
- Modify: `db/migrations/0010_accounting.sql`
- Modify: `db/migrations/0011_notifications.sql`
- Modify: `db/migrations/0012_tenant_settings.sql`
- Modify: `db/migrations/0013_cufe_technical_key.sql`
- Create: `tests/integration/migrations.spec.ts`

**Interfaces:**
- Produces: `runMigrations(options?: { pool?: Pool; directory?: string }): Promise<void>`.

- [ ] Write a test that creates two temporary databases, migrates one from empty and the other through 0005 then 0013, and compares tables, columns, constraints, indexes, policies, and permissions.
- [ ] Run `pnpm exec vitest run tests/integration/migrations.spec.ts`; expect failure from the 0006 permission insert and the current positional `runMigrations` call.
- [ ] Change the migration runner to the options object, update callers, and make every permission insert include the required `module` value and conflict target.
- [ ] Make migrations transactional and rerunnable without silently accepting a partially applied file; record each filename only after its transaction commits.
- [ ] Run the migration test plus `pnpm db:migrate`; require clean and incremental schemas to match.
- [ ] Commit with `fix: make fiscal migrations reproducible`.

### Task 3: Replace simulated test commands with real suites (T3, T5, T6)

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`
- Modify: `playwright.config.ts` or create it if absent
- Modify: `tests/e2e/login-onboarding.spec.ts`
- Modify: `tests/e2e/master-data.spec.ts`
- Modify: `tests/e2e/invoice-editor.spec.ts`

**Interfaces:**
- Produces: root `test:e2e` that launches the API/web test servers and runs Playwright specs.

- [ ] Add a guard test that reads workspace scripts and rejects `echo`, `pending`, or an empty test command.
- [ ] Run the guard and preserve failures for API/web `test:e2e`.
- [ ] Configure Playwright web servers, base URLs, isolated test tenant data, and teardown scoped to generated tenant IDs.
- [ ] Make login/onboarding, master data, and invoice editor specs assert real HTTP/UI behavior, keyboard operation, conflict handling, and the draft watermark.
- [ ] Run targeted integration suites (38 existing assertions), then `pnpm test:e2e`; require all three flows to pass without skipped tests.
- [ ] Commit with `test: run real auth master-data and invoice e2e`.

### Task 4: Complete durable numbering and issuance (T7–T8)

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/numbering/numbering.service.ts`
- Modify: `apps/api/src/common/idempotency/idempotency.service.ts`
- Modify: `apps/api/src/documents/issue-document.service.ts`
- Create: `apps/api/src/jobs/jobs.module.ts`
- Create: `apps/api/src/jobs/fiscal.worker.ts`
- Create: `apps/api/src/jobs/job-envelope.ts`
- Modify: `tests/integration/numbering-concurrency.spec.ts`
- Modify: `tests/integration/issue-workflow.spec.ts`
- Create: `tests/integration/jobs-recovery.spec.ts`

**Interfaces:**
- Produces: `FiscalJobEnvelope<T>`, `enqueueFiscalJob(tx, envelope)`, and worker handlers for `dian.submit`, `dian.poll`, and `pdf.generate`.

- [ ] Add failing assertions for 50 continuous concurrent numbers, request-hash conflict, duplicate job delivery, bounded retry exhaustion, and crash-after-send reconciliation.
- [ ] Install the already-approved `pg-boss` dependency and replace the synchronous outbox shortcut with transactional job publication using the standard envelope.
- [ ] Keep number reservation, document lock, idempotency state, and job publication in one database transaction.
- [ ] Implement worker reconciliation through provider status lookup before any retry after an uncertain transmission.
- [ ] Run numbering, issuance, and recovery suites repeatedly; require no duplicate number, transmission, or terminal transition.
- [ ] Commit with `fix: complete durable fiscal issuance jobs`.

### Task 5: Complete private artifacts and PDF/XML lifecycle (T9)

**Files:**
- Modify: `apps/api/src/artifacts/*`
- Modify: `apps/web/app/api/internal/invoice-render/[id]/route.ts`
- Modify: `tests/integration/artifacts.spec.ts`
- Create: `tests/e2e/pdf.spec.ts`

**Interfaces:**
- Produces: immutable artifact attempts and five-minute signed download URLs without internal storage keys.

- [ ] Add failing tests for cross-tenant download, false MIME, path traversal, expired/used render token, multipage PDF, and versioned regeneration.
- [ ] Resolve artifact dependencies through module exports and keep storage/PDF behind existing ports.
- [ ] Validate content signatures in addition to declared MIME, hash every stored payload, and never overwrite an attempt.
- [ ] Render the protected A4 route with a one-use token and shared view model; keep calculation logic outside the view.
- [ ] Run artifact integration and PDF E2E suites; require correct hash, headers, watermark, and tenant denial.
- [ ] Commit with `fix: complete immutable fiscal artifacts`.

### Task 6: Complete adjustments and immutable accounting (T10–T11)

**Files:**
- Modify: `apps/api/src/documents/credit-notes/*`
- Modify: `apps/api/src/documents/debit-notes/*`
- Modify: `apps/api/src/accounting/*`
- Create: `apps/web/app/app/credit-notes/new/page.tsx`
- Create: `apps/web/app/app/debit-notes/new/page.tsx`
- Create: `apps/web/app/app/accounting/page.tsx`
- Modify: `tests/integration/adjustments.spec.ts`
- Modify: `tests/integration/accounting.spec.ts`
- Modify: `tests/e2e/cancel-invoice.spec.ts`

**Interfaces:**
- Produces: accepted adjustment posting/reversal with unique document reference and balanced decimal entries.

- [ ] Add failing tests for partial credit exceeding remaining balance, note-on-note, closed period, missing tenant mapping, repeated posting, and mutation/deletion of automatic entries.
- [ ] Enforce original snapshots, independent numbering, accepted-only cancellation, and debit reasons with the additional-invoice warning.
- [ ] Use tenant-configured accounts only; post once after fiscal acceptance and reverse with a linked immutable entry.
- [ ] Build minimal SSR pages for credit/debit creation and accounting journal with permission-aware actions.
- [ ] Run adjustment/accounting integration and cancellation E2E; require bidirectional links, audit evidence, and exact debit-credit equality.
- [ ] Commit with `fix: complete adjustments and immutable accounting`.

### Task 7: Complete email, webhooks, and WhatsApp V1 (T12)

**Files:**
- Modify: `apps/api/src/notifications/*`
- Create: `apps/api/src/notifications/email.provider.ts`
- Create: `apps/api/src/notifications/resend-email.provider.ts`
- Modify: `tests/integration/notifications.spec.ts`
- Create: `tests/e2e/delivery.spec.ts`

**Interfaces:**
- Produces: `EmailProvider.sendInvoice(input): Promise<EmailDeliveryResult>` and idempotent webhook processing.

- [ ] Add failing tests for draft-send rejection, attachment set, reply-to, duplicate webhook, invalid signature, retry exhaustion, expired WhatsApp URL, and separated fiscal/delivery states.
- [ ] Put Resend behind `EmailProvider`; keep API key server-only and redact provider payload secrets.
- [ ] Queue email and webhook work through `pg-boss`, deduplicate provider event IDs, and persist bounded attempts plus terminal failure.
- [ ] Generate normalized WhatsApp links with short signed URLs and record `SHARED_WHATSAPP` without claiming delivery.
- [ ] Run notification integration and delivery E2E suites; require no keys or expired URLs in responses/logs.
- [ ] Commit with `fix: complete document delivery channels`.

### Task 8: Finish dashboard, settings, and accessible operator flows (T13)

**Files:**
- Modify: `apps/api/src/metrics/*`
- Modify: `apps/api/src/settings/*`
- Modify: `apps/web/app/app/layout.tsx`
- Modify: `apps/web/app/app/dashboard/page.tsx`
- Modify: `apps/web/app/app/invoices/[id]/page.tsx`
- Modify: `apps/web/app/app/settings/page.tsx`
- Create: `tests/e2e/dashboard-settings.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Produces: tenant-isolated dashboard summary and permission-filtered operator navigation.

- [ ] Add failing two-tenant aggregate tests for sales, VAT, states, credit notes, failed deliveries, and numbering availability.
- [ ] Capture `EXPLAIN (ANALYZE, BUFFERS)` evidence for aggregate queries and add only indexes justified by the plan.
- [ ] Complete invoice actions, company/AIU/numbering/email/user/audit settings, and permission-based navigation.
- [ ] Add Playwright keyboard and axe checks for shell, dashboard, invoice detail, and settings with zero critical/serious violations.
- [ ] Run settings/metrics integration, dashboard E2E, accessibility, lint, typecheck, and web build.
- [ ] Commit with `fix: complete accessible operator workflows`.

### Task 9: Implement direct DIAN for one pilot tenant (T14)

**Files:**
- Create: `apps/api/src/dian/direct/*`
- Create: `apps/api/src/dian/encryption/*`
- Create: `apps/api/src/dian/onboarding/*`
- Create: `apps/web/app/app/settings/dian/page.tsx`
- Create: `tests/integration/dian-provider-selection.spec.ts`
- Create: `tests/integration/dian-sandbox.spec.ts`
- Create: `tests/fixtures/dian/*`
- Create: `docs/runbooks/dian-habilitacion.md`
- Create: `docs/adr/0002-dian-operating-model.md`

**Interfaces:**
- Produces: `DirectDianProvider` implementing the existing fiscal authority port without consumer changes.

- [ ] Add provider-selection tests proving `DIRECT` rejects every tenant except `DIAN_PILOT_TENANT_ID` before secret retrieval or network activity.
- [ ] Pin official XSD/catalog fixtures with source URL, version, date, and SHA-256; add failing invoice/NC/ND/CUFE/CUDE/QR/XAdES/AttachedDocument fixtures.
- [ ] Implement UBL validation, XAdES signing, encrypted tenant secrets, bounded HTTP timeouts, persistence, circuit opening, and post-timeout status reconciliation.
- [ ] Build the tenant wizard for profile, software, certificate, habilitation set, numbering, and production activation; mask secrets permanently after submission.
- [ ] Run all offline fixtures. Run sandbox tests only with explicit pilot credentials; otherwise report `NOT_VERIFIABLE`, never fake success.
- [ ] Commit with `feat: add pilot-only direct dian provider`.

### Task 10: Prove security, privacy, backup, and recovery (T15)

**Files:**
- Modify: `apps/api/src/main.ts`
- Modify: `tests/security/security.spec.ts`
- Create: `tests/integration/backup-restore.spec.ts`
- Modify: `scripts/backup.sh`
- Modify: `docs/runbooks/security.md`
- Modify: `docs/runbooks/backup-restore.md`
- Modify: `docs/runbooks/incident-response.md`
- Modify: `docs/runbooks/privacy-retention.md`

**Interfaces:**
- Produces: structured redacted logs and a tested encrypted backup/restore procedure.

- [ ] Add failing cases for broken authorization, CSRF, brute force, MIME spoofing, traversal, renderer SSRF, secret/PII logging, and foreign signed URLs.
- [ ] Apply CSP, body limits, network allowlists, timeouts, content inspection, and centralized log redaction without weakening health checks.
- [ ] Make backup output encrypted and checksum-addressed; restore into a newly created empty database.
- [ ] Verify restored counts, artifact hashes, RLS using the restricted role, and immutable fiscal/audit/accounting rows.
- [ ] Run security and backup/restore suites plus dependency/SAST checks; require no critical/high finding.
- [ ] Commit with `fix: prove operations privacy and recovery`.

### Task 11: Update coordination records and run the correction gate

**Files:**
- Modify: `docs/coordination/decisions.md`
- Modify: `docs/coordination/implementation-status.md`

**Interfaces:**
- Produces: requirement-to-implementation-to-test traceability for corrected T1, T3, and T5–T15.

- [ ] Record the pilot-only DIAN ruling, shared contracts, owners, consumers, compatibility, and rollback order.
- [ ] Record every task handoff with files, tests, risks, remaining work, and next owner.
- [ ] Recreate databases and run `pnpm install --frozen-lockfile`, migrations clean/incremental, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, and `pnpm build`.
- [ ] Run an independent architecture/platform/integration review followed by `qa_gate`; accept only `APPROVED`, otherwise return findings to the owning task.
- [ ] Commit with `docs: close partial-task correction gate`.

