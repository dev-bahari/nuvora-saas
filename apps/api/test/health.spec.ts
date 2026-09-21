import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { HealthService } from '../src/health/health.service.js';
import { HealthController } from '../src/health/health.controller.js';

const { Pool } = pg;


describe('Health Endpoints (HTTP Contract)', () => {
  let app: NestFastifyApplication;
  let healthService: HealthService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    healthService = moduleFixture.get<HealthService>(HealthService);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /health/live returns 200 with exact status ok body', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns 200 when database dependency is healthy', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns 503 with status error when database is disconnected', async () => {
    // Simulate database outage
    const spy = vi.spyOn(healthService, 'checkDatabase').mockResolvedValueOnce(false);

    const response = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('error');
    // Ensure no internal exceptions, DSN, or stack traces leaked
    expect(body).not.toHaveProperty('database');
    expect(body).not.toHaveProperty('stack');

    spy.mockRestore();
  });

  it('GET /health/ready returns 503 against an actual unreachable database (without mocking)', async () => {
    const unreachablePool = new Pool({
      connectionString: 'postgresql://nuvora_app:wrong@127.0.0.1:54329/nonexistent',
      connectionTimeoutMillis: 500,
    });
    const brokenHealthService = new HealthService(unreachablePool);

    const testFixture = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: brokenHealthService,
        },
      ],
    }).compile();

    const brokenApp = testFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await brokenApp.init();
    await brokenApp.getHttpAdapter().getInstance().ready();

    try {
      const response = await brokenApp.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({ status: 'error' });
    } finally {
      await brokenApp.close();
      await unreachablePool.end().catch(() => {});
    }
  });
});
