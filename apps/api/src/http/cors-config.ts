import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const defaultOrigins = [
  'https://empyra-web-production.up.railway.app',
  'http://localhost:3000',
];

function configuredOrigins(): Set<string> {
  const configured = process.env['CORS_ORIGINS']
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(configured?.length ? configured : defaultOrigins);
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  return origin !== undefined && configuredOrigins().has(origin);
}

function applyCorsHeaders(request: FastifyRequest, reply: FastifyReply): boolean {
  const origin = request.headers.origin;
  if (!isAllowedOrigin(origin)) return false;

  reply
    .header('Access-Control-Allow-Origin', origin)
    .header('Access-Control-Allow-Credentials', 'true')
    .header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS')
    .header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, X-Requested-With')
    .header('Vary', 'Origin');
  return true;
}

export function configureCors(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const allowed = applyCorsHeaders(request, reply);
    if (request.method === 'OPTIONS') {
      reply.code(allowed ? 204 : 403).send();
    }
  });
}
