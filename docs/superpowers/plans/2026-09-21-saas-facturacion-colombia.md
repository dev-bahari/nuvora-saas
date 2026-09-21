# Plan de implementación — SaaS de facturación electrónica para Colombia

> **Para agentes de implementación:** SUB-SKILL OBLIGATORIA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Marcar cada casilla al terminarla.

**Objetivo:** construir un SaaS web multiempresa, seguro y listo para operar facturación local, documentos electrónicos, entrega y contabilidad básica; la salida a producción DIAN queda condicionada a validación normativa y habilitación.

**Arquitectura:** monorepo TypeScript con una aplicación web Next.js renderizada en servidor y una API NestJS como monolito modular. El dominio fiscal y el motor de cálculo permanecen puros; PostgreSQL aplica RLS y guarda el estado transaccional; almacenamiento, DIAN, correo y PDF se conectan mediante puertos pequeños con una implementación inicial cada uno. Se escala primero replicando web/API/workers y separando procesos; no se crean microservicios hasta que mediciones operativas lo justifiquen.

**Stack:** Node.js LTS, pnpm workspaces, TypeScript estricto, React con Next.js App Router (SSR/RSC), Tailwind CSS, NestJS REST/OpenAPI sobre Fastify, PostgreSQL, Drizzle ORM + SQL versionado, `decimal.js`, `pg-boss`, S3/MinIO, Playwright/Chromium, Resend, Vitest y Playwright E2E.

**Especificación:** `SPECS_SaaS_Facturacion_Colombia.md`

## Restricciones globales

- No es una SPA: navegación, lectura inicial, autenticación y páginas indexables/compartibles usan SSR/RSC; los componentes cliente quedan limitados a formularios interactivos, editor y preview.
- Todo dato comercial, fiscal, contable o de entrega pertenece a un `tenant_id`; el backend deriva el tenant de la sesión y PostgreSQL aplica RLS.
- Autorización con permisos explícitos además de roles; nunca confiar en un `tenant_id` recibido del navegador.
- Documentos `DIAN_ACCEPTED`, `ISSUED` o `CANCELLED_BY_CREDIT_NOTE` son inmutables y nunca se borran.
- Dinero: `NUMERIC(20,6)` en PostgreSQL, `Decimal` en TypeScript, valores monetarios serializados como `string`; nunca `number` para importes.
- Auditoría crítica append-only e idempotencia obligatoria para emisión, notas, DIAN, correo y webhooks.
- DIAN, almacenamiento, correo y PDF dependen de interfaces del dominio/aplicación, no de proveedores concretos.
- PDF/XML finales se generan desde datos persistidos en servidor y se guardan en bucket privado con SHA-256.
- Sesiones en cookies `HttpOnly`, `Secure`, `SameSite=Lax`; Argon2id, CSRF en mutaciones, rate limiting, CSP y secretos fuera del cliente y logs.
- Código limpio: módulos cohesionados, nombres de dominio, funciones cortas, dependencias dirigidas hacia dominio, SRP/DIP; no crear interfaces de una implementación salvo fronteras externas o puntos exigidos por la especificación.
- Cada tarea termina con pruebas, documentación afectada y un commit pequeño; ningún avance oculta pruebas rojas.
- Antes de producción se verifican reglas de redondeo, catálogos, XML, firma, CUFE/CUDE y motivos contra la normativa y Anexo Técnico DIAN vigentes.

## Decisiones cerradas para implementar

| Tema | Decisión |
|---|---|
| Web | Next.js App Router, SSR/RSC; React cliente solo para interacción local |
| Backend | Node.js + TypeScript + NestJS sobre Fastify, monolito modular desplegable por separado de la web |
| Procesamiento | Mismo código de API en un proceso worker dedicado con `pg-boss` |
| Persistencia | PostgreSQL + Drizzle; migraciones SQL revisables; RLS obligatoria |
| Auth | Sesión opaca persistida y cookie segura; no JWT en LocalStorage |
| Dinero | `decimal.js`; strings en contratos HTTP; redondeo centralizado |
| Infra local | Docker Compose con PostgreSQL y MinIO; sin Redis en MVP |
| DIAN inicial | `MockDianProvider`; adaptador real en hito separado |
| Escala | Réplicas stateless, pool de conexiones, workers horizontales; microservicios solo por evidencia |
| Contrato API | OpenAPI generado y cliente web tipado generado en CI |

## Estructura de archivos

```text
apps/
  api/src/
    main.ts
    app.module.ts
    auth/                 # sesiones, recuperación y guardas
    tenancy/              # contexto tenant, membresías, permisos y RLS
    customers/            # clientes y contactos
    products/             # productos/servicios y catálogos fiscales
    documents/            # facturas, notas, emisión y consultas
    numbering/            # reserva transaccional de consecutivos
    accounting/           # reglas y asientos
    delivery/             # email y enlaces WhatsApp
    dian/                 # puerto, mock, configuración y envíos
    artifacts/            # almacenamiento, XML, PDF, hash y descargas
    audit/                 # eventos append-only
    jobs/                  # productores/handlers pg-boss
    dashboard/            # agregados del tenant
  web/app/
    (public)/login/
    onboarding/
    app/                   # layout autenticado y rutas de la especificación
  web/components/         # UI compartida y accesible
  web/lib/                # cliente API servidor/cliente y sesión
packages/
  calculation-engine/     # dominio matemático puro
  contracts/              # DTO Zod, enums y contratos compartidos
  invoice-view/           # tokens y modelo de representación, no lógica fiscal
db/
  migrations/             # SQL, constraints, triggers y políticas RLS
  seeds/                  # permisos y catálogo colombiano base
tests/
  integration/            # PostgreSQL, RLS, jobs, adaptadores
  e2e/                    # recorridos web completos
docs/
  adr/                    # decisiones significativas
  runbooks/               # operación, incidentes, backup y restauración
```

## Interfaces estables

```ts
type Money = string;
type TenantId = string;
type DocumentId = string;

interface RequestContext {
  userId: string;
  tenantId: TenantId;
  permissions: readonly Permission[];
  requestId: string;
}

interface FiscalAuthorityProvider {
  validateConfiguration(tenantId: TenantId): Promise<ValidationResult>;
  issueInvoice(documentId: DocumentId): Promise<FiscalSubmissionResult>;
  issueCreditNote(documentId: DocumentId): Promise<FiscalSubmissionResult>;
  issueDebitNote(documentId: DocumentId): Promise<FiscalSubmissionResult>;
  queryStatus(documentId: DocumentId): Promise<FiscalSubmissionStatus>;
  getValidationArtifacts(documentId: DocumentId): Promise<FiscalArtifacts>;
}

interface StorageProvider {
  putPrivate(input: PutArtifactInput): Promise<StoredArtifact>;
  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
}

interface EmailProvider {
  sendInvoice(input: SendInvoiceEmailInput): Promise<EmailDeliveryResult>;
}
```

## Foco de revisión

1. Dos solicitudes concurrentes de emisión con la misma clave deben devolver el mismo documento y consumir un solo número.
2. Un usuario del tenant A que adivine IDs o claves de objetos del tenant B debe recibir `404/403` sin metadatos ni URL firmada.
3. Reiniciar un worker entre el envío a DIAN y la persistencia de respuesta no debe duplicar la expedición; el reintento consulta/continúa idempotentemente.
4. Cambios de configuración fiscal posteriores no deben alterar cálculos, XML, PDF ni asientos históricos.
5. Importes extremos, descuentos al 100 %, mezcla 19/5/exento/excluido/no gravado y AIU mínimo inválido deben producir resultados deterministas o errores de dominio explícitos.

---

### Tarea 1: Fundación del monorepo y controles de calidad

**Archivos:**
- Crear: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `.env.example`, `compose.yaml`
- Crear: `apps/api/*`, `apps/web/*`, `packages/contracts/*`, `packages/calculation-engine/*`
- Crear: `.github/workflows/ci.yml`, `docs/adr/0001-modular-monolith.md`

**Interfaces:** produce workspaces `@nuvora/contracts`, `@nuvora/calculation-engine`, `api`, `web` y comandos raíz `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `build`.

- [ ] Crear el workspace con scripts raíz que deleguen a `pnpm -r` y fijar `engines.node` a la LTS elegida al iniciar.
- [ ] Configurar TypeScript con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` y alias solo entre paquetes públicos.
- [ ] Crear Next.js App Router y NestJS sin lógica de muestra; añadir `/health/live` y `/health/ready`.
- [ ] Añadir PostgreSQL y MinIO a `compose.yaml`, con healthchecks y volúmenes locales.
- [ ] Crear una prueba HTTP que espere `200` y `{ "status": "ok" }` de `/health/live`; ejecutarla primero contra la ruta ausente y luego tras implementarla.
- [ ] Configurar CI: instalación congelada, lint, tipos, unitarias, integración, build y E2E; usar servicios efímeros, nunca secretos productivos.
- [ ] Documentar en ADR por qué SSR + API modular, PostgreSQL/pg-boss y monolito modular son la primera topología.
- [ ] Ejecutar `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; esperar código 0.
- [ ] Commit: `chore: establish secure modular monorepo`.

### Tarea 2: Esquema base, contexto tenant y RLS

**Archivos:**
- Crear: `db/migrations/0001_identity_tenancy.sql`, `db/migrations/0002_rls.sql`
- Crear: `apps/api/src/tenancy/tenant-context.ts`, `tenant-transaction.ts`, `permission.guard.ts`
- Crear: `tests/integration/tenant-isolation.spec.ts`

**Interfaces:**
- Produce `withTenant<T>(ctx: RequestContext, work: (tx: DbTx) => Promise<T>): Promise<T>`.
- Produce permisos enumerados en la especificación y `requirePermission(permission)`.

- [ ] Escribir la prueba con tenant A/B, usuario A/B, cliente y factura por tenant; comprobar lectura directa, endpoint y descarga cruzada con resultado vacío o `403/404`.
- [ ] Ejecutar `pnpm test:integration tenant-isolation`; esperar fallo por tablas ausentes.
- [ ] Crear `users`, `tenants`, `memberships`, `roles`, `permissions`, `role_permissions`, `membership_permissions`, `sessions` y `audit_logs`; UUID, timestamps UTC y claves foráneas.
- [ ] Añadir `tenant_id NOT NULL` a toda tabla tenant-scoped y políticas `USING/WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)`; el rol de aplicación no puede evadir RLS.
- [ ] Implementar `withTenant` como transacción que ejecuta `SET LOCAL app.tenant_id` y `SET LOCAL app.user_id`; prohibir acceso de repositorios fuera de esa transacción.
- [ ] Sembrar roles y permisos mínimos; la guarda consulta permisos efectivos de la membresía activa.
- [ ] Añadir trigger que impida `UPDATE/DELETE` de `audit_logs` al rol de aplicación.
- [ ] Repetir la prueba incluyendo IDs existentes del otro tenant; esperar cero fuga.
- [ ] Commit: `feat: enforce tenant isolation with postgres rls`.

### Tarea 3: Autenticación, sesiones y onboarding seguro

**Archivos:**
- Crear: `apps/api/src/auth/*`, `db/migrations/0003_auth.sql`
- Crear: `apps/web/app/(public)/login/page.tsx`, `apps/web/app/onboarding/page.tsx`
- Test: `tests/integration/auth.spec.ts`, `tests/e2e/login-onboarding.spec.ts`

**Interfaces:** produce `POST /auth/login`, `POST /auth/logout`, `POST /auth/password/request`, `POST /auth/password/reset`, `GET /auth/session`.

- [ ] Escribir pruebas para login válido, contraseña errónea indistinguible, bloqueo por tasa, token de recuperación de un uso, rotación de sesión y cookie segura.
- [ ] Implementar hash Argon2id, sesión opaca hasheada en BD, expiración/rotación y cookies `HttpOnly/Secure/SameSite=Lax`.
- [ ] Aplicar protección CSRF a mutaciones autenticadas y rate limits por IP + identidad cuando exista.
- [ ] Implementar onboarding transaccional: crear tenant, membresía `OWNER`, configuración `America/Bogota`/`COP` y evento de auditoría.
- [ ] Renderizar login y onboarding en servidor; usar acciones/formularios progresivos, Zod y mensajes accesibles.
- [ ] Verificar que ningún HTML, respuesta, source map o log contenga hashes, tokens o secretos.
- [ ] Ejecutar integración y E2E; esperar login, creación de tenant y redirección a `/app/dashboard`.
- [ ] Commit: `feat: add secure sessions and tenant onboarding`.

### Tarea 4: Contratos y motor decimal de cálculo

**Archivos:**
- Crear: `packages/contracts/src/fiscal.ts`, `packages/calculation-engine/src/*.ts`
- Test: `packages/calculation-engine/src/calculation.test.ts`

**Interfaces:** produce `roundMoney`, `calculateLine`, `calculateTaxes`, `calculateAIU`, `calculateInvoice`, `calculateCreditNote`, `calculateDebitNote`; todos reciben objetos readonly y devuelven strings decimales.

- [ ] Definir `TaxTreatment`, `AiuTaxMode`, entradas/salidas y `DomainError` con códigos estables; Zod rechaza `NaN`, exponentes, más de 6 decimales y valores negativos no permitidos.
- [ ] Escribir pruebas fallidas para IVA 19 %, IVA 5 %, exento, excluido, no gravado, mezcla por línea, descuentos, redondeo y descuento 100 %.
- [ ] Añadir el caso AIU obligatorio: base `38888155.32`, A `4`, I `3`, U `10`, IVA utilidad `19`; esperar total exacto `46238016.67`.
- [ ] Añadir pruebas para AIU especial por debajo del mínimo configurado, AIU informativo, crédito total/parcial y débito permitido.
- [ ] Implementar las siete funciones con `decimal.js`; una única política `ROUND_HALF_UP` y escala monetaria 2 para totales presentados, preservando escala interna 6.
- [ ] Congelar/copiar entradas y agregar pruebas de propiedad: suma de impuestos agrupados igual a impuesto total y total nunca cambia por orden de líneas.
- [ ] Ejecutar `pnpm --filter @nuvora/calculation-engine test`; esperar todas las cifras exactas.
- [ ] Commit: `feat: add deterministic fiscal calculation engine`.

### Tarea 5: Maestros fiscales, clientes y productos

**Archivos:**
- Crear: `db/migrations/0004_master_data.sql`, `db/seeds/colombia.sql`
- Crear: `apps/api/src/customers/*`, `products/*`
- Crear: `apps/web/app/app/customers/*`, `products/*`, `settings/taxes/*`
- Test: `tests/integration/master-data.spec.ts`, `tests/e2e/master-data.spec.ts`

**Interfaces:** REST `GET/POST/PATCH /customers`, `GET/POST/PATCH /products`, `GET /taxes`; búsquedas paginadas con cursor.

- [ ] Escribir pruebas de duplicado de identificación por tenant, mismo documento en tenant distinto, búsquedas normalizadas y productos inactivos no seleccionables.
- [ ] Crear tablas y constraint único `(tenant_id, identification_type, identification)`; guardar emails adicionales/contactos en tabla hija.
- [ ] Sembrar IVA 19, IVA 5, IVA 0 exento, excluido y no gravado; no sembrar 21 %.
- [ ] Implementar repositorios pequeños dentro de cada módulo, DTO Zod/OpenAPI y permisos read/write.
- [ ] Crear páginas SSR de lista/detalle y formularios accesibles; una línea manual no depende de producto.
- [ ] Ejecutar integración/E2E incluyendo aislamiento y teclado; esperar altas, edición y búsquedas correctas.
- [ ] Commit: `feat: add tenant-scoped customers products and taxes`.

### Tarea 6: Borradores de factura, editor SSR/híbrido y preview

**Archivos:**
- Crear: `db/migrations/0005_fiscal_documents.sql`
- Crear: `apps/api/src/documents/*`
- Crear: `apps/web/app/app/invoices/*`, `apps/web/components/invoice-editor/*`
- Crear: `packages/invoice-view/src/*`
- Test: `tests/integration/invoice-drafts.spec.ts`, `tests/e2e/invoice-editor.spec.ts`

**Interfaces:** `POST/GET/PATCH /invoices`, `GET /invoices/:id`; `PATCH` acepta versión optimista y solo estado `DRAFT`.

- [ ] Escribir pruebas de creación, recálculo servidor, actualización concurrente, intento de mutar emitida y snapshot histórico del cliente/producto/impuestos.
- [ ] Crear `fiscal_documents`, líneas, impuestos y AIU con importes `NUMERIC(20,6)`, versión y constraints de tipo/estado.
- [ ] Implementar servicio de borradores que recalcula con el paquete puro y persiste inputs + resultados en una transacción.
- [ ] Renderizar la página inicialmente en servidor; hidratar solo editor, reordenamiento y preview local usando el mismo motor.
- [ ] Mostrar watermark `BORRADOR — NO VÁLIDO COMO FACTURA`, estados guardando/error y aviso por conflicto de versión.
- [ ] Añadir AIU con selección de líneas, tres modos, defaults del tenant y error de mínimo configurable.
- [ ] Ejecutar pruebas con mezcla fiscal y viewport móvil/tablet/escritorio; esperar preview idéntico al cálculo persistido.
- [ ] Commit: `feat: add invoice drafts editor and live preview`.

### Tarea 7: Numeración e idempotencia concurrente

**Archivos:**
- Crear: `db/migrations/0006_numbering_idempotency.sql`
- Crear: `apps/api/src/numbering/*`, `apps/api/src/common/idempotency/*`
- Test: `tests/integration/numbering-concurrency.spec.ts`

**Interfaces:** `reserveNextNumber(tx, tenantId, documentType): Promise<{prefix:string; number:number}>`; interceptor de `Idempotency-Key` ligado a tenant, operación y hash de request.

- [ ] Escribir una prueba que lance 50 reservas concurrentes y espere 50 números únicos, continuos y dentro de rango.
- [ ] Escribir pruebas para replay idéntico, misma clave con body diferente (`409`) y operación fallida reanudable.
- [ ] Crear `document_sequences` e `idempotency_keys`, unique `(tenant_id, document_type, prefix, number)` y validaciones de vigencia/rango/ambiente.
- [ ] Implementar reserva con transacción y `SELECT ... FOR UPDATE`; no incrementar fuera de la transacción de emisión.
- [ ] Implementar idempotencia almacenando estado, hash y respuesta; limpiar solo claves expiradas no vinculadas a documentos fiscales.
- [ ] Ejecutar la prueba repetidamente; esperar cero duplicados.
- [ ] Commit: `feat: make fiscal numbering and writes idempotent`.

### Tarea 8: Emisión local, estados, auditoría y jobs

**Archivos:**
- Crear: `db/migrations/0007_submissions_jobs.sql`
- Crear: `apps/api/src/documents/issue-document.service.ts`, `dian/mock-dian.provider.ts`, `jobs/*`, `audit/*`
- Test: `tests/integration/issue-workflow.spec.ts`, `jobs-recovery.spec.ts`

**Interfaces:** `POST /invoices/:id/issue`; jobs `dian.submit`, `dian.poll`, `pdf.generate`; eventos de estado definidos en la especificación.

- [ ] Escribir el flujo fallido DRAFT → READY → PROCESSING → DIAN_PENDING → DIAN_ACCEPTED → ISSUED y el rechazo con mensaje original.
- [ ] Crear envíos/versiones de artefacto y registrar auditoría con actor, request, before/after sin secretos.
- [ ] Implementar `MockDianProvider` determinista con escenarios accept/reject/pending por configuración de prueba.
- [ ] Configurar `pg-boss`, backoff acotado, límite de intentos y dead-letter state; handlers reciben `tenant_id`, `document_id`, `request_id`.
- [ ] Bloquear mutaciones al iniciar emisión, reservar número dentro de la transacción y publicar job mediante patrón outbox en PostgreSQL.
- [ ] Simular cierre del worker después del envío y antes de persistir; reintento debe consultar/reconciliar y no emitir dos veces.
- [ ] Exponer dashboard de errores con código, mensaje original, campo, intento y acción legalmente permitida.
- [ ] Commit: `feat: add durable mock fiscal issuance workflow`.

### Tarea 9: Artefactos privados, XML mock y PDF final

**Archivos:**
- Crear: `db/migrations/0008_artifacts.sql`
- Crear: `apps/api/src/artifacts/*`
- Crear: `apps/web/app/api/internal/invoice-render/[id]/route.ts`
- Test: `tests/integration/artifacts.spec.ts`, `tests/e2e/pdf.spec.ts`

**Interfaces:** `GET /invoices/:id/pdf`, `GET /invoices/:id/xml`; `StorageProvider` y `PdfRenderer`.

- [ ] Escribir pruebas para bucket privado, URL expirable, hash SHA-256, MIME permitido y denegación cross-tenant.
- [ ] Crear `fiscal_artifacts` inmutable por `(document_id, kind, attempt, sha256)`; jamás sobrescribir intentos.
- [ ] Implementar adaptador S3/MinIO y URLs firmadas de 5 minutos sin IDs internos en rutas públicas.
- [ ] Generar XML mock con snapshot persistido y esquema propio validable; marcarlo explícitamente como no DIAN.
- [ ] Crear vista interna protegida por token efímero de un uso y render PDF A4 con Playwright desde servidor.
- [ ] Compartir tokens de diseño/modelo de vista entre preview y PDF, no la lógica fiscal; incluir QR, CUFE/CUDE cuando exista y watermark solo en borrador.
- [ ] Probar PDF multipágina, encabezado/pie, hash y regeneración versionada.
- [ ] Commit: `feat: generate immutable private fiscal artifacts`.

### Tarea 10: Notas crédito, anulación y notas débito

**Archivos:**
- Crear: `apps/api/src/documents/credit-notes/*`, `debit-notes/*`
- Crear: `apps/web/app/app/credit-notes/*`, `debit-notes/*`
- Test: `tests/integration/adjustments.spec.ts`, `tests/e2e/cancel-invoice.spec.ts`

**Interfaces:** endpoints de la especificación y `createTotalCancellation(invoiceId, reasonCode, date, note?)`.

- [ ] Escribir pruebas de NC total, NC parcial limitada al saldo/líneas originales, asiento reverso y factura cancelada solo después de aceptación.
- [ ] Escribir pruebas que rechacen nota sobre nota, reutilización de número y mutación de factura original.
- [ ] Implementar copia referencial del snapshot original, CUDE mock y consecutivo propio.
- [ ] Implementar débito solo para motivos configurados; si el propósito es mayor valor, mostrar advertencia y acción preferida “Crear factura adicional”.
- [ ] Hacer que `Anular factura` cree NC total; nunca ejecutar `DELETE` ni liberar numeración.
- [ ] Ejecutar E2E completo hasta `CANCELLED_BY_CREDIT_NOTE` y comprobar enlaces bidireccionales/auditoría.
- [ ] Commit: `feat: add compliant credit and debit note flows`.

### Tarea 11: Contabilidad básica inmutable

**Archivos:**
- Crear: `db/migrations/0009_accounting.sql`
- Crear: `apps/api/src/accounting/*`
- Crear: `apps/web/app/app/accounting/*`
- Test: `tests/integration/accounting.spec.ts`

**Interfaces:** `postDocument(documentId): Promise<JournalEntryId>`; `reverseDocument(originalEntryId, adjustmentDocumentId)`.

- [ ] Escribir pruebas de factura contado/crédito, IVA, AIU por cuentas configuradas, NC total/parcial, periodo cerrado y Debe = Haber.
- [ ] Crear plan de cuentas, reglas, periodos, asientos y líneas; importes decimal, reference única por documento/tipo de asiento.
- [ ] Implementar reglas configurables por tenant, sin códigos PUC hardcodeados; rechazar emisión si falta mapeo requerido.
- [ ] Crear asiento solo tras aceptación fiscal; no editar/borrar asientos automáticos, usar reverso enlazado.
- [ ] Renderizar diarios y plan de cuentas en SSR con permisos `accounting.read/write`.
- [ ] Ejecutar prueba que sume débitos/créditos en PostgreSQL; esperar igualdad exacta.
- [ ] Commit: `feat: post immutable balanced journal entries`.

### Tarea 12: Email, webhooks y WhatsApp V1

**Archivos:**
- Crear: `db/migrations/0010_delivery.sql`
- Crear: `apps/api/src/delivery/*`
- Test: `tests/integration/delivery.spec.ts`, `tests/e2e/delivery.spec.ts`

**Interfaces:** `POST /invoices/:id/send-email`, `POST /invoices/:id/share-whatsapp`, `POST /webhooks/resend`.

- [ ] Escribir pruebas con `FakeEmailProvider`: solo documento final, adjuntos correctos, reply-to tenant, reintento idempotente y estados separados del fiscal.
- [ ] Crear `email_deliveries`, `whatsapp_shares`, `webhook_events`; guardar provider ID, destinatarios, asunto, estado, error e intentos.
- [ ] Implementar `ResendEmailProvider` detrás de `EmailProvider`; API key solo servidor y remitente de plataforma configurable.
- [ ] Verificar firma del webhook, deduplicar evento y actualizar delivered/bounced/complained/failed.
- [ ] Crear enlace WhatsApp con teléfono normalizado, texto prellenado y URL firmada corta; registrar share sin afirmar entrega.
- [ ] Ejecutar pruebas y comprobar que logs/respuestas no contienen API keys ni URL después de expirar.
- [ ] Commit: `feat: deliver final documents by email and whatsapp link`.

### Tarea 13: Dashboard y experiencia operativa completa

**Archivos:**
- Crear: `apps/api/src/dashboard/*`
- Crear: `apps/web/app/app/dashboard/page.tsx`, `app/settings/*`, `components/app-shell/*`
- Test: `tests/e2e/dashboard-settings.spec.ts`, `accessibility.spec.ts`

**Interfaces:** `GET /dashboard/summary`; páginas de configuración y detalle enumeradas en la especificación.

- [ ] Escribir prueba de agregados aislados por tenant: ventas, IVA, emitidas, pendientes/rechazadas, NC, emails fallidos y numeración disponible.
- [ ] Implementar consultas agregadas con índices medidos mediante `EXPLAIN`; no crear tablas de resumen hasta necesitarlo.
- [ ] Construir app shell SSR responsive, navegación por permisos, foco visible, landmarks, labels, errores anunciados y contraste AA.
- [ ] Completar detalle de factura con descarga, validación, email, WhatsApp, NC, asiento y auditoría.
- [ ] Completar settings de empresa, impuestos, AIU, numeración, email, usuarios y auditoría.
- [ ] Ejecutar E2E con teclado y axe; esperar cero violaciones críticas/serias.
- [ ] Commit: `feat: complete tenant dashboard and operator workflows`.

### Tarea 14: Adaptador DIAN real y habilitación por tenant

**Archivos:**
- Crear: `apps/api/src/dian/direct/*`, `dian/encryption/*`, `dian/onboarding/*`
- Crear: `apps/web/app/app/settings/dian/*`
- Test: `tests/integration/dian-sandbox.spec.ts`, fixtures XML firmados versionados
- Documentar: `docs/runbooks/dian-habilitacion.md`, `docs/adr/0002-dian-operating-model.md`

**Interfaces:** implementa `DirectDianProvider` sin cambiar consumidores del puerto.

- [ ] Registrar en ADR la decisión jurídica: software propio por tenant, proveedor tecnológico propio o tercero autorizado; bloquear producción mientras esté `UNDECIDED`.
- [ ] Descargar y fijar en el repositorio de pruebas los XSD, catálogos y ejemplos oficiales vigentes, registrando versión, fecha, URL y SHA-256.
- [ ] Escribir fixtures fallidos para factura, NC, ND, CUFE/CUDE, QR, firma XAdES, AttachedDocument, rechazo y contingencia.
- [ ] Implementar generador UBL por versión y validación XSD antes de enviar; mensajes de error conservan código/campo original.
- [ ] Implementar firma con certificado cifrado por tenant; usar envelope encryption/KMS y nunca devolver contraseña o clave privada.
- [ ] Implementar cliente DIAN con timeouts, idempotencia, circuit breaker sencillo, persistencia de request/response y conciliación tras timeout.
- [ ] Crear wizard de perfil, modo, software, certificado, habilitación, set configurable, numeración y producción.
- [ ] Ejecutar set oficial en ambiente de habilitación para un tenant piloto y archivar evidencia/hashes.
- [ ] Cambiar el tenant piloto a `DirectDianProvider` mediante configuración; repetir E2E sin cambiar dominio, cálculo ni UI de factura.
- [ ] Commit: `feat: integrate tenant-scoped dian validation`.

### Tarea 15: Seguridad, privacidad, observabilidad y recuperación

**Archivos:**
- Crear: `docs/runbooks/security.md`, `backup-restore.md`, `incident-response.md`, `privacy-retention.md`
- Crear: `tests/security/*`, `tests/integration/backup-restore.spec.ts`
- Modificar: despliegue, CSP, logging y healthchecks

**Interfaces:** logs JSON con `request_id`, `tenant_id`, `document_id`; endpoints live/ready; métricas sin PII.

- [ ] Crear pruebas de autorización rota, CSRF, brute force, upload MIME falso, path traversal, SSRF en render, secretos en logs y acceso a URL firmada ajena.
- [ ] Aplicar CSP, cabeceras seguras, límites de body, validación MIME/contenido, timeouts y lista permitida para destinos de red.
- [ ] Añadir redacción central de secretos/PII a logs y trazas; emitir métricas de latencia, jobs, DIAN, entrega y pool DB.
- [ ] Definir retención por clase de dato y bloqueo legal para documentos; solicitudes de datos no borran registros fiscales obligatorios.
- [ ] Automatizar backup cifrado y ejecutar restauración en entorno vacío; comprobar conteos, hashes y RLS.
- [ ] Ejecutar análisis de dependencias, SAST, prueba dinámica y revisión manual de amenazas; corregir hallazgos altos/críticos antes de liberar.
- [ ] Commit: `chore: harden operations privacy and disaster recovery`.

### Tarea 16: Validación integral y salida controlada

**Archivos:**
- Crear: `tests/e2e/fiscal-lifecycle.spec.ts`, `docs/runbooks/release.md`, `docs/acceptance-matrix.md`

**Interfaces:** recorrido único de aceptación que cubre los 24 criterios del SPECS.

- [ ] Ejecutar E2E: tenant A/B, cliente, producto y línea manual, factura mixta, AIU, preview, borrador, emisión mock, PDF/XML, email, WhatsApp, NC parcial, anulación total y asiento.
- [ ] Repetir contra DIAN habilitación para el tenant piloto cuando Tarea 14 esté aprobada.
- [ ] Correr carga con concurrencia sobre login, listas, reserva/emisión y workers; fijar SLO inicial medido y capacidad segura, sin inventar objetivos previos a la medición.
- [ ] Verificar los 24 criterios del MVP en `docs/acceptance-matrix.md` con prueba/evidencia exacta y responsable.
- [ ] Hacer revisión de arquitectura: dependencias entre módulos, consultas sin contexto tenant, imports de infraestructura en dominio y rutas cliente con secretos.
- [ ] Ejecutar `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm test:e2e && pnpm build`; esperar código 0.
- [ ] Realizar restauración final, rollback de despliegue y simulacro de rechazo/timeout DIAN.
- [ ] Liberar primero a un tenant piloto con feature flag de emisión real, alertas activas y rollback a mock solo fuera de documentos ya emitidos.
- [ ] Commit: `release: validate colombia invoicing mvp`.

## Gates de fase

| Gate | Condición de salida |
|---|---|
| Foundation | Tareas 1–4; CI verde, RLS probado y caso AIU exacto |
| Facturación local | Tareas 5–9 y 11; borradores, mock, artefactos y asientos operables |
| Documentos completos | Tarea 10; NC/ND y anulación sin mutar originales |
| Entrega y operación | Tareas 12–13; canales y UX completa |
| DIAN real | Tarea 14; modelo jurídico decidido y tenant habilitado |
| Producción | Tareas 15–16; seguridad, restauración y matriz de aceptación aprobadas |

## Fuera del MVP

- MFA obligatorio, dominios de correo por tenant y WhatsApp Business Cloud API.
- Cartera, recaudos, compras, cuentas por pagar, inventario, bancos, conciliación, nómina, POS, impuestos completos, RADIAN y factoring.
- Retenciones completas; el esquema admite una colección tipada futura, pero no calcula retefuente/reteIVA/reteICA en este MVP.
- Microservicios, Kubernetes, event streaming y caché distribuida: se añaden solo ante carga medida o equipos autónomos con necesidad real.

## Validación normativa obligatoria antes de producción

- Confirmar versión vigente del Anexo Técnico, XSD, catálogos, endpoints, política de firma y reglas CUFE/CUDE/QR.
- Confirmar modalidad operativa del SaaS y obligaciones de proveedor tecnológico con asesoría especializada/DIAN.
- Confirmar AIU, mínimos, motivos de NC/ND, contingencia, conservación documental y reglas de redondeo.
- La DIAN publica el [Anexo Técnico de Factura Electrónica de Venta 1.9](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/) y describe por separado la [habilitación como facturador electrónico](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/proceso-de-registro-y-habilitacion-como-facturador-electronico/) y los [proveedores tecnológicos](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/proveedores-tecnologicos/); volver a comprobar estas fuentes en cada release fiscal.

## Autorrevisión del plan

- Cobertura: los 24 criterios del MVP se asignan a Tareas 2–16; módulos ERP futuros quedan explícitamente fuera.
- Sin placeholders: cada tarea define archivos, interfaces, prueba, implementación, verificación y commit.
- Tipos consistentes: importes son strings/Decimal; IDs y contexto tenant son estables; estados fiscal y entrega permanecen separados.
- Riesgos principales cubiertos: concurrencia, aislamiento, recuperación de jobs, histórico inmutable y entradas monetarias límite tienen pruebas propietarias.
