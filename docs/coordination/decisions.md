# Architecture decisions

## Accepted baseline

- Web: React with Next.js App Router; server-rendered by default.
- UI: Tailwind CSS; interactive client islands only where required.
- Backend: Node.js + TypeScript + NestJS using Fastify.
- Architecture: modular monolith.
- Data: PostgreSQL with tenant RLS.
- Jobs: `pg-boss` on PostgreSQL.
- Delivery flow: specialist handoffs followed by an independent QA gate.

Record future decisions with date, context, decision, consequences, compatibility and rollback.

