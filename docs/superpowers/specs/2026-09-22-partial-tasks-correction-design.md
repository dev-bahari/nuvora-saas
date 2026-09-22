# Diseño de corrección de las tareas parciales

**Fecha:** 2026-09-22  
**Alcance:** cerrar las tareas parciales T1, T3 y T5–T15 del plan aprobado, sin ampliar el MVP.

## Objetivo

Llevar las trece tareas parciales a un estado reproducible y verificable: migraciones limpias e incrementales, contratos consistentes, pruebas reales, aislamiento por tenant y gates de calidad verdes. T2 y T4 se conservan como bases ya verificadas; T16 permanece fuera de esta corrección y se ejecutará después como gate de salida integral.

## Decisión operativa DIAN

Nuvora operará inicialmente como software propio de la empresa propietaria del producto. La transmisión DIAN real estará habilitada únicamente para un tenant piloto expresamente configurado. Todos los demás tenants usarán `MockDianProvider` y tendrán bloqueada la emisión real.

Cada tenant mantiene de forma independiente su NIT, certificado, credenciales de software, clave técnica, resolución, prefijo, rangos y artefactos. La futura activación DIAN para terceros queda condicionada a una definición jurídica formal sobre software adquirido frente a proveedor tecnológico.

## Arquitectura de corrección

### 1. Base estable

- Reparar las migraciones 0006–0013 para instalación limpia y actualización desde 0005.
- Corregir contratos TypeScript, composición de dependencias NestJS y lint.
- Sustituir comandos de prueba simulados por suites ejecutables.
- Mantener el monolito modular y los límites existentes; no introducir servicios separados.

### 2. Núcleo fiscal

- Completar numeración e idempotencia dentro de la transacción de emisión.
- Publicar trabajos durables con `pg-boss` usando la envolvente aprobada.
- Implementar reintentos acotados, recuperación tras caída y fallo terminal observable.
- Completar artefactos privados, ajustes, contabilidad y entrega sin duplicar reglas fiscales fuera del dominio.

### 3. Experiencia operativa

- Completar páginas faltantes de notas, contabilidad, configuración y detalle documental.
- Conservar SSR por defecto y usar componentes cliente solo para interacción local.
- Validar navegación por permisos, teclado, foco, labels, anuncios de error y contraste.

### 4. DIAN para tenant piloto

- Implementar `DirectDianProvider` detrás del puerto existente.
- Generar UBL versionado, validar contra XSD, firmar con XAdES y conservar request/response inmutables.
- Cifrar certificados y secretos; nunca exponerlos al navegador o a logs.
- Conciliar timeouts e incertidumbre antes de reintentar; nunca emitir dos veces.
- Habilitar `DIRECT` solo cuando el tenant coincida con el piloto y su configuración esté completa.

### 5. Seguridad y recuperación

- Aplicar controles de entrada, red, archivos, logs y URLs firmadas proporcionales al riesgo.
- Automatizar backup cifrado y verificar restauración en una base vacía, incluyendo hashes y RLS.
- Mantener documentos fiscales, artefactos, auditoría y asientos emitidos como datos inmutables.

## Flujo fiscal

1. La petición autenticada aporta `tenantId`, `userId`, permiso e idempotency key.
2. La aplicación abre `withTenant`; PostgreSQL RLS aplica la segunda barrera.
3. La emisión valida, inmoviliza el borrador, reserva número y publica el trabajo en una sola transacción.
4. El worker selecciona proveedor `MOCK` o `DIRECT` según configuración del tenant.
5. El worker genera, firma, transmite y concilia; persiste cada intento y respuesta.
6. Tras aceptación genera artefactos y asiento; la entrega se procesa con estado separado.
7. Rechazos preservan código, campo y mensaje original. Timeouts inciertos pasan a conciliación.

## Contratos e invariantes

- Importes fiscales: PostgreSQL `NUMERIC` y valores decimales como strings/Decimal en TypeScript.
- Ninguna consulta tenant-scoped fuera de `withTenant`.
- Unique de numeración por tenant, tipo, prefijo y número.
- Jobs con `{ tenantId, requestId, entityId, schemaVersion, idempotencyKey, payload }`.
- Estado fiscal independiente del estado de entrega.
- Cambios de contratos compartidos requieren actualización coordinada de productores, consumidores y pruebas.

## Estrategia de verificación

Cada bloque debe aportar evidencia fresca de:

- migración desde base vacía y desde la versión anterior;
- lint y typecheck;
- unitarias e integración con rol PostgreSQL restringido;
- aislamiento de dos tenants;
- idempotencia, concurrencia, duplicados, agotamiento de reintentos y recuperación;
- Playwright E2E real y accesibilidad en los flujos afectados;
- build de producción;
- backup y restauración cuando corresponda.

Una tarea no se considera completa si su comando es un `echo`, contiene pruebas omitidas o depende de credenciales no disponibles. Las pruebas contra DIAN real se ejecutarán únicamente con las credenciales del tenant piloto; sin ellas, el código puede quedar implementado pero el gate DIAN será `NOT_VERIFIABLE`.

## Secuencia y gates

1. Base y migraciones.
2. T7–T9: numeración, jobs y artefactos.
3. T10–T12: ajustes, contabilidad y entregas.
4. T13: experiencia operativa.
5. T14: DIAN piloto.
6. T15: seguridad y recuperación.
7. Revisión integral previa a T16.

Cada bloque pasa revisión de arquitectura y, cuando aplique, plataforma e integración. La corrección completa solo se acepta con veredicto independiente de QA.

## Fuera de alcance

- Habilitar DIAN real para tenants distintos del piloto.
- Tramitar la habilitación jurídica de Nuvora como proveedor tecnológico.
- Microservicios, Kubernetes, caché distribuida o nuevas funciones ERP.
- Ejecutar la salida productiva de T16 antes de cerrar esta corrección.

## Criterio de éxito

Las trece tareas dejan de estar parciales cuando cumplen sus requisitos originales, sus pruebas son reales y reproducibles, la cadena completa de calidad termina con código cero y ningún defecto crítico o alto permanece abierto.
