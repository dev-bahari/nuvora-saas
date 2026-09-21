---
name: nuvora-coordination
description: Use when two or more Nuvora agents share a contract, dependency, implementation sequence, or QA handoff.
---

# Nuvora coordination

Make ownership, contracts and evidence explicit.

## Contract handshake

Before consumer implementation, the owner sends:

```text
Contract: <name/version>
Owner / consumers: <agents>
Signatures or schema: <exact names and types>
Errors and observable states: <stable list>
State machine and state owner: <transitions and owning layer>
Invariants: <tenant, money, idempotency, immutability>
Compatibility: <additive/breaking and migration order>
Evidence expected: <tests/checks>
```

List direct and transitive consumers. Consumers acknowledge or request changes. A changed shared contract repeats the handshake.

## Handoff

Send affected agents a message and persist this record in `docs/coordination/implementation-status.md`:

```text
Owner:
Scope completed:
Files/contracts changed:
Tests run and result:
Risks/decisions:
Remaining work:
Next owner:
QA evidence:
```

Record durable trade-offs in `docs/coordination/decisions.md`. Do not use the files instead of direct notification.

## Gates

- Architecture: module/contract owner approves.
- Platform: RLS, migration, concurrency and jobs are proven when affected.
- Integration: producers and consumers run the same contract test.
- QA: `qa_gate` returns the final verdict.
