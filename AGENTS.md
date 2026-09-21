# Nuvora agent team

## Product baseline

- Build from `SPECS_SaaS_Facturacion_Colombia.md` and the approved plan in `docs/superpowers/plans/2026-09-21-saas-facturacion-colombia.md`.
- Stack: Node.js + TypeScript, NestJS with Fastify, React with Next.js App Router, Tailwind CSS, PostgreSQL with RLS, and `pg-boss`.
- Architecture: modular monolith. Keep domain rules independent from HTTP, UI, persistence, DIAN, email, storage, and PDF providers.
- Money uses PostgreSQL `NUMERIC` and a decimal TypeScript library. Never use JavaScript floating point for fiscal amounts.
- Every tenant-scoped operation must prove isolation in both application authorization and PostgreSQL RLS.
- Issued fiscal documents and audit records are immutable.

## Required workflow

1. Read the applicable spec, plan task, existing decisions, and current status before changing code.
2. Use `superpowers:brainstorming` for new design or changed behavior and obtain the required approval.
3. Use `superpowers:writing-plans` for multi-step implementation plans.
4. Use `superpowers:test-driven-development` for implementation and bug fixes.
5. Use `superpowers:systematic-debugging` for failures or unexpected behavior.
6. Use `superpowers:verification-before-completion` before reporting completion.
7. Use `superpowers:requesting-code-review` before the QA gate for substantial work.

## Delegation map

Use project agents in `.codex/agents/` when their specialty is involved:

- `backend_domain`: NestJS modules, fiscal domain, application services, adapters, accounting, audit.
- `api_fastify`: Fastify transport, REST/OpenAPI, authentication boundary, DTO validation, idempotency, error mapping.
- `frontend_design`: Next.js, React, Tailwind, accessibility, responsive UI, invoice editor and preview.
- `modular_architect`: module boundaries, dependency direction, contracts, ADRs, cross-module compatibility.
- `platform_architect`: PostgreSQL/RLS, migrations, concurrency, `pg-boss`, resilience and operational scale.
- `qa_gate`: final independent verification across requirements, security, contracts and tests.

Delegate only independent or clearly owned work. Before delegation, the primary agent records the owner, intended paths and dependencies in `docs/coordination/implementation-status.md`; do not start agents whose intended paths overlap. The primary agent remains responsible for sequencing and the final answer.

## Coordination contract

- All agents use `nuvora-coordination` for cross-role work.
- The contract owner publishes exact signatures, schemas, errors, invariants, direct/transitive consumers and compatibility notes before consumers implement against them.
- A contract change is not accepted until affected agents acknowledge it. Never silently change shared DTOs, database semantics, permissions, job payloads or UI-visible states.
- Persist durable decisions in `docs/coordination/decisions.md` and current ownership/state in `docs/coordination/implementation-status.md`.
- Use agent messages for immediate coordination. The persistent files are the handoff record, not a substitute for direct notification.
- Every handoff states: completed scope, files/contracts changed, tests and results, risks, remaining work, next owner and blocking decisions.

## Quality gates

1. **Architecture gate:** `modular_architect` approves new module boundaries and cross-module contracts.
2. **Platform gate:** `platform_architect` proves RLS, migration safety, job idempotency and concurrency behavior when affected.
3. **Integration gate:** backend, API and frontend owners verify the same versioned contract end-to-end.
4. **QA gate:** all implementation agents report to `qa_gate`; only QA may return the integrated change as `APPROVED`.

`qa_gate` must return `APPROVED`, `REJECTED`, or `NOT_VERIFIABLE`. Findings go back to the owning agent with reproduction, severity, violated criterion and required evidence. QA does not silently repair implementation defects.

## Code review rules

- Reject business or fiscal rules duplicated in controllers, React components, SQL policies or job handlers.
- Reject tenant-scoped queries outside a tenant transaction or workers that do not establish tenant context.
- Reject breaking contract changes without consumer acknowledgement and integration tests.
- Reject jobs without idempotency, bounded retries, observable terminal failure and transaction/outbox safety.
- Reject claims of completion without fresh command output and requirement-to-test traceability.
- Style-only comments are non-blocking unless they conceal correctness, security, accessibility or maintainability risk.
