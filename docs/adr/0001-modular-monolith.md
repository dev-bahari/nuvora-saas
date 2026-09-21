# ADR 0001: Monolito Modular con NestJS Fastify, Next.js App Router y PostgreSQL

**Estado:** Aceptado
**Fecha:** 2026-09-21
**Decisores:** Primary Agent, Modular Architect, Platform Architect
**Contexto Normativo:** Anexo Técnico Facturación Electrónica DIAN v1.9 / SPECS Nuvora

---

## Contexto y Declaración del Problema

Nuvora requiere una plataforma SaaS multiempresa para emisión, validación DIAN, entrega y registro contable de facturación electrónica en Colombia. El sistema debe garantizar aislamiento estricto por tenant (RLS), inmutabilidad fiscal, auditoría append-only, consistencia transaccional y alta confiabilidad operativa, evitando la sobrecomplejidad prematura de microservicios distribuidos.

## Decisión de Arquitectura

Se adopta una topología de **Monolito Modular** en monorepo TypeScript (`pnpm workspaces`) estructurado en:

1. **Frontend (`apps/web`):**
   - Next.js App Router con renderizado en servidor (SSR/RSC) por defecto.
   - Componentes cliente (`"use client"`) estrictamente confinados a islas interactivas (formularios dinámicos, editor y previsualizador local).
   - Tailwind CSS para diseño y accesibilidad WCAG AA.
   - Prohibido empaquetar secretos de servidor o lógica fiscal pura en el bundle de cliente.

2. **Backend API & Processing (`apps/api`):**
   - Node.js LTS + TypeScript + NestJS sobre transporte Fastify (`@nestjs/platform-fastify`) para alta eficiencia HTTP.
   - Monolito modular con límites explícitos de dominio, application services y adapters.
   - Despliegue en procesos diferenciados pero compartiendo base de código:
     - **Proceso API:** Atiende tráfico HTTP REST/OpenAPI y valida autenticación/autorización.
     - **Proceso Worker:** Ejecuta consumidores de background jobs con `pg-boss`.

3. **Dominio Puro y Paquetes Compartidos (`packages/*`):**
   - `@nuvora/contracts`: Esquemas Zod, enums y tipos compartidos estables. Export maps públicos estrictos.
   - `@nuvora/calculation-engine`: Motor de cálculo matemático puro con `decimal.js`. Cero importaciones de NestJS, Fastify, Drizzle, React o infraestructura. Nunca usar `number` de JavaScript para montos monetarios.

4. **Persistencia y Aislamiento:**
   - PostgreSQL como única fuente de verdad transaccional.
   - Row Level Security (RLS) mandatorio en toda tabla comercial, fiscal o contable con `tenant_id`.
   - Transacciones tenant-safe que aplican `SET LOCAL app.tenant_id` y `SET LOCAL app.user_id`.
   - Cola de background jobs persistida con `pg-boss` sobre el mismo PostgreSQL para garantizar transacciones atómicas (patrón Outbox sin dependencia inicial de Redis).

5. **Dirección de Dependencias:**
   - `Dominio/Puro` <- `Application` <- `Infraestructura / Adapters`.
   - El dominio no conoce NestJS, base de datos ni proveedores externos (DIAN, Resend, MinIO, Chromium).
   - `apps/web` nunca importa código interno (`apps/api/src/*`); consume únicamente el contrato público OpenAPI/HTTP tipado.

## Triggers para Extraer Microservicios

No se descompondrá el monolito modular en microservicios independientes a menos que se cumpla al menos uno de los siguientes criterios medibles y comprobados:
1. **Divergencia Operativa / Carga Asimétrica:** Un componente específico (ej. firma digital y generación masiva de XML/PDF) satura CPU/memoria y requiere escalamiento horizontal independiente que el pool de workers de `pg-boss` no pueda absorber económicamente.
2. **Autonomía de Equipos:** Múltiples equipos autónomos gestionan subdominios claramente diferenciados con ciclos de release independientes.
3. **Requisitos de Cumplimiento / Seguridad Aislada:** Aislamiento físico de llaves criptográficas o certificados de firma digital exigidos por autoridades regulatorias o certificación ISO/SOC2.

## Consecuencias

### Positivas
- Refactorizaciones seguras en un único monorepo con compilador estricto.
- Transacciones atómicas de base de datos sin transacciones distribuidas complejas (2PC / Saga innecesaria en MVP).
- Despliegue simplificado y bajo costo de infraestructura inicial.
- Aislamiento RLS verificado a nivel motor de base de datos.

### Negativas / Mitigaciones
- Riesgo de acoplamiento accidental entre módulos: mitigado mediante export maps, `tsconfig` estricto y linting de dependencias arquitectónicas.
- Base de datos compartida: mitigada mediante RLS riguroso y pruebas de aislamiento multitenant continuas.
