# Runbook: Privacidad y retención de datos

## Marco normativo

- **Ley 1581 de 2012** (protección de datos personales, Colombia).
- **Decreto 1377 de 2013** (reglamentación parcial de la Ley 1581).
- **Decreto 2242 de 2015** (documentos electrónicos, conservación).
- Retención mínima de documentos fiscales: **5 años** (Art. 46 C.Co.).

## Clasificación de datos

| Clase | Ejemplos | Retención | ¿Borrable a solicitud? |
|---|---|---|---|
| Datos fiscales | Facturas, XML, PDF, CUFE | 5 años mínimo | **No** — obligación legal |
| Datos personales de clientes | Nombre, NIT, email, teléfono | Mientras el contrato esté activo + 5 años | Sí, salvo cuando estén en documentos fiscales |
| Logs de auditoría | `audit_logs` | 5 años | No (son inmutables) |
| Logs de aplicación | Pino JSON | 90 días | Sí (no contienen PII si la redacción está activa) |
| Sesiones | `sessions` | Expiración automática + limpieza mensual | Sí |

## Solicitud de supresión / consulta (titular de datos)

1. Verificar identidad del titular.
2. Determinar si el dato aparece en documentos fiscales emitidos:
   - Si aparece → informar al titular que no puede eliminarse por obligación legal; ofrecer anonimizar campos no fiscales (email, teléfono) si aplica.
   - Si no aparece → eliminar de tablas `customers`, sesiones y logs de app.
3. Registrar la gestión en `audit_logs` con tipo `DATA_SUBJECT_REQUEST`.

## Bloqueo legal (litigo, auditoría DIAN)

```sql
-- Marcar tenant bajo bloqueo legal (no eliminar ningún registro)
UPDATE tenants
SET legal_hold = TRUE, legal_hold_reason = 'DIAN audit 2026', updated_at = NOW()
WHERE id = '<tenant_uuid>';
```

Mientras `legal_hold = TRUE` el proceso de limpieza automática omite este tenant.

## Limpieza automática de sesiones expiradas

```sql
DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '7 days';
```

Ejecutar mensualmente. No elimina sesiones de tenants con `legal_hold = TRUE`.

## Política de cookies / privacidad

Incluir en la UI:
- Banner de cookies antes del primer acceso (solo esenciales en el SaaS).
- Enlace a la política de tratamiento de datos en footer y en el onboarding.
- Los datos de `users` y `customers` nunca salen de la infraestructura sin consentimiento explícito.
