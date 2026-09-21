---
name: nuvora-backend
description: Use when implementing Nuvora domain rules, NestJS application services, fiscal workflows, accounting, audit, or provider adapters.
---

# Nuvora backend

Keep domain behavior independent of HTTP, React, ORM and providers.

- Put fiscal calculation in `packages/calculation-engine`; inputs are immutable and monetary values are decimal strings.
- Application services own use-case orchestration and transaction intent.
- Controllers and jobs call application services; they do not contain business rules.
- Create interfaces only for external boundaries required by the product: DIAN, storage, email and PDF, or when a second implementation exists.
- Persist snapshots needed to reproduce historical documents. Issued documents and audit events are append-only.
- Emit stable domain errors; `api_fastify` owns HTTP mapping.
- Every tenant-scoped repository call requires an established tenant transaction.

Use TDD for each behavior. Handoff exact signatures, domain errors, invariants and transaction boundaries through `nuvora-coordination`.

