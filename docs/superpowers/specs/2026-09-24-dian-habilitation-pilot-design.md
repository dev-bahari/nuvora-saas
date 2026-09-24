# Motor DIAN de habilitación — piloto David Caro Morales

## Propósito y alcance

Empyra debe permitir al tenant piloto, cuyo emisor es David Caro Morales como
persona natural, completar el set de pruebas de factura electrónica DIAN y,
solo después de quedar habilitado y asociar numeración de producción, emitir
documentos reales. El modo de operación es software propio.

El alcance cubre factura electrónica, nota crédito y nota débito del set que
la DIAN asigne en el portal. El portal es la fuente de verdad de la cantidad y
el estado del set; el sistema no codifica cantidades históricas.

No cubre habilitación ni emisión real de otros tenants, ni la calificación de
Empyra como proveedor tecnológico.

## Decisiones

- El repositorio `Crispancho93/facturacion-electronica-colombia` se usa solo
  como referencia de interoperabilidad. No se copia su código Python ni su
  modelo de certificados en disco.
- Se reemplaza la dependencia concreta de `MockDianProvider` por el puerto
  `FiscalAuthorityProvider`. El mock permanece para desarrollo y para todos
  los tenants distintos al piloto habilitado explícitamente.
- `DirectDianProvider` construye la solicitud SOAP DIAN, envía el ZIP firmado
  al endpoint que corresponda al ambiente, persiste identificador/respuesta y
  consulta estados asíncronos cuando aplique.
- El firmador recibe un PFX y su cadena de confianza: certificado del firmante,
  CA intermedia y CA raíz. Produce XMLDSig/XAdES conforme al anexo vigente y
  no deja firmas marcador.
- Certificados, contraseña del PFX, PIN y clave técnica son secretos cifrados
  en reposo. Nunca entran en respuestas API, auditoría, logs ni control de
  versiones. Las capturas compartidas se tratan como comprometidas y sus
  secretos se rotan antes de producción.
- Los importes, CUFE/CUDE y XML usan valores decimales canónicos. No se usa
  `parseFloat` en cálculo fiscal.

## Arquitectura y contrato

`documents` conserva el caso de uso: reserva número, crea una fila outbox y
registra auditoría dentro de una transacción de tenant. Un worker procesa esa
fila posteriormente; no hay envío SOAP dentro de la transacción fiscal.

El puerto queda en `apps/api/src/dian`:

```ts
export interface FiscalAuthorityProvider {
  submit(input: DianSubmission): Promise<DianSubmissionResult>;
  poll(input: DianStatusQuery): Promise<DianSubmissionResult>;
}
```

`DianSubmission` contiene solo el documento inmutable, XML firmado o ZIP,
ambiente, `testSetId` cuando se trate de habilitación y el identificador de
idempotencia. `DianSubmissionResult` distingue `ACCEPTED`, `REJECTED` y
`PENDING`; conserva el identificador DIAN y los errores estructurados de
validación. Los consumidores no importan el adaptador directo.

El selector de proveedor permite `MOCK` por defecto. `DIRECT_HABILITACION`
solo se permite para el tenant piloto marcado por configuración de despliegue;
producción requiere una configuración separada y numeración ya asociada.

## Datos, seguridad y operaciones

Se agrega configuración de credencial fiscal por tenant, con una referencia de
secreto cifrado, huella del certificado, fecha de expiración y datos no
secretos de software/ambiente. La tabla de credenciales mantiene RLS forzada.
No se guardan archivos PFX ni contraseñas en la tabla de settings existente.

La salida DIAN, XML firmado, ZIP y respuesta se almacenan como artefactos
inmutables con huella SHA-256. La outbox usa el sobre obligatorio
`{ tenantId, requestId, entityId, schemaVersion, idempotencyKey, payload }`,
reintentos con límite y fallo terminal visible. Cada worker restablece el
contexto de tenant antes de leer o actualizar.

## Flujo

1. El operador configura el certificado y los metadatos DIAN del tenant piloto
   mediante un canal administrativo seguro.
2. El usuario crea factura, nota crédito o nota débito. El dominio calcula y
   deja el documento listo, con secuencia de prueba asignada.
3. El worker genera/valida XML UBL, calcula CUFE/CUDE, firma XAdES y envía el
   documento al endpoint de habilitación con el identificador del set.
4. La respuesta se persiste y el panel muestra aceptado, pendiente o rechazado
   sin exponer secretos. Los pendientes se consultan; los rechazos preservan
   el detalle y exigen un nuevo documento fiscal válido, no mutación.
5. Tras la habilitación, una operación administrativa independiente asocia la
   resolución y prefijo de producción. El selector puede cambiar a producción.

## Validación y evidencia

- Pruebas unitarias de normalización decimal, construcción CUFE/CUDE, ZIP,
  firma y traducción de respuestas SOAP con fixtures sin secretos.
- Pruebas de integración RLS con dos tenants: el segundo no puede seleccionar
  el adaptador directo ni leer credenciales/artefactos del piloto.
- Pruebas de outbox para reintento, duplicado y reinicio de worker.
- Prueba de contrato SOAP contra fixtures oficiales/versionados y ejecución
  manual del set contra DIAN; DIAN determina la aceptación final.
- Antes de producción: certificado vigente, secretos rotados, estado
  `HABILITADO`, RUT/fecha de inicio y prefijo autorizado/asociado verificados
  por el titular.

## Compatibilidad, despliegue y reversión

El cambio es aditivo: mock sigue siendo el predeterminado. Se despliega primero
esquema y secretos, luego worker/adaptador, finalmente se habilita el selector
directo solo para el piloto. Deshabilitar ese selector revierte a mock para
desarrollo, pero nunca revierte ni altera documentos emitidos o artefactos.

## Fuera de alcance y decisión regulatoria

No se activa DIAN real para clientes SaaS. Cada futuro cliente requiere su
propia condición tributaria y una validación legal/DIAN del modelo antes de
usar Empyra para transmitir documentos. Esta implementación no sustituye esa
determinación.
