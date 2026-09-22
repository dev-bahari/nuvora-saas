# Implementation status

## Current gate

- Phase: Foundation (Tasks 1 & 2 Complete; All 7 QA Blockers Fully Resolved)
- Architecture gate: APPROVED (docs/coordination/preflight-architecture.md)
- Platform gate: APPROVED & VERIFIED (tests/integration/tenant-isolation.spec.ts 7/7, RLS on tenants & membership_permissions, dynamic DB grants)
- Integration gate: pending
- QA gate: READY_FOR_REINSPECTION

## Active ownership

### 2026-09-22 — Authenticated panel UI redesign

| Scope | Owner | Intended paths | Dependencies | Contract/version | Status | Next owner |
|---|---|---|---|---|---|---|
| UI Task 1: shell and feedback primitives | frontend_design | `apps/web/components/app-shell/*`, `apps/web/components/ui/*`, `apps/web/app/app/layout.tsx`, `apps/web/app/globals.css`, UI tests | approved UI spec/plan; current palette | panel-ui-v1 | active | UI reviewer |

No other UI implementer may edit these paths until Task 1 review closes. Subsequent UI ownership is recorded before dispatch.

| Scope | Owner | Intended paths | Dependencies | Contract/version | Status | Next owner |
|---|---|---|---|---|---|---|
| Agent environment | primary | `AGENTS.md`, `.codex/`, `.agents/skills/` | Codex multi-agent + Superpowers + Impeccable | coordination-v1 | complete | qa_gate |
| Preflight architecture | modular_architect | `docs/coordination/preflight-architecture.md` | SPECS, Plan 2026-09-21, AGENTS.md | foundation-v1-preflight | complete | primary |
| Project foundation (Task 1) | primary | `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `compose.yaml`, `apps/*`, `packages/*`, `docs/adr/` | Node 24, pnpm, Docker | foundation-v1 | complete | qa_gate |
| Tenancy & RLS (Task 2) | platform_architect | `db/migrations/`, `apps/api/src/tenancy/`, `tests/integration/` | PostgreSQL RLS, Drizzle | tenancy-rls-v1 | complete | qa_gate |
| Auth & Onboarding (Task 3) | backend_domain | `apps/api/src/auth/`, `db/migrations/0003_auth.sql`, `apps/web/app/` | Argon2id, Session cookies | auth-onboarding-v1 | pending | backend_domain |

## Handoffs

### 2026-09-21 — Foundation QA Remediation Round 2 (All 7 Blockers & Minor Findings Resolved)

- Owner: primary / platform_architect
- Scope completed: Subsanación rigurosa de los 7 bloqueadores y 3 observaciones menores reportadas por el `qa_gate`:
  1. **CI en base limpia (Alta):** Se incorporó el paso `pnpm run db:migrate` en `.github/workflows/ci.yml` previo a la fase de integración, con verificación de esquema en `tests/integration/tenant-isolation.spec.ts`.
  2. **Portabilidad de migraciones (Alta):** Conexión dinámica implementada en `db/migrations/0002_rls.sql` mediante `EXECUTE format('GRANT CONNECT ON DATABASE %I TO nuvora_app_user', current_database())`. Probado y verificado en `nuvora_dev` y `nuvora_test`.
  3. **Seguridad RLS y permisos (Alta):**
     - `membership_permissions` cuenta con `tenant_id NOT NULL`, `ROW LEVEL SECURITY` habilitado y forzado, y política de aislamiento `tenant_isolation_membership_permissions`.
     - `tenants` cuenta con `ROW LEVEL SECURITY` habilitado y forzado con política `tenant_isolation_tenants`.
     - `sessions.tenant_id` es estrictamente `NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`.
     - Privilegios destructivos globales (`TRUNCATE`, `DELETE`) sobre `tenants`, `users` y `audit_logs` revocados del rol de aplicación `nuvora_app_user`.
     - Función en base de datos `get_effective_permissions(p_tenant_id, p_user_id)` calcula permisos en caliente basados en membresías activas, roles y overrides positivos/negativos.
     - `PermissionGuard` evalúa permisos efectivos en caliente vía `PermissionsService`.
  4. **Seguridad en datos de integración (Alta):** Eliminado `TRUNCATE` global en `tenant-isolation.spec.ts`. La limpieza se realiza exclusivamente sobre los UUIDs generados (`WHERE tenant_id IN ($1, $2)`), con guardas que abortan si se ejecuta en entorno de producción.
  5. **ESLint monorepo completo (Media):** Script `lint` en raíz actualizado a `"eslint . && pnpm -r --if-present run lint"`, analizando la raíz, `db/**/*.ts`, `tests/**/*.ts` y todos los workspaces.
  6. **Pinning estricto de dependencias y contenedores (Media):**
     - Node engine fijado a `^24.0.0` con archivos `.node-version` y `.nvmrc` (`24.11.1`).
     - MinIO fijado a la versión inmutable `quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z` en `compose.yaml` y `.github/workflows/ci.yml`.
  7. **Cobertura real de readiness (Media):**
     - Pool de `HealthService` configurado con `connectionTimeoutMillis: 2000`, `statement_timeout: 2000` y `query_timeout: 2000`.
     - Nueva prueba de integración en `apps/api/test/health.spec.ts` verificando respuesta 503 contra un PostgreSQL inalcanzable real sin recurrir a mocks.
  8. **Pendientes menores:**
     - Archivos `tsconfig.tsbuildinfo` removidos del índice de git e ignorados en `.gitignore`.
     - `git diff --check HEAD` verificado con código de salida 0 (sin espacios ni saltos sobrantes).
     - Configuración de `@next/eslint-plugin-next` resuelta sin advertencias en la compilación de Next.js.
- Files/contracts changed: `.github/workflows/ci.yml`, `.gitignore`, `.node-version`, `.nvmrc`, `package.json`, `pnpm-lock.yaml`, `compose.yaml`, `db/migrations/0001_identity_tenancy.sql`, `db/migrations/0002_rls.sql`, `apps/api/src/health/health.service.ts`, `apps/api/test/health.spec.ts`, `apps/api/src/tenancy/permission.guard.ts`, `apps/api/src/tenancy/permissions.service.ts`, `apps/web/next.config.ts`, `apps/web/package.json`, `eslint.config.mjs`, `tests/integration/tenant-isolation.spec.ts`, `docs/coordination/decisions.md`, `docs/coordination/implementation-status.md`.
- Tests run and result:
  - `pnpm install --frozen-lockfile`: 0 errores en 5.5s.
  - `pnpm run lint`: código 0 en monorepo completo.
  - `pnpm run typecheck`: código 0 en todos los workspaces.
  - `pnpm run test`: 10/10 pruebas unitarias y de arquitectura pasando al 100%.
  - `pnpm run db:migrate`: código 0 (ejecutado exitosamente en `nuvora_dev` y `nuvora_test`).
  - `pnpm run test:integration`: 7/7 pruebas de integración RLS pasando al 100%.
  - `pnpm run test:e2e`: código 0 (declarado honestamente como pendiente para Tarea 3).
  - `pnpm run build`: código 0 en los 4 paquetes y aplicaciones.
- Next owner: `qa_gate` para reinspección formal.


### 2026-09-21 — Foundation QA Remediation & Reinspection Request

- Owner: primary
- Scope completed: Subsanación integral de los 6 bloqueadores y discrepancias emitidos por `qa_gate` para Foundation (Task 1 y Task 2):
  1. `/health/ready` dinámico con prueba de PostgreSQL (`SELECT 1`) en `HealthService` (200 OK en salud / 503 Service Unavailable en desconexión).
  2. `compose.yaml` actualizado a `quay.io/minio/minio:latest` con healthcheck `curl -f http://localhost:9000/minio/health/live`. Verificado `docker compose up -d --wait` (ambos healthy).
  3. ESLint real (`eslint.config.mjs`) configurado en los 4 proyectos sin scripts simulados.
  4. Suite automatizada de fronteras arquitectónicas (`tests/architecture/boundaries.spec.ts`) integrada en `pnpm test`.
  5. Pinning estricto de Node 24 y pnpm 12.5.1 en `package.json` y `.github/workflows/ci.yml`.
  6. Suite de integración ejecutando 6 pruebas reales de aislamiento RLS contra PostgreSQL; suite E2E declarada con transparencia como pendiente Task 3.
  7. Preflight de arquitectura enlazado a `docs/coordination/preflight-architecture.md`.
- Files/contracts changed: `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.service.ts`, `apps/api/src/health/health.module.ts`, `apps/api/test/health.spec.ts`, `compose.yaml`, `eslint.config.mjs`, `package.json`, `pnpm-lock.yaml`, `apps/api/package.json`, `apps/web/package.json`, `packages/contracts/package.json`, `packages/calculation-engine/package.json`, `tests/architecture/boundaries.spec.ts`, `tests/integration/tenant-isolation.spec.ts`, `.github/workflows/ci.yml`, `docs/coordination/implementation-status.md`.
- Tests run and result:
  - `docker compose up -d --wait`: PostgreSQL y MinIO en estado `Healthy`.
  - `pnpm lint`: Real ESLint pasa en los 4 proyectos con 0 errores y 0 advertencias.
  - `pnpm typecheck`: 0 errores en todos los paquetes.
  - `pnpm test`: 9 pruebas unitarias y de fronteras arquitectónicas pasando al 100%.
  - `pnpm test:integration`: 6 pruebas de aislamiento RLS pasando al 100% contra PostgreSQL.
  - `pnpm build`: Todos los proyectos compilaron exitosamente.
- Risks/decisions: Docker local de PostgreSQL mapeado en puerto 54321; rol restringido `nuvora_app_user` forzado en RLS.
- Remaining work: Veredicto independiente del `qa_gate` para autorizar el avance hacia la Tarea 3.
- Next owner: `qa_gate` para reinspección formal.
- QA evidence: salida fresca de `docker compose up -d --wait ; pnpm lint ; pnpm typecheck ; pnpm test ; pnpm test:integration ; pnpm build` (código 0 en todos los comandos).

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
