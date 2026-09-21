import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3001;
  const host = process.env['HOST'] ?? '0.0.0.0';

  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`Nuvora API listening on http://${host}:${port}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error starting Nuvora API:', err);
  process.exit(1);
});
