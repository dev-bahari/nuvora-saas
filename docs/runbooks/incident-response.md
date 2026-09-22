# Runbook: Respuesta a incidentes

## Severidades

| Nivel | Descripción | Respuesta |
|---|---|---|
| P0 | Sistema caído o fuga de datos confirmada | < 15 min |
| P1 | Degradación severa o sospecha de intrusión | < 1 hora |
| P2 | Error funcional con impacto parcial | < 4 horas |
| P3 | Bug menor o degradación de métricas | < 24 horas |

## Pasos generales

### 1. Detección y contención
- Verificar alertas en el panel de métricas y logs estructurados.
- Si hay fuga de datos: **aislar el componente afectado** (deshabilitar endpoint / detener servicio) antes de investigar.

### 2. Diagnóstico
```bash
# Últimas líneas de log de la API
docker logs nuvora-api --tail 200

# Peticiones recientes con errores 5xx
# (buscar en el sistema de logs por level=error)

# Auditoría de un tenant específico
psql $DATABASE_URL -c "
  SELECT event_type, actor_id, created_at, payload
  FROM audit_logs
  WHERE tenant_id = '<uuid>'
  ORDER BY created_at DESC
  LIMIT 50;"
```

### 3. Comunicación
- Notificar internamente al equipo técnico.
- Para P0/P1 con impacto en datos de clientes: informar a los tenants afectados dentro de **72 horas** (Ley 1581 de 2012).

### 4. Resolución y post-mortem
- Desplegar el fix o el rollback.
- Documentar causa raíz, impacto, línea de tiempo y acciones preventivas en `docs/incidents/YYYY-MM-DD-titulo.md`.

## Rollback de despliegue

```bash
# Revertir imagen al tag anterior
docker pull nuvora-api:<tag-anterior>
docker stop nuvora-api && docker rm nuvora-api
docker run -d --name nuvora-api ... nuvora-api:<tag-anterior>
```

## Contactos de escalada

- DBA / infraestructura: registrar en la plataforma de on-call (PagerDuty / OpsGenie).
- DIAN / habilitación: `facturacionelectronica@dian.gov.co` (para problemas de certificado o rechazo masivo).
