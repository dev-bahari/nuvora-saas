# Implementation status

## Current gate

- Phase: Foundation (Task 1 QA Remediation Applied; Task 2 Completed)
- Architecture gate: APPROVED (docs/coordination/preflight-architecture.md)
- Platform gate: APPROVED (tests/integration/tenant-isolation.spec.ts & FORCE RLS)
- Integration gate: pending
- QA gate: REMEDIATION_COMPLETE (awaiting final QA verification)

## Active ownership

| Scope | Owner | Intended paths | Dependencies | Contract/version | Status | Next owner |
|---|---|---|---|---|---|---|
| Agent environment | primary | `AGENTS.md`, `.codex/`, `.agents/skills/` | Codex multi-agent + Superpowers + Impeccable | coordination-v1 | complete | qa_gate |
| Preflight architecture | modular_architect | `docs/coordination/preflight-architecture.md` | SPECS, Plan 2026-09-21, AGENTS.md | foundation-v1-preflight | complete | primary |
| Project foundation (Task 1) | primary | `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `compose.yaml`, `apps/*`, `packages/*`, `docs/adr/` | Node 24, pnpm, Docker | foundation-v1 | complete | qa_gate |
| Tenancy & RLS (Task 2) | platform_architect | `db/migrations/`, `apps/api/src/tenancy/`, `tests/integration/` | PostgreSQL RLS, Drizzle | tenancy-rls-v1 | complete | qa_gate |
| Auth & Onboarding (Task 3) | backend_domain | `apps/api/src/auth/`, `db/migrations/0003_auth.sql`, `apps/web/app/` | Argon2id, Session cookies | auth-onboarding-v1 | pending | backend_domain |

## Handoffs

### 2026-09-21 — Tenancy & RLS (Task 2)

- Owner: platform_architect / primary
- Scope completed: Migraciones SQL base (`db/migrations/0001_identity_tenancy.sql`, `0002_rls.sql`), runner de migraciones (`db/migrate.ts`), tablas `tenants`, `users`, `roles`, `permissions`, `role_permissions`, `memberships`, `membership_permissions`, `sessions`, `audit_logs` y tabla probe de aislamiento `tenancy_isolation_probe` (Ruling B1). Políticas de PostgreSQL `FORCE ROW LEVEL SECURITY` con rol restringido `nuvora_app_user`. Contexto transaccional `withTenant` con `SET LOCAL app.tenant_id` y `SET LOCAL app.user_id`. Guarda de autorización `PermissionGuard` con `@RequirePermission`. Trigger inmutable append-only para `audit_logs`.
- Files/contracts changed: `compose.yaml`, `.env.example`, `.env`, `package.json`, `pnpm-lock.yaml`, `db/migrations/0001_identity_tenancy.sql`, `db/migrations/0002_rls.sql`, `db/migrate.ts`, `apps/api/src/tenancy/tenant-context.ts`, `apps/api/src/tenancy/tenant-transaction.ts`, `apps/api/src/tenancy/permission.guard.ts`, `tests/integration/tenant-isolation.spec.ts`.
- Tests run and result:
  - TDD Rojo -> Verde: fallo inicial por tablas ausentes, luego 6/6 pruebas de integración pasando (`tests/integration/tenant-isolation.spec.ts`).
  - Prueba 1: `withTenant` establece contexto y aísla registros entre Tenant A y Tenant B.
  - Prueba 2: Búsqueda explícita por ID perteneciente a otro tenant devuelve 0 filas (cero fuga de datos).
  - Prueba 3: Intento de insertar datos con `tenant_id` ajeno es bloqueado por PostgreSQL RLS con violación de política.
  - Prueba 4: Consulta directa sin `app.tenant_id` devuelve 0 filas.
  - Prueba 5: Intento de `UPDATE` o `DELETE` sobre `audit_logs` es bloqueado por trigger inmutable append-only.
  - Prueba 6: `PermissionGuard` autoriza permisos presentes y rechaza con `403 Forbidden` ante permisos faltantes.
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`: todos terminaron con código 0.
- Risks/decisions: Docker local de PostgreSQL mapeado al puerto 54321 para evitar colisión con otros contenedores. Rol restringido `nuvora_app_user` (sin `BYPASSRLS`) garantiza que RLS sea forzada en cada transacción.
- Remaining work: Task 3 (Autenticación, sesiones y onboarding seguro).
- Next owner: `backend_domain` / `api_fastify` para Tarea 3.
- QA evidence: 6/6 pruebas de integración verdes y suite completa con salida fresca y código 0.

### 2026-09-21 — Foundation v1 (Task 1)

- Owner: primary
- Scope completed: Monorepo workspace (pnpm 12.5, Node 24), TypeScript strict base config (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `@nuvora/contracts` y `@nuvora/calculation-engine` boundaries, `apps/api` (NestJS + Fastify con `/health/live` y `/health/ready` mediante TDD rojo->verde), `apps/web` (Next.js 15 App Router SSR + Tailwind CSS), `compose.yaml` (PostgreSQL 16 + MinIO con healthchecks), `.env.example`, `.github/workflows/ci.yml` (6 fases con servicios efímeros), y ADR 0001 (`docs/adr/0001-modular-monolith.md`).
- Files/contracts changed: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example`, `compose.yaml`, `.gitignore`, `packages/*`, `apps/*`, `docs/adr/0001-modular-monolith.md`, `.github/workflows/ci.yml`, `docs/coordination/decisions.md`, `docs/coordination/implementation-status.md`.
- Tests run and result:
  - TDD `/health/live`: Red (404) -> Green (200 `{"status":"ok"}`).
  - `pnpm lint`: exit code 0.
  - `pnpm typecheck`: exit code 0 (4 proyectos sin errores de tipos).
  - `pnpm test`: exit code 0 (4 unit tests passing in calculation-engine and api).
  - `pnpm build`: exit code 0 (compilación exitosa en contracts, calculation-engine, api y web App Router).
  - `pnpm test:integration` & `test:e2e`: exit code 0 (scripts documentan estado de fases subsiguientes).
  - `docker compose config`: validación sintáctica limpia.
- Risks/decisions: Incorporados rulings B1-B7 del preflight. Sin entidades ni contratos de dominio prematuros.
- Remaining work: Task 2 (Esquema base, contexto tenant y RLS).
- Next owner: `platform_architect` / `backend_domain` para Tarea 2.
- QA evidence: salida fresca de `pnpm lint; pnpm typecheck; pnpm test; pnpm build` con código de salida 0.

### 2026-09-21 — Agent environment v1

- Owner: primary
- Scope completed: repository instructions, six custom agents, six local skills, multi-agent feature flag, coordination ledger and architecture baseline.
- Files/contracts changed: `AGENTS.md`, `.codex/config.toml`, `.codex/agents/*.toml`, `.agents/skills/*/SKILL.md`, `docs/coordination/*`; coordination contract `coordination-v1`.
- Tests run and result: six skill validations passed; six agent TOML files and project config parsed; Codex strict config load passed; placeholder scan clean; independent workflow simulation passed after three coordination refinements.
- Risks/decisions: local Codex rejects the newer `[agents].max_concurrent_threads_per_session` option, so project config enables `multi_agent` only and uses runtime capacity. Product implementation and its four gates remain intentionally pending.
- Remaining work: start Foundation from the approved implementation plan; publish each feature contract before consumers implement.
- Next owner: `modular_architect` for Foundation boundaries.
- QA evidence: validation outputs from this setup turn; final independent QA review requested after this handoff.
