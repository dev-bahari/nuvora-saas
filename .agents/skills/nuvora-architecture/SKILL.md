---
name: nuvora-architecture
description: Use when changing Nuvora module boundaries, PostgreSQL RLS, migrations, shared contracts, pg-boss jobs, concurrency, or deployment topology.
---

# Nuvora architecture

Choose the smallest modular-monolith design that preserves tenant safety and fiscal correctness.

## Module boundary

Define owner, public interface, allowed dependencies and forbidden imports. Domain does not import transport or infrastructure. Shared packages contain stable contracts or pure logic, never miscellaneous helpers.

## PostgreSQL and RLS

Every commercial, fiscal, accounting and delivery row has `tenant_id`. Set tenant context transaction-locally. Test with two tenants and the restricted application role; superuser tests do not prove RLS.

## Jobs

Each payload has `tenant_id`, `request_id`, entity ID, schema version and idempotency key. Business commit and enqueue use an outbox/transaction-safe path. Retries are bounded, terminal failures observable, and duplicate delivery safe.

## Change record

For cross-module changes, record compatibility, migration/deployment order, rollback and evidence in `docs/coordination/decisions.md`, then use `nuvora-coordination` for acknowledgement.

