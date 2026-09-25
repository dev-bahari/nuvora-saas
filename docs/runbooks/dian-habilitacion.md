# Habilitación DIAN — tenant piloto

## Alcance

Este procedimiento habilita únicamente el tenant configurado en `DIAN_PILOT_TENANT_ID`. No activa emisión DIAN directa para otros clientes del SaaS.

## Antes de cargar credenciales

1. Actualiza el RUT y verifica acceso al correo registrado ante DIAN.
2. En el portal de Habilitación DIAN registra el modo **Software propio** y conserva el software ID, PIN, URL y `TestSetId` asignados.
3. Adquiere un certificado de firma digital de una entidad acreditada por ONAC. Solicita el PFX/P12, su contraseña y la cadena PEM intermedia/raíz.
4. Configura `DIAN_PILOT_TENANT_ID` con el UUID exacto del tenant y `DIAN_SECRETS_KEY` con 32 bytes hexadecimales. Nunca guardes estos valores, el PFX ni las contraseñas en Git, logs o tickets.

## Carga segura

1. Entra como OWNER/ADMIN del tenant piloto a **Configuración → DIAN**.
2. Carga el PFX y la cadena CA mediante el formulario `multipart/form-data`; el navegador no debe convertirlos a JSON/base64.
3. Ingresa una sola vez la contraseña, PIN, clave técnica, software ID, `TestSetId` y datos de resolución.
4. Comprueba que la pantalla devuelve únicamente huella, vencimiento y estado; jamás secreto alguno.

## Pruebas y recuperación

1. Emite los documentos que el portal DIAN marque para el set vigente.
2. Ante `PENDING` o timeout, espera la conciliación de estado; no reenvíes el mismo documento manualmente.
3. Conserva XML firmado, ZIP, hash y respuesta DIAN como artefactos inmutables.
4. Antes de producción, verifica el estado **Habilitado** en el portal DIAN y solicita la numeración de producción.

## Rotación y revocación

1. Sustituye el certificado antes de vencimiento desde el mismo formulario.
2. Si se compromete un secreto, revoca el certificado con la entidad emisora, rota `DIAN_SECRETS_KEY` mediante procedimiento de re-cifrado y desactiva el modo directo hasta verificar la nueva cadena.
