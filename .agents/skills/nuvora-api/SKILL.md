---
name: nuvora-api
description: Use when creating or changing Nuvora Fastify endpoints, NestJS controllers, OpenAPI contracts, DTO validation, auth guards, or HTTP errors.
---

# Nuvora API

The transport validates and translates; it does not decide fiscal behavior.

- Use NestJS with `FastifyAdapter`.
- Derive `userId` and `tenantId` from the authenticated session, never the request body.
- Validate every boundary and serialize money as decimal strings.
- Keep OpenAPI, runtime schema and contract tests aligned.
- Map stable domain errors explicitly; unknown failures remain sanitized `500` responses with a request ID.
- Require `Idempotency-Key` on fiscal issue, note, DIAN, email and webhook operations.
- Define permissions, status codes, pagination and async states for frontend consumers.

Publish contract changes through `nuvora-coordination`; require consumer acknowledgement and an integration test before QA.

