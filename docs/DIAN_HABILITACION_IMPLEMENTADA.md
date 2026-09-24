# Integración DIAN — habilitación de software propio

## Trabajo realizado

- Cargue de PFX, contraseña, CA intermedia y CA raíz desde un diálogo autenticado.
- Validación de la cadena completa y vigencia del certificado antes de guardarla.
- Cifrado AES-256-GCM de todas las credenciales en un único sobre autenticado, aislado por tenant mediante RLS.
- Generación UBL 2.1 para factura, nota crédito y nota débito.
- Firma XMLDSig RSA-SHA256 con propiedades XAdES, política DIAN y cadena de tres certificados.
- Empaquetado ZIP de un único XML firmado.
- Cliente SOAP de habilitación con WS-Security, certificado binario, timestamp y firma del cuerpo.
- Operación `SendTestSetAsync` y clasificación de respuestas en aceptada, rechazada, pendiente o error.
- Outbox con exclusión de trabajos activos duplicados, intentos acotados y aislamiento por tenant.
- Panel de configuración DIAN con estado, huella, vencimiento y TestSetId; secretos nunca se devuelven a la interfaz.
- Pruebas automatizadas de cifrado, cadena PFX, UBL, XAdES verificable, ZIP, SOAP y respuestas DIAN.

## Configuración necesaria

1. Aplicar la migración `0014_dian_credentials.sql`.
2. Definir `DIAN_SECRETS_KEY` con 32 bytes hexadecimales y `DIAN_PILOT_TENANT_ID` con el tenant de David.
3. En **Configuración → DIAN**, cargar el PFX, su contraseña, un PEM con CA intermedia y raíz, Software ID, PIN, clave técnica y TestSetId.
4. Ejecutar primero en **Habilitación**. Producción queda separada del piloto.

## Verificación local

La suite cubre criptografía y transporte sin exponer credenciales ni contactar accidentalmente a DIAN. El envío real solo puede validarse con los certificados y el TestSetId del titular cargados localmente.
