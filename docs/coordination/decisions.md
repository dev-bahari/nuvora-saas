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

## 2026-09-21 — Preflight architecture rulings (Foundation v1)

- **B1 (Tenancy probe):** Tarea 2 verifica aislamiento RLS con tabla probe tenant-scoped (`tenancy_isolation_probe`), sin depender prematuramente de tablas de clientes (T5), facturas (T6) o storage (T9).
- **B2 (Auth landing mínima):** Tarea 3 redirige tras login a `/app/dashboard` con layout/página SSR mínima protegida sin adelantar el app shell operativo de T13.
- **B3 (Estado documental `READY_TO_ISSUE`):** El estado previo a emisión es estrictamente `READY_TO_ISSUE` conforme a la especificación normativa, corrigiendo la redacción de T8 en el plan.
- **B4 (Render PDF en desacople):** Tarea 8 define puerto y mock para `pdf.generate`; la integración real de Chromium/Playwright y storage MinIO reside en T9.
- **B5 (Desacople contable en ajustes):** Tarea 10 define contrato y mock para `reverseDocument`; la implementación de asientos reales reside en T11.
- **B6 (Envolvente mínima obligatoria de jobs):** Todos los jobs en `pg-boss` requieren obligatoriamente `{ tenantId, requestId, entityId, schemaVersion, idempotencyKey, payload }`.
- **B7 (Posting contable desacoplado):** Emisión fiscal en T8 interactúa con contabilidad vía puerto/evento `postDocument`, sin acoplamiento a la implementación de T11.

