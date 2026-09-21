# Preflight de arquitectura — SaaS de facturación Colombia

Fecha: 2026-09-21
Rol: `modular_architect`
Alcance: revisión previa a ejecución; no implementa producto.
Autoridades, en orden: `SPECS_SaaS_Facturacion_Colombia.md`, `AGENTS.md`, plan aprobado, skills Nuvora aplicables.

## Resultado ejecutivo

**VEREDICTO: APROBADO CON RULINGS; TASK 1 PUEDE EMITIRSE.**

El diseño objetivo es coherente con el stack y con el monolito modular exigido. La ejecución literal del plan, sin embargo, tiene cuatro dependencias adelantadas bloqueantes para las pruebas de las Tasks 2, 3, 8 y 10, un nombre de estado incorrecto en Task 8 y una envolvente de jobs incompleta. Los rulings siguientes eliminan la ambigüedad sin cambiar el alcance del producto.

### Hallazgos bloqueantes y rulings

| ID | Hallazgo | Mandato en conflicto | Ruling antes de ejecutar | Coste si el ruling fuera incorrecto |
|---|---|---|---|---|
| B1 | Task 2 exige probar `cliente`, `factura`, endpoint y descarga cross-tenant, pero clientes, facturas y descargas nacen en Tasks 5, 6 y 9. | T2 vs T5/T6/T9; el preflight no permite depender de archivos futuros. | **Ruling:** T2 prueba RLS con una tabla fixture tenant-scoped mínima creada dentro del test/migración de prueba y una ruta probe exclusiva de test; conserva casos A/B e IDs conocidos. Las pruebas reales de cliente/factura/descarga se agregan en T5/T6/T9. No crear módulos de producto adelantados. | Si se exige literalmente usar entidades finales en T2, habría que reordenar o fusionar Tasks 2, 5, 6 y 9, aumentando solapamiento y contexto. |
| B2 | Task 3 espera redirección a `/app/dashboard`, cuya página se crea en Task 13. | T3 vs T13. | **Ruling:** T3 prueba el destino de redirección y usa una página autenticada mínima/placeholder de infraestructura, sin dashboard ni métricas; T13 reemplaza esa superficie. Alternativamente el E2E intercepta la navegación, pero no puede exigir UI de T13. | Si no se permite un destino mínimo, el E2E de T3 permanecerá rojo hasta T13. |
| B3 | Task 8 usa `READY`, pero la especificación define únicamente `READY_TO_ISSUE`. | Spec §12–13 vs Task 8. | **Ruling:** el flujo normativo es `DRAFT → READY_TO_ISSUE → PROCESSING → DIAN_PENDING → DIAN_ACCEPTED → ISSUED`; `READY` no existe ni se acepta como alias persistido o público. | Datos/contratos incompatibles y migración posterior si consumidores adoptan `READY`. |
| B4 | Task 8 publica `pdf.generate` y describe el avance hasta `ISSUED`, pero el renderer, almacenamiento y artefactos finales aparecen en Task 9. | T8 vs T9. | **Ruling:** T8 posee la máquina fiscal, outbox y contrato versionado de `pdf.generate`; su prueba usa un consumidor fake y puede dejar el documento en `DIAN_ACCEPTED` hasta confirmar el evento fake. Task 9 implementa el consumidor real y la integración que culmina en `ISSUED`. T8 no importa `artifacts` concreto. | Si T8 implementa PDF/Storage prematuramente, duplica el ownership de T9 y acopla emisión a infraestructura. |
| B5 | Task 10 exige asiento reverso, mientras `reverseDocument` y las tablas contables nacen en Task 11. | T10 vs T11. | **Ruling:** T10 publica el hecho/puerto `AdjustmentAccepted`/`AccountingAdjustmentPort` y prueba con fake que solicita reverso; T11 implementa y prueba el reverso contable real. La transición fiscal no depende de una importación concreta de accounting. | Sin puerto/fake, T10 adelanta contabilidad o su prueba es imposible; con un contrato mal diseñado habrá adaptación en T11. |
| B6 | Los jobs de T8 enumeran solo `tenant_id`, `document_id`, `request_id`; el estándar Nuvora exige además versión de esquema e idempotencia explícita. | Task 8 vs `nuvora-architecture` y AGENTS (idempotencia/job safety). | **Ruling:** **todo payload de job**, incluidos T8, T9 y T12, lleva `tenant_id`, `request_id`, ID de entidad, `schema_version` e `idempotency_key`. Los nombres se serializan en `snake_case`; consumidores rechazan versiones desconocidas de forma observable. | Payloads no evolucionables y duplicación de efectos después de retries/redeploys. |
| B7 | Task 11 dice “rechazar emisión si falta mapeo”, pero emisión se implementa en T8 antes de existir accounting. | T8 vs T11. | **Ruling:** T8 expone un precondition hook/puerto aditivo de emisión con implementación no-op explícita para la fase local; T11 registra la validación contable por tenant antes de activar contabilidad. No se permite dependencia `documents → accounting` concreta. | Si la validación se incrusta en T8, T11 debe modificar el núcleo de emisión y puede crear ciclo. |

Ningún hallazgo obliga a reescribir la especificación. B1–B7 son defectos de secuenciación/precisión del plan y deben copiarse al ledger de ejecución como rulings.

## Matriz de pares que comparten archivo o interfaz

“Interfaz” incluye contrato HTTP, tipo compartido, tabla/estado, puerto, evento/job o superficie web producida por una task y consumida/modificada por otra. Las rutas con `*` representan ownership de módulo, no permiso para que varios agentes editen simultáneamente.

| Tasks | Productor → consumidor / superficie compartida | Resultado del escaneo |
|---|---|---|
| T1–T2 | T1 crea API, PostgreSQL, scripts de integración; T2 añade tenancy/RLS. | Compatible. T1 solo scaffolding; T2 posee la semántica tenant. |
| T1–T3 | T1 crea shells API/web; T3 añade auth y páginas públicas. | Compatible si T1 no incluye auth de muestra. |
| T1–T4 | T1 crea `contracts` y `calculation-engine`; T4 define sus APIs fiscales. | Compatible. T1 exporta paquetes vacíos/públicos y no inventa tipos fiscales. |
| T1–T5 | T1 crea shells y aliases públicos; T5 añade módulos y rutas. | Compatible; no wildcard alias a internals. |
| T1–T6 | T1 crea web/API/packages; T6 consume calculation/contracts e introduce invoice-view. | Compatible; `invoice-view` no debe contener cálculo. |
| T1–T7 | T1 crea API/DB/tooling; T7 añade numbering/idempotency. | Compatible. |
| T1–T8 | T1 fija proceso API y worker compartiendo código; T8 añade pg-boss/outbox. | Compatible si ADR deja worker como composition root separado. |
| T1–T9 | T1 levanta MinIO; T9 implementa Storage/PDF. | Compatible; health de T1 no prueba semántica de artefactos. |
| T1–T10 | T1 scaffolding API/web; T10 añade ajustes. | Compatible. |
| T1–T11 | T1 scaffolding API/web/DB; T11 añade accounting. | Compatible. |
| T1–T12 | T1 scaffolding/CI; T12 añade delivery. | Compatible. |
| T1–T13 | T1 crea shell web mínimo; T13 crea app shell definitivo. | Ownership secuencial: T13 puede reemplazar layout placeholder sin alterar auth. |
| T1–T14 | T1 establece puertos/adapters y CI; T14 añade DIAN real. | Compatible; T1 no incorpora SDK/proveedor. |
| T1–T15 | T1 crea CI, healthchecks y env example; T15 endurece despliegue/CSP/logging/health. | Modificación deliberada posterior; T15 debe conservar contratos `/health/live` y `/health/ready`. |
| T1–T16 | T1 crea comandos raíz; T16 consume la suite completa. | Compatible; comandos son interfaz estable de repo. |
| T2–T3 | T2 produce usuarios/tenants/memberships/permisos, `RequestContext` y `withTenant`; T3 consume para sesión/onboarding. | Compatible si onboarding usa transacción tenant-safe; conflicto adelantado T3–T13 cubierto en B2. |
| T2–T5 | RLS/contexto → maestros tenant-scoped. | Compatible, salvo prueba adelantada de cliente en T2: B1. |
| T2–T6 | RLS/contexto → documentos tenant-scoped. | Compatible, salvo prueba adelantada de factura en T2: B1. |
| T2–T7 | Contexto tenant → secuencias e idempotency keys. | Compatible; claves incluyen tenant y repositorios solo dentro de transacción. |
| T2–T8 | Contexto/audit base → emisión, audit y jobs. | Compatible; workers deben establecer `SET LOCAL` con rol restringido. |
| T2–T9 | RLS/contexto → metadata y descargas. | Compatible, salvo descarga adelantada en T2: B1. Storage key nunca sustituye autorización DB. |
| T2–T10 | RLS/contexto → notas. | Compatible. |
| T2–T11 | RLS/contexto → accounting. | Compatible; todas las reglas/asientos llevan tenant. |
| T2–T12 | RLS/contexto → delivery/webhooks. | Compatible; webhook resuelve tenant server-side. |
| T2–T13 | permisos/contexto → navegación y agregados. | Compatible; UI no es frontera de autorización. |
| T2–T14 | tenant/config → DIAN por tenant. | Compatible; secretos cifrados y tenant context obligatorio. |
| T2–T15 | RLS/audit → pruebas de seguridad y restore. | Compatible; T15 debe usar rol restringido y dos tenants. |
| T2–T16 | aislamiento → lifecycle/acceptance. | Compatible. |
| T3–T13 | Auth redirect → `/app/dashboard`; T13 crea dashboard/app shell. | **Conflicto B2**; placeholder o intercept en T3, UI definitiva en T13. |
| T3–T15 | sesiones/CSRF/rate limits/logs → hardening. | Compatible; T15 amplía, no cambia la semántica de sesión. |
| T3–T16 | auth/onboarding → recorrido integral. | Compatible. |
| T4–T5 | enums/DTO fiscales → catálogos de impuestos/productos. | Compatible; seed guarda tratamientos distintos, no colapsa todo en 0 %. |
| T4–T6 | motor/contratos → recálculo servidor y preview. | Compatible; engine puro es única fuente matemática. |
| T4–T10 | cálculo de NC/ND → ajustes. | Compatible; no duplicar reglas en módulos documents/UI. |
| T4–T11 | resultados decimales → posting contable. | Compatible; importes siguen como string/Decimal. |
| T4–T14 | snapshot/totales → XML/CUFE/CUDE. | Compatible; DIAN adapta, no recalcula. |
| T4–T16 | caso AIU y cálculos → aceptación. | Compatible. |
| T5–T6 | clientes/productos/impuestos → borrador y snapshots. | Compatible; T6 copia snapshot, no referencia mutable para render histórico. |
| T5–T13 | settings taxes/master UI → settings/app shell. | Solapamiento de rutas `settings/*`: T5 posee taxes; T13 compone navegación y resto, sin reimplementar taxes. |
| T5–T16 | maestros → lifecycle. | Compatible. |
| T6–T7 | documentos draft → reserva/idempotencia. | Compatible; T7 no asigna número fuera de emisión. |
| T6–T8 | estado/snapshot de documentos → emisión. | Compatible con enum exacto `READY_TO_ISSUE` (B3). T8 modifica solo service específico, no el cálculo de drafts. |
| T6–T9 | `invoice-view`/snapshot → preview y PDF. | Compatible; compartir view model/tokens, no lógica fiscal ni componentes cliente obligatorios. |
| T6–T10 | documentos/line snapshots → NC/ND. | Compatible; ajustes referencian y copian original sin mutarlo. |
| T6–T13 | invoice detail/editor routes → detalle operativo/app shell. | Ownership secuencial: T13 compone acciones; no reimplementa draft service. |
| T6–T16 | factura/preview → lifecycle. | Compatible. |
| T7–T8 | `reserveNextNumber` e idempotency interceptor → issue. | Compatible si reserva ocurre en la misma transacción de bloqueo/outbox. |
| T7–T10 | numeración/idempotencia → NC/ND. | Compatible; secuencia por document type y emisión idempotente. |
| T7–T14 | resolución/ambiente → DIAN config. | Compatible; T14 amplía configuración sin cambiar reserva. |
| T7–T16 | concurrencia → aceptación. | Compatible. |
| T8–T9 | `pdf.generate`, estados, submissions/artifacts → renderer/storage. | **Conflicto B4**; contrato/fake en T8, consumidor real e integración en T9. |
| T8–T10 | máquina de emisión/DIAN provider → emisión de NC/ND. | Compatible si el orquestador es por tipo de documento y no duplica lógica. |
| T8–T11 | aceptación fiscal/preconditions → posting. | **Dependencia B7**; evento/puerto, no import concreto. |
| T8–T12 | documento final/estado separado → entrega. | Compatible; delivery jamás altera estado fiscal. Jobs usan envolvente B6. |
| T8–T13 | errores/estado/audit → dashboard/detalle. | Compatible; backend posee estados y UI solo representa acciones permitidas. |
| T8–T14 | `FiscalAuthorityProvider` mock → direct. | Compatible; sustitución por configuración, sin cambiar consumidores. |
| T8–T15 | jobs/logs/health → observabilidad/hardening. | Compatible; T15 endurece sin registrar payload sensible. |
| T8–T16 | emisión mock → lifecycle. | Compatible tras B3/B4/B6. |
| T9–T12 | URLs firmadas/PDF/XML finales → email y WhatsApp. | Compatible; email adjunta artefactos privados y WhatsApp registra share, no entrega. |
| T9–T13 | descargas/artifacts → detalle. | Compatible; UI obtiene autorización del backend. |
| T9–T14 | artifacts versionados → XML/response DIAN reales. | Compatible; T14 añade kinds/versiones y nunca sobrescribe. |
| T9–T15 | renderer/storage/signed URLs → pruebas SSRF/MIME/path traversal. | Compatible; controles deben existir desde T9 y T15 los valida/endurece. |
| T9–T16 | PDF/XML/descargas → lifecycle. | Compatible. |
| T10–T11 | aceptación de NC/ND → `reverseDocument`. | **Conflicto B5**; puerto/fake en T10, implementación real en T11. |
| T10–T13 | acciones de ajustes → detalle operativo. | Compatible. |
| T10–T14 | NC/ND → DIAN real/CUDE. | Compatible; provider mantiene las tres operaciones. |
| T10–T16 | ajuste/anulación → lifecycle. | Compatible. |
| T11–T13 | asientos/config → detalle y settings. | Compatible; T13 enlaza, no calcula ni muta asientos. |
| T11–T16 | contabilidad → lifecycle. | Compatible. |
| T12–T13 | delivery states/errors → dashboard/detalle. | Compatible; estados delivery separados de fiscal. |
| T12–T15 | webhook/email logs → seguridad/observabilidad. | Compatible; jobs y webhooks usan B6/idempotency. |
| T12–T16 | email/WhatsApp → lifecycle. | Compatible. |
| T13–T14 | settings/app shell → wizard DIAN. | Solapamiento `settings/*`: T13 posee shell/nav; T14 posee contenido DIAN y su contrato. |
| T13–T15 | UI/log views → accessibility/security. | Compatible. |
| T13–T16 | experiencia operativa → lifecycle. | Compatible. |
| T14–T15 | secretos/client DIAN → security/ops. | Compatible; producción sigue bloqueada mientras modelo jurídico sea `UNDECIDED`. |
| T14–T16 | DIAN habilitación → repetición del recorrido piloto. | Compatible y condicional a evidencia oficial. |
| T15–T16 | hardening/restore/runbooks → release gate. | Compatible; T16 consume evidencia fresca, no la presupone. |

Los pares no listados no comparten archivo, contrato, estado, tabla, evento/job ni interfaz pública declarada en el plan.

## Coherencia interna por Task

| Task | Pruebas ↔ código/archivos ↔ resultado | Veredicto y ruling |
|---|---|---|
| T1 | Health test, scripts, CI, compose, ADR y shells coinciden. | **Coherente con precisión:** `/live` solo proceso; `/ready` comprueba dependencias configuradas. CI no puede requerir suites aún inexistentes: scripts vacíos deben terminar 0 sin falsear tests. |
| T2 | RLS y `withTenant` coinciden con migraciones; test menciona entidades/endpoints futuros. | **No coherente literalmente:** aplicar B1. Además toda tabla tenant-scoped usa `FORCE ROW LEVEL SECURITY`/rol sin bypass y `SET LOCAL`. |
| T3 | Auth/onboarding coincide; redirect depende de página futura. | **No coherente literalmente:** aplicar B2. Auditoría de onboarding usa el contrato append-only de T2. |
| T4 | Siete funciones, pruebas y archivos coinciden. | **Coherente:** strings decimales, inputs readonly, escala interna 6 y salida 2. Confirmación normativa del rounding queda gate de producción, no excusa para float. |
| T5 | Migración/seeds/API/UI y pruebas coinciden. | **Coherente:** falta `GET /products/:id` respecto a pantallas posibles, pero no bloquea el contrato mínimo; PATCH products está por encima del API mínimo y es aditivo. |
| T6 | Migración, módulo documents, editor, view model y pruebas coinciden. | **Coherente:** `PATCH` solo DRAFT y versionado optimista; persistir inputs/resultados/snapshots en una transacción. |
| T7 | Migración, service/interceptor y concurrencia coinciden. | **Coherente:** interfaz recibe `tx`; prueba de 50 reservas no debe simular emisión fuera de transacción. Unique del documento final y de idempotencia deben coexistir. |
| T8 | Emisión/jobs/audit coinciden parcialmente; `READY`, PDF real y payload quedan incompletos. | **No coherente:** aplicar B3, B4, B6 y B7. `jobs-recovery.spec.ts` debe quedar bajo `tests/integration/` aunque el listado abrevia la ruta. |
| T9 | Storage/PDF/XML, migración y pruebas coinciden. | **Coherente:** consume job versionado de T8; artifacts append-only, URL 5 minutos y render token de un uso. |
| T10 | NC/ND y E2E coinciden, salvo asiento reverso futuro. | **No coherente literalmente:** aplicar B5. “Factura cancelada” solo después de aceptación de NC total. |
| T11 | Migración/accounting/UI/tests coinciden. | **Coherente con B7:** post solo tras aceptación; reverso enlazado, nunca update/delete; mapeo configurable y decimal. |
| T12 | Delivery migration/module/tests coinciden. | **Coherente con B6:** el plan enumera jobs en spec aunque no en interfaces de la Task; deben existir `email.send/retry` y `webhook.process` con envolvente estándar. URL de WhatsApp expira y no implica entrega. |
| T13 | Dashboard/settings/shell y pruebas coinciden. | **Coherente:** debe respetar ownership previo de `settings/taxes` y posterior de `settings/dian`; agregados bajo tenant transaction. |
| T14 | Adapter real, onboarding DIAN, fixtures, ADR/runbook coinciden. | **Coherente y condicional:** producción bloqueada hasta decisión jurídica, fuentes vigentes y tenant habilitado. El puerto no cambia. |
| T15 | Docs/security tests y modificaciones transversales coinciden. | **Coherente pero paths imprecisos:** antes de dispatch se debe enumerar archivos exactos de despliegue/CSP/logging/health para evitar solapamiento. No difiere controles críticos que debían existir desde su task dueña. |
| T16 | Lifecycle, matriz, runbook y comandos coinciden. | **Coherente:** es validación, no lugar para reparar silenciosamente defects; DIAN real solo si T14 aprobado. |

## Conflictos entre spec, plan, stack y AGENTS

| Tema | Evidencia | Decisión arquitectónica |
|---|---|---|
| Estado previo a emisión | Spec: `READY_TO_ISSUE`; plan T8: `READY`. | Manda spec. Solo `READY_TO_ISSUE` (B3). |
| Payload de jobs | Spec exige tenant/request/idempotencia; skill exige además entity ID, `schema_version`, `idempotency_key`; T8 omite los dos últimos. | Usar envolvente completa B6 en todos los jobs. |
| Fases | Spec Fase 0 incluye auth/tenant/RLS/audit; gate Foundation del plan es T1–T4 y audit completo aparece T8. | Task 2 entrega audit append-only mínimo; T8 amplía eventos fiscales. Foundation v1 no se declara completa hasta T1–T4. |
| Frontend | Spec permite SPA o híbrido y sugiere TanStack Query/RHF; plan cierra SSR/RSC y no obliga esas librerías. | El plan es una especialización válida: SSR/RSC; dependencias opcionales solo si reducen complejidad real. |
| UUID | Spec permite UUID/UUIDv7; plan usa UUID. | UUID es compatible; no añadir UUIDv7 salvo decisión explícita posterior. |
| Arquitectura | Spec permite NestJS/equivalente; AGENTS/plan cierran NestJS Fastify y monolito modular. | Usar NestJS Fastify; módulos no importan infraestructura desde dominio. |
| Auditoría/inmutabilidad | Spec y AGENTS exigen append-only; plan T2 protege audit logs y T8 crea `audit/*`. | T2 posee almacenamiento/política base; T8 posee productor fiscal. No duplicar tablas ni reglas. |
| Dinero | Todos exigen NUMERIC/decimal; plan fija `NUMERIC(20,6)`, strings y HALF_UP. | Aplicar exactamente; validación normativa del rounding antes de producción. |
| Producción DIAN | Spec y plan condicionan salida a modalidad jurídica/habilitación. | Feature flag por tenant no puede eludir `UNDECIDED`; T14/T16 requieren evidencia. |

## Foundation v1 — contrato para Task 1

### Objetivo y límites

Foundation v1 entrega un repositorio arrancable y verificable, no autenticación, tenancy, RLS, reglas fiscales ni integraciones de proveedor. Define composition roots y fronteras para que Tasks 2–16 agreguen comportamiento sin reestructurar el repo.

### Componentes propiedad de Task 1

| Componente | Entrega mínima | No debe incluir |
|---|---|---|
| Workspace raíz | `pnpm-workspace.yaml`, `package.json`, lockfile generado, scripts `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `build`; Node LTS fijada explícitamente. | Scripts falsamente verdes que omitan paquetes existentes; dependencias futuras sin uso. |
| TypeScript | `tsconfig.base.json` strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; project configs por paquete/app. | Aliases hacia `src` interno de otro módulo/paquete. |
| `apps/api` | NestJS + Fastify, composition root, config validada, `/health/live`, `/health/ready`, test HTTP rojo→verde. | Auth, tenancy, dominio fiscal, ORM models de producto, adapters DIAN/email/storage/PDF. |
| `apps/web` | Next.js App Router + Tailwind, layout/page mínima SSR, configuración build/lint. | SPA global, dashboard funcional, invoice editor o secretos server enviados al cliente. |
| `packages/contracts` | Package boundary compilable y export map público vacío/mínimo. | Tipos fiscales especulativos o DTOs de infraestructura. |
| `packages/calculation-engine` | Package boundary compilable sin React/ORM/Nest. | Fórmulas o `number` monetario; T4 posee el API. |
| Infra local | `compose.yaml` con PostgreSQL y MinIO, volúmenes/healthchecks; `.env.example` sin secretos reales. | Redis, Kubernetes, servicios cloud o credenciales productivas. |
| CI | install frozen, lint, typecheck, unit, integration, build, E2E; PostgreSQL/MinIO efímeros y cache segura. | Secretos productivos, dependencia en volúmenes locales, omisión silenciosa de una fase. |
| ADR | `docs/adr/0001-modular-monolith.md`: SSR+API, monolito modular, PostgreSQL/pg-boss, procesos web/API/worker, dependency direction y criterios para separar servicios. | Decisiones fiscales/normativas no validadas. |

### Dependencias permitidas

```text
apps/web ──HTTP/cliente generado──> apps/api public OpenAPI
apps/api composition root ──> módulos application/domain
application ──> domain/pure contracts
infrastructure adapters ──> application ports/domain types
packages/calculation-engine ──> decimal.js only (más utilidades puras justificadas)
packages/contracts ──> zod/types only
```

Prohibido: `domain → Nest/Fastify/Drizzle/React/provider`; `web → api/src`; paquetes shared como cajón de utilidades; ciclos entre módulos; imports por path interno; código fiscal en controller, UI, SQL policy o handler.

### Contratos health

- `GET /health/live`: siempre que el proceso/event loop atienda, `200 {"status":"ok"}`; no consulta dependencias.
- `GET /health/ready`: `200 {"status":"ok"}` cuando dependencias configuradas para ese proceso están listas; si no, `503` con estado estable y sin secretos. En T1, API comprueba PostgreSQL; MinIO solo si queda configurado como dependencia requerida, y el worker todavía no necesita endpoint propio.
- Las respuestas no exponen versiones, DSN, nombres de bucket ni excepciones.

### Criterios de aceptación de Task 1

1. Instalación congelada reproducible con Node LTS y pnpm fijados.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` terminan 0 con salida fresca.
3. El test HTTP demuestra primero ausencia y luego `200` + cuerpo exacto para `/health/live`; al finalizar queda verde.
4. API arranca sobre Fastify y web compila como App Router SSR; no hay lógica demo.
5. PostgreSQL y MinIO pasan healthchecks locales sin secretos reales en git.
6. CI contiene las seis fases (`lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `build`) y servicios efímeros. Si una suite aún no tiene casos, el script documenta y reporta cero casos sin ocultar paquetes con tests.
7. Export maps impiden imports internos entre paquetes; una comprobación automatizada o lint rule evidencia la dirección.
8. ADR documenta fronteras, procesos, decisiones, alternativas rechazadas y triggers medibles de evolución.
9. No existe import de Nest/React/Drizzle/provider en `packages/calculation-engine`; no hay código monetario con JS `number`.
10. No se crean tablas de producto, contratos fiscales, auth, tenancy, jobs ni adapters antes de su task dueña.

### Gate de arquitectura Task 1

**PASS** si cumple los diez criterios y no expande alcance. **FAIL** si introduce dominio de muestra, aliases internos, acoplamiento web→API source, provider concreto en core, scripts que esconden tests o secretos. La aprobación de Task 1 no equivale al gate Foundation: este requiere T1–T4, CI verde, aislamiento RLS probado y AIU exacto.

## Secuencia de ejecución resultante

La numeración del plan se conserva. Antes de cada dispatch, el primary debe registrar owner, paths y dependencias en `docs/coordination/implementation-status.md`. Los contratos que cruzan roles requieren handshake y acknowledgement. Aplicar estos puntos de control:

1. T1 establece Foundation v1.
2. T2 usa fixture/probe de aislamiento (B1), no entidades futuras.
3. T3 usa destino autenticado mínimo (B2).
4. T4 publica contratos fiscales antes de T5/T6/T10/T11.
5. T8 solo se despacha tras T6+T7; usa B3/B4/B6/B7.
6. T9 reconoce el contrato `pdf.generate` v1 antes de implementar consumidor.
7. T10 publica el puerto/evento de accounting y T11 lo reconoce/implementa (B5).
8. Platform gate es obligatorio para T2, T7, T8, T9, T11, T12, T14 y T15 cuando afecten RLS, migraciones, jobs, concurrencia o recovery.
9. QA solo puede devolver `APPROVED`, `REJECTED` o `NOT_VERIFIABLE` después de evidencias integradas; arquitectura no sustituye QA.

## Dictamen

El plan es ejecutable después de incorporar B1–B7 al ledger/briefs. No hay conflicto irresoluble entre especificación, stack aprobado y AGENTS. Se aprueba la arquitectura de **Foundation v1 / Task 1** con los límites y criterios de este documento; no se aprueban por anticipado implementaciones ni gates posteriores.
