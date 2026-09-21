# T6 — Editor de Borradores de Factura, Preview y Migración fiscal

## Descripción

Implementar la Tarea 6 del plan: esquema de documentos fiscales, servicio de borradores en el API (NestJS), editor SSR/híbrido en la web (Next.js) y paquete `invoice-view` compartido. Esto permite crear, editar y previsualizar facturas en estado `DRAFT` antes de emitirlas. El cálculo se delega íntegramente a `@nuvora/calculation-engine`; los resultados y los inputs se persisten juntos en una sola transacción.

---

## Open Questions

> [!IMPORTANT]
> ¿Están en producción las migraciones 0001–0004 (master data)? Si la migración `0004_master_data.sql` no está aplicada en la base de datos de desarrollo, la migración `0005_fiscal_documents.sql` fallará porque referencia `taxes`. **Necesita estar aplicada antes de avanzar.**

> [!NOTE]
> El plan original pide una prueba E2E del editor en viewport móvil/tablet/escritorio. La prueba E2E requiere Playwright y una app corriendo. Para esta tarea se implementará la estructura E2E de esqueleto (fixture + spec vacío) y se completará en la tarea de integración final. Las pruebas de integración y unitarias sí quedan completas.

---

## Proposed Changes

### 0 — Migración: `0005_fiscal_documents.sql`

#### [NEW] [`0005_fiscal_documents.sql`](file:///d:/Nuvora/db/migrations/0005_fiscal_documents.sql)

Tablas a crear:
- `fiscal_documents` — documento principal con estado, versión optimista, tipo (`INVOICE`, `CREDIT_NOTE`, `DEBIT_NOTE`), referencia a cliente, moneda, totales `NUMERIC(20,6)` y snapshot del cliente al momento de crear.
- `fiscal_document_lines` — líneas con descripción, cantidad, precio, descuento, tratamiento impositivo y resultados calculados.
- `fiscal_document_taxes` — resumen de impuestos por tratamiento/tasa.
- `fiscal_document_aiu` — datos AIU cuando aplique.

RLS aplicado a todas las tablas. Permisos `invoices.read` / `invoices.write` insertados en `permissions` y asignados a roles.

---

### 1 — Backend: Módulo `documents`

#### [NEW] [`documents.service.ts`](file:///d:/Nuvora/apps/api/src/documents/documents.service.ts)

Servicio de borradores:
- `createDraft(ctx, dto)` — valida input con Zod, llama a `calculateInvoice()`, persiste inputs + resultados en transacción única con `withTenant`.
- `getDraft(ctx, id)` — recupera documento completo con líneas, impuestos y AIU.
- `listDrafts(ctx, opts)` — lista paginada con cursor.
- `patchDraft(ctx, id, version, dto)` — acepta versión optimista (`version`), recalcula, persiste; rechaza si estado ≠ `DRAFT`; lanza `409` si versión no coincide.

Errores de dominio `DomainError` mapeados a `BadRequestException`; `409 Conflict` para conflicto de versión; `403` si no tiene permiso `invoices.write`.

#### [NEW] [`documents.controller.ts`](file:///d:/Nuvora/apps/api/src/documents/documents.controller.ts)

Endpoints:
- `POST /invoices` → `createDraft`
- `GET /invoices` → `listDrafts` (paginado)
- `GET /invoices/:id` → `getDraft`
- `PATCH /invoices/:id` → `patchDraft` (requiere header `If-Match: <version>` o campo `version` en body)

Decoradores: `@RequirePermission('invoices.read')` / `@RequirePermission('invoices.write')`.

#### [NEW] [`documents.module.ts`](file:///d:/Nuvora/apps/api/src/documents/documents.module.ts)

Registra `DocumentsService` y `DocumentsController`.

#### [MODIFY] [`app.module.ts`](file:///d:/Nuvora/apps/api/src/app.module.ts)

Importa `DocumentsModule`.

---

### 2 — Contratos: DTOs para documentos

#### [MODIFY] [`fiscal.ts`](file:///d:/Nuvora/packages/contracts/src/fiscal.ts)

Añadir:
- `DocumentStatus` enum: `DRAFT | READY | PROCESSING | DIAN_PENDING | DIAN_ACCEPTED | ISSUED | REJECTED | CANCELLED_BY_CREDIT_NOTE`
- `DocumentType` enum: `INVOICE | CREDIT_NOTE | DEBIT_NOTE`
- `CreateDraftSchema` — Zod: `customerId`, `lines[]`, `aiu?`, `currency?`, `notes?`
- `PatchDraftSchema` — Zod partial de `CreateDraftSchema` + `version: number`
- Interfaces `DraftDocument`, `DraftLine`, `DraftTaxSummary`, `DraftAIU`

---

### 3 — Paquete: `packages/invoice-view`

#### [NEW] `packages/invoice-view/package.json`
#### [NEW] `packages/invoice-view/src/index.ts`

Tokens de diseño y modelo de vista para renderizar la factura (tanto en el preview del editor como en el PDF). Solo tipos y funciones de presentación; **sin lógica fiscal**. Exporta:
- `InvoiceViewModel` — estructura aplanada lista para el render.
- `toViewModel(doc: DraftDocument): InvoiceViewModel` — adaptador de transformación.

---

### 4 — Pruebas de integración

#### [NEW] [`invoice-drafts.spec.ts`](file:///d:/Nuvora/tests/integration/invoice-drafts.spec.ts)

Pruebas TDD (rojo primero):
1. Crear borrador → persiste con totales correctos calculados por el motor.
2. Recálculo servidor: patch con nueva cantidad → totales actualizados.
3. Actualización concurrente: dos PATCHes con la misma versión → el segundo recibe `409`.
4. Intento de mutar documento emitido (`ISSUED`) → `422 Unprocessable Entity`.
5. Snapshot histórico: cliente cambia nombre después de crear el borrador → borrador conserva snapshot original.
6. Aislamiento RLS: tenant B no puede leer ni mutar borradores del tenant A.

---

### 5 — UI Web: Páginas de facturas

#### [NEW] [`apps/web/app/app/invoices/page.tsx`](file:///d:/Nuvora/apps/web/app/app/invoices/page.tsx)

Lista de facturas/borradores — SSR. Columnas: número (o "Borrador"), cliente, total, estado, fecha. Botón "Nueva factura".

#### [NEW] [`apps/web/app/app/invoices/new/page.tsx`](file:///d:/Nuvora/apps/web/app/app/invoices/new/page.tsx)

Formulario de creación inicial — SSR con Server Action: seleccionar cliente, añadir al menos una línea, guardar borrador → redirige al editor `/app/invoices/[id]`.

#### [NEW] [`apps/web/app/app/invoices/[id]/page.tsx`](file:///d:/Nuvora/apps/web/app/app/invoices/%5Bid%5D/page.tsx)

Editor de borrador — carga inicial SSR; componentes de edición hidratados en cliente:
- Panel izquierdo: cabecera (cliente, fecha, notas), tabla de líneas con add/remove/reorder, panel AIU.
- Panel derecho (sticky): preview de la factura en tiempo real con watermark **"BORRADOR — NO VÁLIDO COMO FACTURA"**.
- Estado de guardado: indicador "Guardando…" / "Guardado" / "Error al guardar" / "Conflicto de versión".
- Recálculo local instantáneo via `@nuvora/calculation-engine` (importado en cliente); la persistencia llama al API y actualiza la versión.

#### [NEW] [`apps/web/components/invoice-editor/`](file:///d:/Nuvora/apps/web/components/invoice-editor/)

Componentes cliente:
- `InvoiceEditor.tsx` — orquestador principal con `useReducer` para estado del borrador.
- `LineItem.tsx` — fila de línea editable (cantidad, precio, descuento, IVA, tratamiento).
- `AIUPanel.tsx` — panel de configuración AIU colapsable.
- `InvoicePreview.tsx` — renderizado de la factura con tokens de `invoice-view`.
- `SaveStatus.tsx` — indicador visual del estado de guardado.

---

### 6 — Pruebas E2E (esqueleto)

#### [NEW] [`tests/e2e/invoice-editor.spec.ts`](file:///d:/Nuvora/tests/e2e/invoice-editor.spec.ts)

Esqueleto Playwright con fixture de tenant + cliente + borrador; los tests completos de viewport se marcan con `test.todo()` para completar en T16.

---

## Verification Plan

### Automated Tests

```bash
# 1. Aplicar migración nueva
pnpm run db:migrate

# 2. Ejecutar pruebas unitarias del motor (no deben romperse)
pnpm --filter @nuvora/calculation-engine test

# 3. TDD integración: Rojo primero (tablas ausentes), luego Verde
pnpm test:integration -- tests/integration/invoice-drafts.spec.ts

# 4. Suite completa
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

### Manual Verification

- Levantar `docker compose up -d` y `pnpm dev` en api y web.
- Navegar a `/app/invoices` → lista vacía.
- Crear un borrador con 2 líneas mixtas (IVA 19% + exento) → verificar totales coinciden con motor.
- Editar una línea → el preview se actualiza en tiempo real y el indicador muestra "Guardado".
- Intentar hacer PATCH desde dos pestañas simultáneas → segunda recibe aviso de conflicto de versión.

---

## Commit

```
feat: add invoice drafts editor and live preview
```
