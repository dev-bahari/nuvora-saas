---
name: nuvora-quality-gate
description: Use when validating a Nuvora feature or release after implementation agents report completion.
---

# Nuvora quality gate

Treat completion claims as unverified until reproduced.

Required evidence:

- requirement → implementation → test traceability;
- fresh lint, typecheck, unit, integration, E2E and build results for the affected scope;
- API producer/consumer contract agreement;
- two-tenant RLS tests using the restricted role;
- idempotency, concurrency, duplicate job, retry exhaustion and recovery checks when affected;
- migration from previous state and clean database;
- security, accessibility and regression evidence proportional to risk;
- known risks, rollback and remaining work.

Return one verdict:

- `APPROVED`: evidence is reproducible and no critical/high defect remains.
- `REJECTED`: include owner, severity, reproduction, violated criterion and acceptance condition.
- `NOT_VERIFIABLE`: name the missing evidence and owner.

Do not repair defects during review. Send findings to the owner and primary agent, then re-run only the failed and impacted gates after correction.

