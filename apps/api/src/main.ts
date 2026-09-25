import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { AppModule } from './app.module.js';
import { configureCors } from './http/cors-config.js';

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.newPassword',
  'req.body.token',
  'req.body.dianSoftwarePin',
  'req.body.dianTechnicalKey',
  'req.body.password',
  'req.body.pfxBase64',
  'req.body.caChainBase64',
];

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: process.env['LOG_LEVEL'] ?? 'info',
        redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
      },
      bodyLimit: 1_048_576,
      trustProxy: true,
    }),
  );

  // Cast needed: NestJS uses a custom FastifyTypeProvider; plugins expect the default one
  const fastify = app.getHttpAdapter().getInstance() as unknown as FastifyInstance;

  configureCors(fastify);

  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true },
    noSniff: true,
    xssFilter: true,
    frameguard: { action: 'deny' },
  });

  await fastify.register(fastifyRateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (req: { ip: string }) => req.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded — try again later',
    }),
  });

  await fastify.register(fastifyMultipart, {
    limits: { files: 2, fileSize: 1_048_576, fields: 16 },
  });

  const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3001;
  const host = process.env['HOST'] ?? '0.0.0.0';

  await app.listen(port, host);
  console.log(`Nuvora API listening on http://${host}:${port}`);
}

bootstrap().catch((err) => {
  console.error('Fatal error starting Nuvora API:', err);
  process.exit(1);
});
