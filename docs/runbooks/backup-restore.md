# Runbook: Backup y restauración

## Backup automático

El script `scripts/backup.sh` realiza un `pg_dump` comprimido, lo cifra con una clave simétrica y lo sube al bucket de respaldo.

```bash
# Ejecutar manualmente (o via cron diario)
bash scripts/backup.sh

# Variables requeridas
DATABASE_URL=postgresql://nuvora_app:pass@host:5432/nuvora
BACKUP_BUCKET=s3://nuvora-backups
BACKUP_ENCRYPTION_KEY=<clave AES-256-CBC de 32 bytes en hex>
```

El script:
1. `pg_dump --format=custom` → archivo `.pgdump` temporal.
2. `openssl enc -aes-256-cbc -pbkdf2` para cifrar.
3. Sube el archivo cifrado al bucket con la fecha como prefijo.
4. Verifica que el tamaño > 0 y elimina el temporal.

## Restauración en entorno vacío

```bash
# 1. Descargar y descifrar
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in backup_YYYY-MM-DD.pgdump.enc \
  -out backup.pgdump

# 2. Restaurar
pg_restore --clean --if-exists -d $RESTORE_DATABASE_URL backup.pgdump

# 3. Verificar conteos clave
psql $RESTORE_DATABASE_URL -c "SELECT COUNT(*) FROM tenants;"
psql $RESTORE_DATABASE_URL -c "SELECT COUNT(*) FROM fiscal_documents;"
psql $RESTORE_DATABASE_URL -c "SELECT COUNT(*) FROM audit_logs;"

# 4. Verificar RLS (debe devolver 0 sin contexto)
psql $RESTORE_DATABASE_URL -U nuvora_app -c "SELECT COUNT(*) FROM fiscal_documents;"
```

## Frecuencia recomendada

| Tipo | Frecuencia | Retención |
|---|---|---|
| Full dump | Diario | 30 días |
| WAL archiving | Continuo (si se configura) | 7 días |
| Snapshot bucket | Semanal | 90 días |

## Prueba de restauración

Ejecutar una restauración en entorno aislado al menos **mensualmente** y registrar los conteos verificados. Los documentos fiscales emitidos deben coincidir exactamente con el origen.
