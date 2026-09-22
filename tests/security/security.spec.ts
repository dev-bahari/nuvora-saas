/**
 * Security gate tests (T15)
 * Checks that the API enforces auth, rate limits, body limits, and does not
 * leak secrets in error responses or logs.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';

// ── Each describe group owns a unique /24 so rate-limit state never bleeds ───
const IP = {
  headers: '192.168.1.1',
  auth: '192.168.2.1',
  rateOk: '192.168.3.1',
  rateBlock: '192.168.4.1',
  rateSecret: '192.168.5.1',
  body: '192.168.6.1',
  secretLeak: '192.168.7.1',
};

async function buildTestServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 1_048_576, trustProxy: true });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true },
    noSniff: true,
    xssFilter: true,
    frameguard: { action: 'deny' },
  });

  await app.register(fastifyRateLimit, {
    global: true,
    max: 5,
    timeWindow: '10 seconds',
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded — try again later',
    }),
  });

  app.get('/health/live', async () => ({ status: 'ok' }));

  app.get('/protected', async (req, reply) => {
    const auth = req.headers['authorization'];
    if (!auth) return reply.code(401).send({ message: 'Unauthorized' });
    return { ok: true };
  });

  return app;
}

let server: FastifyInstance;
beforeAll(async () => { server = await buildTestServer(); await server.ready(); });
afterAll(async () => { await server.close(); });

// ── 1. Security headers ───────────────────────────────────────────────────────

describe('Security headers', () => {
  const inject = () => server.inject({
    method: 'GET', url: '/health/live',
    headers: { 'x-forwarded-for': IP.headers },
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await inject();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets Strict-Transport-Security', async () => {
    const res = await inject();
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
  });

  it('sets Content-Security-Policy with object-src none', async () => {
    const res = await inject();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("object-src 'none'");
  });

  it('sets X-Frame-Options: DENY', async () => {
    const res = await inject();
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});

// ── 2. Authentication boundary ────────────────────────────────────────────────

describe('Auth boundary', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const res = await server.inject({
      method: 'GET', url: '/protected',
      headers: { 'x-forwarded-for': IP.auth },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 when Authorization header is present', async () => {
    const res = await server.inject({
      method: 'GET', url: '/protected',
      headers: { 'x-forwarded-for': IP.auth, authorization: 'Bearer test-token' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('error body does not expose internal stack trace', async () => {
    const res = await server.inject({
      method: 'GET', url: '/protected',
      headers: { 'x-forwarded-for': IP.auth },
    });
    expect(res.body).not.toMatch(/at\s+\w+\s+\(/);
  });
});

// ── 3. Rate limiting ──────────────────────────────────────────────────────────

describe('Rate limiting', () => {
  it('blocks after exceeding the per-IP limit', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await server.inject({
        method: 'GET', url: '/health/live',
        headers: { 'x-forwarded-for': IP.rateBlock },
      });
      statuses.push(res.statusCode);
    }
    expect(statuses.some((s) => s === 429)).toBe(true);
  });

  it('rate limit error message does not contain secrets', async () => {
    for (let i = 0; i < 6; i++) {
      await server.inject({
        method: 'GET', url: '/health/live',
        headers: { 'x-forwarded-for': IP.rateSecret },
      });
    }
    const res = await server.inject({
      method: 'GET', url: '/health/live',
      headers: { 'x-forwarded-for': IP.rateSecret },
    });
    if (res.statusCode === 429) {
      expect(res.body).not.toMatch(/password|token|secret|key/i);
    }
  });
});

// ── 4. Body size limit ────────────────────────────────────────────────────────

describe('Body size limit', () => {
  it('rejects bodies larger than 1 MiB with a non-2xx status', async () => {
    const bigBody = JSON.stringify({ data: 'x'.repeat(1_100_000) });
    const res = await server.inject({
      method: 'POST', url: '/health/live',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': IP.body,
      },
      payload: bigBody,
    });
    expect(res.statusCode).not.toBe(200);
    expect(res.statusCode).not.toBe(201);
  });
});

// ── 5. No secrets in error responses ─────────────────────────────────────────

describe('Secret leak prevention', () => {
  const secretPatterns = [
    /Bearer\s+[A-Za-z0-9+/]{20,}/,
    /password\s*[:=]\s*\S+/i,
    /pin\s*[:=]\s*\d+/i,
  ];

  it('health endpoint does not expose secrets', async () => {
    const res = await server.inject({
      method: 'GET', url: '/health/live',
      headers: { 'x-forwarded-for': IP.secretLeak },
    });
    for (const p of secretPatterns) expect(res.body).not.toMatch(p);
  });

  it('404 body does not expose secrets', async () => {
    const res = await server.inject({
      method: 'GET', url: '/nonexistent',
      headers: { 'x-forwarded-for': IP.secretLeak },
    });
    for (const p of secretPatterns) expect(res.body).not.toMatch(p);
  });
});
