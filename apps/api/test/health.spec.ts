import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { HealthService } from '../src/health/health.service.js';
import { HealthController } from '../src/health/health.controller.js';
import { ArtifactsModule } from '../src/artifacts/artifacts.module.js';
import { ArtifactsService } from '../src/artifacts/artifacts.service.js';
import type { DraftDocument } from '@nuvora/contracts';

const { Pool } = pg;

const draftWithoutFiscalIdentifiers = {
  id: '00000000-0000-0000-0000-000000000001',
  tenantId: '00000000-0000-0000-0000-000000000002',
  documentType: 'INVOICE',
  status: 'DRAFT',
  version: 1,
  customerId: null,
  customerSnapshot: {
    id: '00000000-0000-0000-0000-000000000003',
    legalName: 'Cliente de prueba',
    identificationType: 'NIT',
    identification: '900123456',
    dv: null,
    emailPrimary: 'cliente@example.test',
    address: null,
    municipality: null,
    department: null,
    country: 'CO',
  },
  currency: 'COP',
  issueDate: '2026-09-22',
  dueDate: null,
  notes: null,
  subtotal: '100.00',
  totalTax: '19.00',
  grandTotal: '119.00',
  lines: [],
  taxSummary: [],
  aiu: null,
  createdBy: null,
  createdAt: '2026-09-22T00:00:00.000Z',
  updatedAt: '2026-09-22T00:00:00.000Z',
} satisfies DraftDocument;

const issuedDocumentWithFiscalIdentifiers = {
  ...draftWithoutFiscalIdentifiers,
  status: 'ISSUED',
  numberPrefix: 'SETP',
  documentNumber: '990000001',
  cufe: 'a'.repeat(96),
  cude: 'b'.repeat(96),
} satisfies DraftDocument;

const issuedFiscalIdentifiers: Required<Pick<
  DraftDocument,
  'numberPrefix' | 'documentNumber' | 'cufe' | 'cude'
>> = issuedDocumentWithFiscalIdentifiers;


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

describe('Artifacts composition and document contract', () => {
  it('accepts drafts without fiscal identifiers and issued documents with persisted identifiers', () => {
    expect(draftWithoutFiscalIdentifiers).not.toHaveProperty('numberPrefix');
    expect(issuedFiscalIdentifiers).toMatchObject({
      numberPrefix: 'SETP',
      documentNumber: '990000001',
      cufe: 'a'.repeat(96),
      cude: 'b'.repeat(96),
    });
  });

  it('resolves ArtifactsService from its Nest module', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [ArtifactsModule],
    }).compile();

    expect(moduleFixture.get(ArtifactsService)).toBeInstanceOf(ArtifactsService);
    await moduleFixture.close();
  });

  it('resolves ArtifactsService from production-compiled metadata', () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import 'reflect-metadata';
         import { Test } from '@nestjs/testing';
         import { ArtifactsModule } from './dist/artifacts/artifacts.module.js';
         const moduleFixture = await Test.createTestingModule({ imports: [ArtifactsModule] }).compile();
         await moduleFixture.close();`,
      ],
      { cwd: `${process.cwd()}/apps/api`, stdio: 'pipe' },
    );
  });

  it('resolves AuthService from production-compiled metadata', () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import 'reflect-metadata';
         import { Test } from '@nestjs/testing';
         import { AuthModule } from './dist/auth/auth.module.js';
         const moduleFixture = await Test.createTestingModule({ imports: [AuthModule] }).compile();
         await moduleFixture.close();`,
      ],
      { cwd: `${process.cwd()}/apps/api`, stdio: 'pipe' },
    );
  });

  it('resolves OnboardingService from production-compiled metadata', () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import 'reflect-metadata';
         import { Test } from '@nestjs/testing';
         import { AuthModule } from './dist/auth/auth.module.js';
         import { AuthService } from './dist/auth/auth.service.js';
         const moduleFixture = await Test.createTestingModule({ imports: [AuthModule] })
           .overrideProvider(AuthService).useValue({}).compile();
         await moduleFixture.close();`,
      ],
      { cwd: `${process.cwd()}/apps/api`, stdio: 'pipe' },
    );
  });

  it('resolves the production AppModule when DIAN encryption is configured', () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import 'reflect-metadata';
         import { Test } from '@nestjs/testing';
         import { AppModule } from './dist/app.module.js';
         const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
         await moduleFixture.close();`,
      ],
      {
        cwd: `${process.cwd()}/apps/api`,
        stdio: 'pipe',
        env: { ...process.env, DIAN_SECRETS_KEY: 'a'.repeat(64) },
      },
    );
  });
});
