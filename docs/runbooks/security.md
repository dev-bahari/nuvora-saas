# Runbook: Security

## Cabeceras HTTP

`@fastify/helmet` aplica en todos los endpoints:

| Cabecera | Valor |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | `default-src 'self'; object-src 'none'; frame-ancestors 'none'` |

## Rate limiting

`@fastify/rate-limit` global: **300 peticiones / minuto por IP**.  
Los endpoints de auth pueden añadir un `@RateLimit({ max: 10, window: '15 minutes' })` en su decorador.

## Gestión de secretos

- Toda variable sensible va en `.env` (nunca en el código ni en logs).
- El servidor pino redacta `req.headers.authorization`, `req.headers.cookie`, `req.body.password`, `req.body.dianSoftwarePin` y `req.body.dianTechnicalKey` → `[REDACTED]`.
- Rotación de secretos: cambiar la variable de entorno y reiniciar el proceso (sin downtime si hay réplicas).

## Análisis de dependencias

```bash
# Vulnerabilidades conocidas en deps instaladas
pnpm audit --audit-level=high

# Desactualizado
pnpm outdated
```

Ejecutar en CI antes de cada release. Corregir hallazgos `high`/`critical` antes de desplegar.

## Respuesta ante compromiso de credenciales

1. Rotar el secreto comprometido en la plataforma de secretos.
2. Invalidar todas las sesiones activas: `UPDATE sessions SET revoked_at = NOW()`.
3. Revisar `audit_logs` desde la ventana de exposición.
4. Notificar a los tenants afectados si se confirma fuga de datos.
