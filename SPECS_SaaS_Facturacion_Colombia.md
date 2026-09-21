# SPECS.md — SaaS de Facturación Electrónica y Contabilidad Básica (Colombia)

**Estado:** Especificación funcional/técnica inicial  
**País objetivo inicial:** Colombia  
**Fecha de revisión normativa:** 2026-09-21  
**Objetivo:** construir un SaaS multiempresa para crear, validar, emitir, entregar y administrar facturas electrónicas de venta, notas crédito, notas débito y los asientos contables básicos asociados, preparado desde el inicio para integrarse con DIAN y crecer modularmente.

> Esta especificación es de producto y arquitectura. Las reglas tributarias sensibles deben mantenerse configurables y verificarse contra la normativa y el Anexo Técnico vigente de DIAN antes de cada salida a producción.

---

## 1. Visión del producto

Construir una plataforma SaaS de facturación electrónica para Colombia, multiempresa y multiusuario, que permita a cada empresa:

- registrar su perfil fiscal y de facturación;
- registrar clientes;
- registrar productos y servicios;
- crear facturas en tiempo real con previsualización;
- manejar IVA y tratamientos tributarios por línea;
- manejar AIU opcional;
- generar facturas electrónicas de venta;
- integrar el envío y validación con DIAN;
- generar PDF, XML y artefactos de validación;
- descargar documentos;
- enviarlos por correo;
- compartirlos por WhatsApp;
- crear notas crédito;
- crear notas débito cuando corresponda;
- anular correctamente una factura electrónica mediante nota crédito;
- llevar un registro contable básico generado desde los documentos emitidos;
- conservar trazabilidad y auditoría completa;
- crecer posteriormente a cartera, compras, inventario, bancos, conciliaciones, nómina, impuestos, POS y otros módulos.

La plataforma NO debe diseñarse como una pantalla aislada de facturación. Debe diseñarse como el núcleo de un ERP modular.

---

## 2. Principios obligatorios

1. **Multi-tenant real desde el día 1.**
   - Cada empresa es un `tenant`.
   - Ningún registro fiscal o comercial puede existir sin `tenant_id`.
   - Ningún usuario podrá consultar datos de otro tenant.
   - Implementar aislamiento también a nivel PostgreSQL mediante Row Level Security (RLS) o política equivalente robusta.

2. **Documentos fiscales inmutables después de su emisión/validación.**
   - Una factura en borrador puede editarse.
   - Una factura validada/expedida no se edita ni elimina.
   - Las correcciones posteriores se hacen mediante los mecanismos fiscales correspondientes.

3. **Toda operación crítica debe ser auditable.**
   - Quién creó.
   - Quién modificó un borrador.
   - Quién emitió.
   - Qué XML se envió.
   - Qué respondió DIAN.
   - Qué correo fue enviado.
   - Qué nota anuló o ajustó un documento.

4. **No utilizar `float` de JavaScript para cálculos monetarios.**
   - Usar `NUMERIC/DECIMAL` en PostgreSQL.
   - Usar una librería decimal en TypeScript.
   - Definir explícitamente reglas de redondeo.

5. **La integración DIAN debe ser un adaptador desacoplado del dominio.**
   - El sistema debe poder operar inicialmente con un `MockDianProvider`.
   - Luego deberá poder conectar `DirectDianProvider`.
   - Debe quedar abierta la posibilidad de `AuthorizedTechnologyProviderAdapter`.

6. **No acoplar correo, WhatsApp, almacenamiento, PDF ni DIAN al núcleo.**
   - Todos deben exponerse como interfaces/adaptadores reemplazables.

---

## 3. Stack propuesto

### Frontend
- React + TypeScript.
- SPA o framework React con renderizado híbrido si se desea.
- TanStack Query para estado servidor.
- React Hook Form + Zod para formularios.
- Componente de factura reutilizable para preview.
- UI responsive para escritorio/tablet/móvil.

### Backend
- Node.js + TypeScript.
- NestJS o arquitectura equivalente por módulos.
- API REST inicialmente.
- OpenAPI/Swagger.
- Jobs asíncronos con `pg-boss` sobre PostgreSQL para evitar Redis en el MVP.

### Base de datos
- PostgreSQL.
- ORM recomendado: Drizzle ORM o equivalente que permita SQL explícito y migrations versionadas.
- RLS por tenant.
- UUID/UUIDv7 para IDs.
- `NUMERIC(20,6)` o precisión equivalente para cálculos internos.
- Moneda inicial: COP; modelo preparado para ISO-4217.

### Archivos
No guardar los PDFs/XML principales como blobs gigantes dentro de PostgreSQL.

Usar almacenamiento compatible S3:
- MinIO, Cloudflare R2, S3 u otro.
- Buckets privados.
- URLs firmadas de corta duración.
- Hash SHA-256 de cada artefacto persistido en BD.

### Correo
Implementar una interfaz:

```ts
interface EmailProvider {
  sendInvoice(input: SendInvoiceEmailInput): Promise<EmailDeliveryResult>;
}
```

Proveedor inicial:
- Resend.

No acoplar el dominio a Resend. Debe poder cambiarse a SES, Postmark, SendGrid, etc.

### WhatsApp
Fase 1:
- botón "Compartir por WhatsApp";
- abrir conversación con mensaje prellenado y URL firmada del documento.

Fase 2:
- Meta WhatsApp Business Cloud API;
- envío real de PDF/documento según reglas de Meta y plantillas cuando apliquen.

---

## 4. Modelo SaaS

### 4.1 Tenant / Empresa

Cada empresa debe tener:

- razón social;
- nombre comercial;
- NIT;
- dígito de verificación;
- tipo de persona;
- responsabilidades fiscales;
- régimen/responsabilidad IVA según datos requeridos;
- actividad económica;
- dirección;
- municipio/departamento/país;
- teléfono;
- correo;
- correo de facturación;
- logo;
- moneda;
- zona horaria (`America/Bogota` por defecto);
- configuración visual de factura;
- estado de suscripción SaaS;
- plan;
- límites de usuarios/documentos si se implementan.

### 4.2 Usuarios y membresías

Un usuario puede pertenecer a uno o varios tenants.

Roles mínimos:

- `OWNER`
- `ADMIN`
- `ACCOUNTANT`
- `BILLING_AGENT`
- `VIEWER`

Permisos separados:

- customers.read/write
- products.read/write
- invoices.read/create/issue
- credit_notes.create/issue
- debit_notes.create/issue
- dian.configure
- accounting.read/write
- users.manage
- tenant.settings
- audit.read

No basar autorización únicamente en roles; usar permisos explícitos.

---

## 5. Módulos MVP

### 5.1 Autenticación y seguridad
### 5.2 Empresas / tenants
### 5.3 Usuarios y permisos
### 5.4 Clientes
### 5.5 Productos y servicios
### 5.6 Impuestos y tratamientos fiscales
### 5.7 Facturas de venta
### 5.8 AIU
### 5.9 Notas crédito
### 5.10 Notas débito
### 5.11 Configuración de numeración
### 5.12 Integración DIAN (adapter)
### 5.13 PDF / XML / QR / CUFE-CUDE
### 5.14 Email
### 5.15 WhatsApp/share
### 5.16 Contabilidad básica
### 5.17 Auditoría
### 5.18 Dashboard

---

## 6. Clientes

Campos mínimos:

- id;
- tenant_id;
- tipo: persona natural / jurídica;
- tipo de identificación;
- identificación;
- DV cuando aplique;
- razón social o nombre;
- nombres/apellidos cuando aplique;
- responsabilidades fiscales;
- email principal;
- emails adicionales;
- teléfono;
- WhatsApp;
- dirección;
- municipio;
- departamento;
- país;
- contacto;
- notas internas;
- activo/inactivo.

Debe existir búsqueda por:
- nombre;
- identificación;
- email;
- teléfono.

Debe prevenir duplicados de identificación dentro del mismo tenant, salvo regla explícita.

---

## 7. Productos y servicios

Campos:

- código interno;
- código estándar si aplica;
- nombre;
- descripción;
- tipo: producto/servicio;
- unidad de medida;
- precio base;
- impuesto por defecto;
- tratamiento tributario;
- cuenta contable de ingreso;
- cuenta de inventario futura;
- activo/inactivo.

El usuario debe poder crear una línea manual sin necesidad de registrar previamente un producto.

---

## 8. Impuestos

### 8.1 No modelar IVA únicamente como porcentaje

Crear:

```ts
TaxTreatment =
  | "TAXED"
  | "EXEMPT"
  | "EXCLUDED"
  | "NON_TAXED";
```

Y además:

```ts
tax_type = "IVA"
rate = Decimal
```

Porque:
- `IVA 0% EXENTO` no es lo mismo que `EXCLUIDO`;
- `EXCLUIDO` no es simplemente "IVA 0";
- `NO GRAVADO` tampoco debe confundirse con exento.

### 8.2 Catálogo colombiano por defecto

Para Colombia, cargar inicialmente:

- IVA 19% — gravado;
- IVA 5% — gravado;
- IVA 0% — exento, cuando legalmente corresponda;
- excluido;
- no gravado/no sujeto, cuando corresponda.

**No cargar 21% como tarifa estándar colombiana.**

Debe existir capacidad técnica para crear una tarifa personalizada (por ejemplo 21%) para otros mercados/casos futuros, pero la emisión DIAN debe pasar por reglas de validación y no debe permitir marcarla como IVA colombiano sin configuración y soporte normativo válido.

### 8.3 Impuesto por línea

Cada línea puede tener tratamiento distinto.

La factura puede mezclar:
- líneas al 19%;
- líneas al 5%;
- líneas exentas;
- líneas excluidas;
- líneas no gravadas.

El resumen debe agrupar bases e impuestos por tarifa/tratamiento.

---

## 9. Editor de factura

Diseño recomendado: pantalla dividida.

### Izquierda
Formulario de creación.

### Derecha
Preview A4 en tiempo real.

El preview debe recalcularse en cada cambio sin esperar a "Guardar".

### Encabezado

- cliente;
- fecha de generación;
- vencimiento;
- forma de pago: contado/crédito;
- plazo;
- medio de pago cuando aplique;
- moneda;
- vendedor/comercial opcional;
- orden de compra/referencia;
- observaciones.

### Líneas

Columnas:
- ítem;
- descripción;
- cantidad;
- unidad;
- valor unitario;
- descuento;
- base;
- IVA/tratamiento;
- total.

Acciones:
- agregar;
- duplicar;
- eliminar;
- reordenar.

### Resumen

- subtotal bruto;
- descuentos;
- subtotal neto;
- AIU (cuando esté activo);
- bases de impuestos;
- IVA por tarifa;
- retenciones futuras;
- total a pagar.

---

## 10. AIU

### 10.1 UX

En la creación de factura debe existir:

```text
[ ] Incluir AIU
```

Al activarlo, abrir un drawer/panel lateral:

```text
Administración (%)  [ 4.00 ]
Imprevistos (%)     [ 3.00 ]
Utilidad (%)        [10.00 ]

Tratamiento fiscal AIU:
( ) Construcción de bien inmueble — IVA sobre honorarios/utilidad
( ) Servicios con base especial AIU — IVA sobre AIU
( ) AIU contractual/informativo — sin cambiar la base fiscal estándar
```

Opciones:
- guardar porcentajes como plantilla;
- definir valores por defecto por tenant;
- seleccionar qué líneas hacen parte de la base AIU.

### 10.2 Cálculo base

```text
AIU_BASE = suma de líneas elegibles después de descuentos y antes de IVA

ADMINISTRACION = AIU_BASE × pct_administracion
IMPREVISTOS    = AIU_BASE × pct_imprevistos
UTILIDAD        = AIU_BASE × pct_utilidad
AIU_TOTAL       = ADMINISTRACION + IMPREVISTOS + UTILIDAD
```

### 10.3 Modo: construcción de bien inmueble

Para el tratamiento aplicable a contratos de construcción de bien inmueble, el motor debe soportar que la base gravable del IVA sea el honorario o la utilidad según la configuración contractual.

Ejemplo:

```text
IVA_BASE = UTILIDAD
IVA = IVA_BASE × tarifa_IVA
TOTAL = AIU_BASE + ADMINISTRACION + IMPREVISTOS + UTILIDAD + IVA
```

No asumir que todo uso comercial de la sigla AIU corresponde automáticamente a esta regla.

### 10.4 Modo: servicios con base especial AIU

Para los servicios a los que legalmente les aplique la base gravable especial del artículo 462-1 E.T.:

```text
IVA_BASE = AIU_TOTAL
```

El sistema debe validar el mínimo legal de AIU cuando corresponda.

Si el AIU pactado está por debajo del mínimo normativo:
- mostrar error/bloqueo;
- no emitir hasta corregir o seleccionar tratamiento correcto.

### 10.5 Modo: AIU contractual/informativo

Permite mostrar A/I/U como desglose contractual sin asumir una base tributaria especial.

El IVA se calcula según las líneas/reglas fiscales ordinarias.

### 10.6 Caso de prueba obligatorio basado en la factura de referencia

```text
Total bruto:       38,888,155.32
Administración 4%:  1,555,526.21
Imprevistos 3%:     1,166,644.66
Utilidad 10%:       3,888,815.53

Base IVA:            3,888,815.53
IVA 19%:               738,874.95

Total:              46,238,016.67
```

Este test debe pasar exactamente con la política de redondeo definida.

---

## 11. Preview y representación gráfica

Mientras el documento sea borrador:

```text
BORRADOR — NO VÁLIDO COMO FACTURA
```

Debe aparecer como marca de agua.

Cuando DIAN acepte el documento:
- remover la marca BORRADOR;
- incluir consecutivo oficial;
- fecha/hora de generación;
- fecha/hora de validación/expedición;
- resolución/autorización de numeración;
- CUFE;
- QR;
- identificación del fabricante/software cuando corresponda;
- información fiscal requerida;
- totales;
- forma/medio de pago;
- textos legales configurables permitidos.

El diseño inicial tomará como inspiración la factura de referencia:
- datos del emisor arriba;
- QR visible;
- bloque con tipo/número;
- bloque de cliente;
- tabla de ítems;
- bloque inferior de totales;
- observaciones;
- CUFE/leyendas al pie.

Debe modernizarse visualmente y permitir branding por tenant.

---

## 12. Estados de factura

```ts
InvoiceStatus =
  | "DRAFT"
  | "READY_TO_ISSUE"
  | "PROCESSING"
  | "DIAN_PENDING"
  | "DIAN_ACCEPTED"
  | "DIAN_REJECTED"
  | "ISSUED"
  | "CANCELLED_BY_CREDIT_NOTE";
```

Estados de entrega separados:

```ts
DeliveryStatus =
  | "NOT_SENT"
  | "EMAIL_QUEUED"
  | "EMAIL_SENT"
  | "EMAIL_FAILED"
  | "SHARED_WHATSAPP";
```

No mezclar estado fiscal con estado de email.

---

## 13. Emisión de factura

Flujo:

```text
DRAFT
  ↓
Validación interna
  ↓
READY_TO_ISSUE
  ↓
Bloqueo lógico de edición
  ↓
Asignación segura de consecutivo
  ↓
Generar XML DIAN
  ↓
Calcular CUFE
  ↓
Firma digital
  ↓
Enviar a DIAN
  ↓
Respuesta
 ┌─────────────┴──────────────┐
DIAN_ACCEPTED             DIAN_REJECTED
  ↓                           ↓
Guardar respuesta          Mostrar errores
Guardar XML firmado        Permitir corregir flujo
Guardar contenedor
Generar PDF final
  ↓
ISSUED
  ↓
Enviar al adquirente
```

La emisión debe ser idempotente.

No debe ser posible que un doble clic produzca dos facturas.

Usar:
- `idempotency_key`;
- locks/transacciones;
- constraint única por `(tenant_id, prefix, number)`.

---

## 14. DIAN — arquitectura

### 14.1 Contrato del adaptador

```ts
interface FiscalAuthorityProvider {
  validateConfiguration(tenantId: string): Promise<ValidationResult>;

  issueInvoice(documentId: string): Promise<FiscalSubmissionResult>;

  issueCreditNote(documentId: string): Promise<FiscalSubmissionResult>;

  issueDebitNote(documentId: string): Promise<FiscalSubmissionResult>;

  queryStatus(documentId: string): Promise<FiscalSubmissionStatus>;

  getValidationArtifacts(documentId: string): Promise<FiscalArtifacts>;
}
```

### 14.2 Implementaciones

```text
MockDianProvider
DirectDianProvider
TechnologyProviderAdapter
```

### 14.3 Datos DIAN por tenant

Cada tenant tendrá su propia configuración:

- ambiente: habilitación/producción;
- software ID/código;
- PIN si aplica;
- identificación del fabricante;
- modo de operación;
- resolución/autorización de numeración;
- prefijo;
- rango desde/hasta;
- vigencia;
- clave técnica;
- certificado digital;
- contraseña del certificado;
- parámetros de test/habilitación;
- fecha inicio;
- estado de habilitación.

Los secretos deben estar cifrados en aplicación/KMS y jamás mostrarse nuevamente en texto plano.

### 14.4 Artefactos que deben conservarse

Por documento:
- XML de generación;
- XML firmado;
- respuesta DIAN;
- ApplicationResponse;
- contenedor/AttachedDocument cuando corresponda;
- CUFE/CUDE;
- QR/URL DIAN;
- PDF de representación gráfica;
- hashes;
- timestamps;
- intentos.

Nunca reemplazar un artefacto histórico. Versionar intentos.

---

## 15. Consideración crítica del modelo SaaS frente a DIAN

No asumir que "registramos una sola cuenta DIAN y con eso facturamos por todos".

Cada empresa cliente del SaaS será el facturador electrónico de sus propias operaciones y tendrá:
- NIT propio;
- numeración propia;
- configuración propia;
- firma/certificado o esquema jurídico/técnico válido;
- habilitación propia.

Antes de comercializar la transmisión DIAN a terceros, definir jurídicamente uno de estos modelos:

### Modelo A — software propio/adquirido por el cliente
Cada tenant registra/habilita el software correspondiente y opera con sus credenciales/certificado/configuración.

### Modelo B — proveedor tecnológico autorizado
La compañía operadora del SaaS obtiene la calidad que corresponda ante DIAN y cumple todos los requisitos aplicables.

### Modelo C — integración con un proveedor tecnológico ya autorizado
El SaaS conserva toda la UX y dominio, pero delega transmisión/firma/validación a un tercero mediante API.

La arquitectura debe permitir los tres sin reescribir facturación.

Antes de producción multiempresa debe confirmarse con DIAN/asesoría especializada si el modelo SaaS concreto se considera "desarrollo informático adquirido" o prestación de servicios como proveedor tecnológico.

---

## 16. Habilitación DIAN por tenant

Crear wizard:

```text
1. Perfil fiscal
2. Seleccionar modo de operación
3. Registrar datos software
4. Cargar certificado
5. Configurar ambiente habilitación
6. Ejecutar set de pruebas vigente
7. Confirmar estado habilitado
8. Registrar/autorización de numeración
9. Asociar prefijo/rango
10. Activar producción
```

No hardcodear para siempre la cantidad de documentos del set de pruebas. Hacerlo configurable porque DIAN puede modificarlo.

---

## 17. Factura validada: reglas de inmutabilidad

Una factura `DIAN_ACCEPTED/ISSUED`:
- NO se edita;
- NO se elimina;
- NO cambia cliente;
- NO cambia NIT;
- NO cambia fecha;
- NO cambia líneas;
- NO cambia IVA;
- NO cambia AIU;
- NO cambia total.

Si hay error posterior:
- usar nota crédito/anulación cuando corresponda;
- generar una nueva factura cuando corresponda.

---

## 18. Anulación de factura electrónica

### Regla de producto

El botón de UI puede llamarse:

```text
Anular factura
```

Pero internamente NO debe borrar ni "anular" físicamente el registro.

Al hacer clic:

1. mostrar explicación:
   - "La factura ya fue expedida. La anulación se realizará mediante una nota crédito electrónica."

2. pedir:
   - motivo;
   - confirmación;
   - fecha;
   - observación opcional.

3. crear nota crédito por el 100%:
   - referenciar factura original;
   - prefijo/número;
   - CUFE;
   - fecha relacionada;
   - motivo/código DIAN vigente;
   - líneas e impuestos necesarios;
   - CUDE propio.

4. enviar nota crédito a DIAN.

5. cuando sea aceptada:
   - factura original = `CANCELLED_BY_CREDIT_NOTE`;
   - enlazar `cancelled_by_document_id`;
   - conservar número original para siempre;
   - actualizar contabilidad mediante reverso/ajuste correspondiente.

Jamás reutilizar el número de la factura anulada.

---

## 19. Nota crédito

Casos funcionales:
- anulación total;
- devolución parcial;
- rebaja/descuento procedente;
- corrección que reduzca el valor;
- otros motivos admitidos por el catálogo/anexo vigente.

Debe poder originarse desde una factura.

UX:

```text
Factura FV-123
[Crear nota crédito]

Tipo:
( ) Anulación total
( ) Ajuste parcial
```

Para ajuste parcial:
- seleccionar líneas;
- cantidades;
- valores;
- impuestos;
- motivo.

La nota:
- tiene numeración consecutiva interna;
- referencia factura cuando corresponda;
- tiene CUDE;
- se firma;
- se transmite;
- se valida;
- se entrega al adquirente.

---

## 20. Nota débito

Mantener módulo de nota débito porque forma parte del sistema de facturación electrónica.

Sin embargo, cuando el objetivo sea **aumentar el valor de la operación**, el sistema debe presentar una advertencia de cumplimiento y ofrecer como flujo preferente:

```text
Crear factura adicional por el mayor valor
```

Esto permite soportar adecuadamente el mayor valor para efectos tributarios del adquirente según doctrina DIAN.

La nota débito seguirá disponible para los eventos permitidos y deberá:
- usar catálogo de tipos/motivos del Anexo Técnico vigente;
- tener consecutivo interno;
- CUDE;
- referencia a factura cuando corresponda;
- transmisión/validación DIAN.

### Regla importante

No permitir usar una nota débito o nota crédito para ajustar otra nota débito/nota crédito.

---

## 21. Contabilidad básica

Objetivo: registrar automáticamente el efecto contable de los documentos fiscales.

### 21.1 Tablas

- `chart_of_accounts`
- `accounting_periods`
- `journal_entries`
- `journal_lines`
- `posting_rules`

### 21.2 Principio

No hardcodear códigos PUC para todas las empresas.

Cada tenant podrá mapear:
- cuenta clientes/cartera;
- ingresos;
- IVA generado;
- descuentos;
- Administración AIU;
- Imprevistos AIU;
- Utilidad AIU;
- caja/bancos;
- otras cuentas.

### 21.3 Asiento base de factura

Ejemplo conceptual:

```text
Débito   Cliente / CxC                         TOTAL
Crédito  Ingresos                              BASE/INGRESOS
Crédito  IVA generado                          IVA
```

La distribución exacta de AIU debe depender de las políticas y cuentas configuradas del tenant.

### 21.4 Nota crédito

Genera asiento reverso/ajuste trazable contra la factura.

### 21.5 Reglas

- Todo asiento automático referencia `document_id`.
- Los asientos generados por documentos fiscales no se borran.
- Correcciones contables posteriores se hacen con nuevo asiento.
- Debe = Haber.
- Cerrar periodos y bloquear edición futura.

---

## 22. Numeración

Tabla `document_sequences`.

Campos:
- tenant_id;
- document_type;
- prefix;
- range_from;
- range_to;
- current_number;
- authorization_number;
- authorization_date;
- valid_from;
- valid_to;
- technical_key_encrypted;
- active;
- environment.

Asignación de número:
- transacción SQL;
- lock de fila;
- unique constraint;
- idempotency;
- nunca duplicar.

Separar:
- número fiscal de factura;
- consecutivos internos de notas/documentos cuando corresponda.

---

## 23. Email con Resend

### 23.1 Flujo

Solo enviar automáticamente después de tener documento válido/final, salvo botón explícito de borrador.

Email final:
- asunto: `Factura electrónica {prefijo}{numero} — {empresa}`;
- cuerpo con branding del tenant;
- PDF adjunto;
- XML/contenedor electrónico cuando corresponda;
- botón "Ver factura";
- datos de contacto;
- aviso de no responder o `reply-to` del tenant.

### 23.2 Multi-tenant

Para MVP:
- enviar desde dominio de plataforma;
- ejemplo: `facturas@dominio-plataforma.com`;
- usar `reply-to` = email del tenant.

Futuro:
- dominios personalizados por tenant.

### 23.3 Logs

Guardar:
- provider;
- message_id;
- to;
- cc;
- subject;
- fecha;
- status;
- error;
- retries.

Webhooks:
- delivered;
- bounced;
- complained;
- failed.

No exponer API keys de Resend al frontend.

---

## 24. WhatsApp

### V1

Botón:

```text
Enviar por WhatsApp
```

Acción:
- seleccionar número;
- generar URL de documento de corta duración;
- texto:

"Hola {cliente}, te compartimos la factura {numero} emitida por {empresa}: {url}"

La URL debe:
- ser firmada;
- expirar;
- no exponer rutas internas ni IDs predecibles.

### V2

Integración real con WhatsApp Business Cloud API.

---

## 25. PDF

Generarlo en backend.

Recomendación:
- plantilla HTML/CSS;
- motor Chromium headless/Playwright para PDF;
- ruta interna protegida de render;
- el PDF final se genera desde datos persistidos, nunca desde datos del navegador.

El preview React y el PDF deben compartir tokens visuales y lógica de cálculo, pero el PDF final siempre se genera en servidor.

PDF final:
- tamaño A4;
- 1 o múltiples páginas;
- encabezado repetible;
- pie;
- QR;
- CUFE/CUDE;
- total en letras;
- campos fiscales;
- branding.

---

## 26. Motor de cálculo

Crear paquete de dominio puro:

```text
packages/calculation-engine
```

Sin React, sin ORM, sin DIAN.

Funciones:

```ts
calculateLine()
calculateInvoice()
calculateTaxes()
calculateAIU()
calculateCreditNote()
calculateDebitNote()
roundMoney()
```

Input inmutable → output determinista.

Tests unitarios exhaustivos.

### Orden conceptual

```text
1. cantidad × valor unitario
2. descuento de línea
3. base neta de línea
4. clasificación fiscal
5. AIU elegible
6. base gravable según regla
7. impuestos
8. descuentos/cargos globales permitidos
9. total
```

Las reglas exactas de redondeo deben alinearse con el Anexo Técnico DIAN vigente antes de producción.

---

## 27. Base de datos — entidades principales

### SaaS
- users
- tenants
- memberships
- roles
- permissions
- subscriptions

### Maestros
- customers
- customer_contacts
- products
- tax_definitions
- tax_rates
- payment_methods
- payment_terms

### Fiscal
- fiscal_documents
- fiscal_document_lines
- fiscal_document_taxes
- fiscal_document_aiu
- document_sequences
- dian_configurations
- dian_submissions
- fiscal_artifacts

### Entrega
- email_deliveries
- whatsapp_shares

### Contabilidad
- chart_of_accounts
- posting_rules
- journal_entries
- journal_lines
- accounting_periods

### Sistema
- audit_logs
- idempotency_keys
- background_jobs
- webhook_events

---

## 28. Esquema conceptual `fiscal_documents`

```text
id
tenant_id
type                      INVOICE | CREDIT_NOTE | DEBIT_NOTE
status
delivery_status

customer_id
parent_document_id

prefix
number
internal_sequence

issue_date
generation_at
validation_at
due_date

currency
exchange_rate

payment_form
payment_method
payment_term_days

subtotal
discount_total
aiu_total
taxable_total
tax_total
grand_total

cufe
cude
qr_url

dian_environment
dian_status

notes
created_by
created_at
updated_at
issued_at
```

---

## 29. AIU — esquema conceptual

```text
fiscal_document_aiu

id
document_id
enabled

base_amount

administration_rate
administration_amount

contingencies_rate
contingencies_amount

utility_rate
utility_amount

tax_mode
  CONSTRUCTION_PROFIT_ONLY
  SPECIAL_SERVICES_AIU
  CONTRACTUAL_DISPLAY_ONLY

vat_rate
vat_base
vat_amount
```

Guardar tasas Y resultados calculados para preservar el documento histórico aunque cambien configuraciones futuras.

---

## 30. Auditoría

Cada evento:

```text
id
tenant_id
actor_user_id
action
entity_type
entity_id
before_json
after_json
ip
user_agent
request_id
created_at
```

Eventos críticos:
- LOGIN;
- CUSTOMER_CREATED;
- INVOICE_CREATED;
- INVOICE_UPDATED;
- INVOICE_ISSUE_REQUESTED;
- DIAN_SUBMITTED;
- DIAN_ACCEPTED;
- DIAN_REJECTED;
- PDF_GENERATED;
- EMAIL_SENT;
- CREDIT_NOTE_CREATED;
- INVOICE_CANCELLED;
- DIAN_SETTINGS_CHANGED;
- CERTIFICATE_CHANGED;
- USER_PERMISSION_CHANGED.

Audit log append-only.

---

## 31. Seguridad

### Autenticación
- contraseña con Argon2id;
- MFA opcional inicialmente, obligatorio para administradores en fase posterior;
- sesiones en cookies HttpOnly/Secure/SameSite;
- no guardar tokens de sesión en LocalStorage;
- recuperación de contraseña con tokens de un solo uso;
- rotación de sesiones;
- rate limiting.

### Autorización
- RBAC + permisos;
- validación en backend;
- RLS en PostgreSQL;
- no confiar en `tenant_id` enviado por frontend.

### Secretos
- variables secretas en plataforma;
- API keys nunca en cliente;
- certificados y claves DIAN cifrados;
- contraseñas de P12/PFX cifradas;
- logs sin secretos.

### Aplicación
- CSRF cuando corresponda;
- CSP;
- XSS protection;
- validación Zod/DTO en frontera;
- SQL parametrizado;
- protección brute force;
- dependency scanning;
- backups;
- restauración probada.

### Archivos
- bucket privado;
- signed URLs;
- validación MIME;
- antivirus/escaneo si se aceptan archivos de clientes;
- hash de integridad.

---

## 32. Privacidad

Como SaaS que almacena datos de personas/clientes:
- política de tratamiento de datos;
- consentimiento/canales cuando corresponda;
- roles de responsable/encargado;
- términos y condiciones;
- mecanismos para consultas/supresión cuando legalmente procedan;
- retención de documentos acorde con obligaciones legales;
- logs de acceso.

El diseño debe contemplar la Ley 1581 de 2012 y normativa colombiana aplicable de protección de datos, además de las obligaciones fiscales/documentales.

---

## 33. Dashboard inicial

Cards:
- ventas del mes;
- IVA generado;
- facturas emitidas;
- facturas pendientes/rechazadas DIAN;
- notas crédito;
- cartera pendiente futura;
- emails fallidos;
- numeración disponible.

Gráficas futuras:
- facturación mensual;
- clientes principales;
- impuestos;
- cartera.

---

## 34. Pantallas

```text
/login
/onboarding

/app/dashboard

/app/customers
/app/customers/new
/app/customers/:id

/app/products
/app/products/new

/app/invoices
/app/invoices/new
/app/invoices/:id

/app/credit-notes
/app/credit-notes/:id

/app/debit-notes
/app/debit-notes/:id

/app/accounting/journals
/app/accounting/chart-of-accounts

/app/settings/company
/app/settings/taxes
/app/settings/aiu
/app/settings/dian
/app/settings/numbering
/app/settings/email
/app/settings/users
/app/settings/audit
```

---

## 35. Pantalla detalle de factura emitida

Header:

```text
FV-1023
VALIDADA DIAN
```

Acciones:
- Descargar PDF
- Descargar XML
- Ver validación DIAN
- Enviar por correo
- Enviar por WhatsApp
- Crear nota crédito
- Crear ajuste permitido
- Ver asiento contable
- Ver auditoría

Si se pulsa `Anular`:
- iniciar flujo de nota crédito total;
- nunca DELETE.

---

## 36. Dashboard de errores DIAN

Mostrar:
- documento;
- fecha;
- cliente;
- código error;
- mensaje DIAN;
- campo relacionado;
- XML intento;
- acción sugerida;
- botón "Corregir y reintentar" cuando legal/técnicamente proceda.

Nunca ocultar el mensaje original.

---

## 37. Jobs asíncronos

Colas:

```text
dian.submit
dian.poll
pdf.generate
email.send
email.retry
webhook.process
artifact.cleanup
```

Cada job:
- idempotente;
- retry con backoff;
- dead-letter state;
- request_id;
- tenant_id;
- observabilidad.

---

## 38. Observabilidad

- logs JSON estructurados;
- `request_id`;
- `tenant_id` no sensible;
- `document_id`;
- métricas;
- healthcheck;
- alertas;
- Sentry/OpenTelemetry opcional.

No registrar:
- password;
- API keys;
- certificado;
- clave privada;
- PFX password;
- tokens completos.

---

## 39. API mínima

```text
POST   /auth/login

GET    /customers
POST   /customers
GET    /customers/:id
PATCH  /customers/:id

GET    /products
POST   /products

GET    /invoices
POST   /invoices
GET    /invoices/:id
PATCH  /invoices/:id           solo DRAFT
POST   /invoices/:id/issue
POST   /invoices/:id/send-email
POST   /invoices/:id/share-whatsapp
GET    /invoices/:id/pdf
GET    /invoices/:id/xml

POST   /invoices/:id/credit-notes
POST   /credit-notes/:id/issue

POST   /invoices/:id/debit-notes
POST   /debit-notes/:id/issue

GET    /documents/:id/dian-status
GET    /documents/:id/audit

GET    /settings/dian
PUT    /settings/dian
GET    /settings/numbering
PUT    /settings/numbering
```

---

## 40. Idempotencia y concurrencia

Obligatorio para:
- emitir factura;
- emitir nota;
- enviar DIAN;
- enviar correo;
- recibir webhook.

Header/API:

```text
Idempotency-Key
```

Tabla:

```text
idempotency_keys
tenant_id
key
operation
request_hash
response_json
status
expires_at
```

Dos usuarios no pueden consumir el mismo número fiscal.

---

## 41. Retenciones — diseño futuro

Aunque no entren completas al primer sprint, el modelo debe permitir:
- retefuente;
- reteIVA;
- reteICA;
- otras retenciones.

No incorporarlas como simples números sueltos en invoice.

Crear arquitectura genérica de `withholdings`.

---

## 42. Facturas a crédito y eventos futuros

Preparar el modelo para:
- acuse de recibo;
- recibo del bien/servicio;
- aceptación expresa/tácita;
- RADIAN;
- título valor;
- factoring.

No implementar todo en MVP, pero no bloquearlo arquitectónicamente.

---

## 43. Pruebas

### Unitarias
- cálculo de líneas;
- IVA 19;
- IVA 5;
- exento;
- excluido;
- AIU construcción;
- AIU especial;
- descuentos;
- redondeo;
- nota crédito total;
- nota crédito parcial.

### Integración
- tenant isolation;
- RLS;
- consecutivos concurrentes;
- idempotencia;
- jobs;
- almacenamiento;
- email provider mock;
- DIAN mock.

### E2E
- crear cliente;
- crear factura;
- activar AIU;
- preview;
- guardar borrador;
- emitir;
- simular DIAN aceptada;
- descargar PDF;
- descargar XML;
- enviar email;
- crear nota crédito de anulación;
- verificar estado cancelado;
- verificar asiento.

---

## 44. Test de aislamiento SaaS obligatorio

Crear:
- Tenant A;
- Tenant B;
- Usuario A;
- Usuario B.

Intentar:
- Usuario A consulta ID de factura B;
- Usuario A consulta cliente B;
- Usuario A descarga URL de XML B;
- Usuario A usa endpoint directo B.

Resultado esperado:

```text
404/403
cero fuga de datos
```

Repetir automáticamente en CI.

---

## 45. Fases de construcción

### Fase 0 — Foundation
- monorepo;
- React;
- backend;
- PostgreSQL;
- migrations;
- auth;
- tenant;
- RLS;
- auditoría;
- CI.

### Fase 1 — Facturación local
- clientes;
- productos;
- impuestos;
- editor;
- preview;
- AIU;
- borradores;
- PDF borrador;
- motor de cálculo;
- contabilidad base.

### Fase 2 — Documentos fiscales
- secuencias;
- nota crédito;
- nota débito;
- anulación mediante NC;
- artefactos;
- PDF final.

### Fase 3 — Integración DIAN habilitación
- XML UBL requerido;
- firma;
- CUFE/CUDE;
- QR;
- envío;
- respuestas;
- errores;
- habilitación;
- producción;
- contingencia.

### Fase 4 — Entrega
- Resend;
- email templates;
- webhook;
- WhatsApp share.

### Fase 5 — SaaS comercial
- planes;
- límites;
- billing;
- onboarding guiado;
- dominio;
- soporte;
- métricas.

### Fase 6 — ERP
- cartera;
- recaudos;
- recibos;
- compras;
- cuentas por pagar;
- inventario;
- bancos;
- conciliación;
- impuestos;
- reportes;
- estados financieros.

---

## 46. Criterios de aceptación del MVP

El MVP se considera listo cuando:

1. dos empresas pueden existir sin cruzar datos;
2. cada una puede crear clientes;
3. puede crear productos/servicios;
4. puede crear factura con preview en vivo;
5. calcula 19%, 5%, exento/excluido correctamente;
6. AIU puede activarse/desactivarse;
7. soporta AIU de construcción con IVA sobre utilidad;
8. soporta base especial AIU donde legalmente aplique;
9. el caso de prueba de la factura de referencia da `46,238,016.67`;
10. el borrador tiene watermark;
11. factura emitida queda bloqueada;
12. se genera PDF;
13. se genera artefacto XML mock;
14. se puede descargar PDF/XML;
15. se puede enviar por Resend;
16. se puede compartir por WhatsApp;
17. una factura emitida se anula mediante nota crédito total;
18. se puede crear nota crédito parcial;
19. existe flujo de nota débito con validaciones;
20. se genera asiento contable básico;
21. existe audit log;
22. emisión es idempotente;
23. ningún secreto llega al frontend;
24. la capa DIAN puede cambiar de mock a real sin reescribir el dominio.

---

## 47. Decisiones que NO deben tomarse como atajos

No:
- borrar facturas emitidas;
- editar facturas emitidas;
- usar 0% para representar todos los tratamientos no gravados;
- aplicar AIU automáticamente a cualquier servicio;
- aplicar IVA siempre sobre AIU total;
- aplicar IVA siempre sobre utilidad;
- usar una sola numeración para todos los tenants;
- usar una sola configuración DIAN para todos los tenants;
- guardar certificados sin cifrar;
- exponer XML/PDF con URLs públicas permanentes;
- usar floats JS;
- enviar correo desde el frontend;
- considerar un PDF como el documento electrónico legal;
- asumir que una sola habilitación DIAN permite facturar por todos los clientes SaaS.

---

## 48. Prompt maestro para un agente de desarrollo

```text
Actúa como arquitecto senior de software, ingeniero backend, frontend y especialista en SaaS financiero.

Debes construir el proyecto descrito en este SPECS.md.

Reglas:

1. No improvises reglas tributarias. Si una regla fiscal no está definida en SPECS.md, crea una interfaz/configuración y marca un TODO normativo.
2. Mantén arquitectura multi-tenant en todos los módulos.
3. Todas las consultas deben aplicar tenant isolation.
4. Usa PostgreSQL con migraciones.
5. Usa decimal exacto para dinero; nunca floats JS.
6. Separa dominio, infraestructura y UI.
7. El motor de cálculo debe ser una librería pura y completamente testeada.
8. La integración DIAN debe implementar un adapter; empieza con MockDianProvider.
9. Una factura emitida es inmutable.
10. "Anular factura" crea una nota crédito total; no borra.
11. Mantén audit log append-only.
12. Implementa idempotencia para operaciones fiscales.
13. Nunca expongas secretos al navegador.
14. Genera PDF final en backend.
15. Implementa EmailProvider y usa Resend como primer adapter.
16. Implementa StorageProvider compatible con S3.
17. Implementa suites de unit, integration y E2E tests.
18. Cada entrega debe incluir:
    - migración,
    - dominio,
    - API,
    - UI,
    - tests,
    - documentación.

Antes de escribir código:
A. inspecciona el repositorio;
B. crea un plan por fases;
C. identifica decisiones pendientes;
D. implementa primero Foundation;
E. no avances a integración DIAN real hasta que la capa de facturación local y tests de cálculo estén estables.
```

---

## 49. Fuentes normativas/técnicas a verificar antes de producción

- Estatuto Tributario colombiano, especialmente arts. 616-1, 617, 468, 468-1, 462-1, 477 y concordantes.
- Decreto 1625 de 2016.
- Decreto 1372 de 1992, art. 3, contratos de construcción de bien inmueble.
- Resolución DIAN 000227 de 2025 (resolución única y compilación vigente aplicable).
- Anexo Técnico de Factura Electrónica de Venta vigente (versión 1.9 al momento de esta especificación).
- Micrositio DIAN de registro/habilitación.
- Doctrina DIAN vigente sobre notas crédito/débito y anulación.
- Política de firma digital vigente de DIAN.
- Catálogos técnicos DIAN vigentes.

Fuentes web revisadas:
- https://normograma.dian.gov.co/
- https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/
- https://www.dian.gov.co/impuestos/factura-electronica/
- https://www.funcionpublica.gov.co/eva/gestornormativo/
- https://resend.com/pricing

---

## 50. Próximo entregable recomendado

Después de aprobar este SPECS.md:

1. crear repositorio y monorepo;
2. definir ERD real;
3. escribir migrations;
4. implementar auth + tenant + RLS;
5. implementar motor de cálculo;
6. crear editor/preview de factura;
7. cargar el caso AIU de referencia como test automático;
8. implementar documentos en modo mock DIAN;
9. registrar/habilitar el software ante DIAN;
10. conectar el adaptador DIAN real.
