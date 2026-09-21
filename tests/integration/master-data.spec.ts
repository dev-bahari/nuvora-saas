import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { OnboardingService } from '../../apps/api/src/auth/onboarding.service.js';
import { CustomersService } from '../../apps/api/src/customers/customers.service.js';
import { ProductsService } from '../../apps/api/src/products/products.service.js';
import { runMigrations } from '../../db/migrate.js';

const { Pool } = pg;

const connectionString =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_test';

describe('Master Data Integration Tests', () => {
  let pool: pg.Pool;
  let onboardingService: OnboardingService;
  let customersService: CustomersService;
  let productsService: ProductsService;

  const runId = `md_${Date.now()}`;
  const createdTenantIds: string[] = [];
  const createdUserIds: string[] = [];

  // Two separate tenant contexts for isolation tests
  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  let ctxA: { userId: string; tenantId: string; permissions: string[]; requestId: string };
  let ctxB: { userId: string; tenantId: string; permissions: string[]; requestId: string };

  beforeAll(async () => {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SAFETY ABORT: cannot run integration tests in production');
    }

    pool = new Pool({ connectionString });

    // Ensure migrations run (idempotent)
    const tableCheck = await pool.query(`SELECT to_regclass('public.taxes') AS t`);
    if (!tableCheck.rows[0]?.t) {
      await runMigrations();
    }

    // Load colombia seed function if not present
    const seedSql = fs.readFileSync(
      path.join(process.cwd(), 'db/seeds/colombia.sql'),
      'utf-8',
    );
    await pool.query(seedSql);

    onboardingService = new OnboardingService(pool);
    customersService = new CustomersService(pool);
    productsService = new ProductsService(pool);

    // Onboard tenant A
    const resA = await onboardingService.onboard(
      `owner_a_${runId}@test.dev`,
      'Password123!',
      'Owner A',
      `Tenant A ${runId}`,
    );
    tenantAId = resA.tenantId;
    userAId = resA.userId;
    createdTenantIds.push(tenantAId);
    createdUserIds.push(userAId);

    // Onboard tenant B
    const resB = await onboardingService.onboard(
      `owner_b_${runId}@test.dev`,
      'Password123!',
      'Owner B',
      `Tenant B ${runId}`,
    );
    tenantBId = resB.tenantId;
    userBId = resB.userId;
    createdTenantIds.push(tenantBId);
    createdUserIds.push(userBId);

    // Seed taxes for both tenants (as superuser bypassing RLS)
    await pool.query(`SELECT seed_colombia_taxes($1)`, [tenantAId]);
    await pool.query(`SELECT seed_colombia_taxes($1)`, [tenantBId]);

    const allPerms = [
      'customers.read','customers.write','products.read','products.write','taxes.read',
    ];
    ctxA = { userId: userAId, tenantId: tenantAId, permissions: allPerms, requestId: 'req-a' };
    ctxB = { userId: userBId, tenantId: tenantBId, permissions: allPerms, requestId: 'req-b' };
  });

  afterAll(async () => {
    if (pool) {
      await pool.query("SET app.maintenance_mode = 'true'");
      if (createdTenantIds.length) {
        // Delete in dependency order
        await pool.query('DELETE FROM products WHERE tenant_id = ANY($1)', [createdTenantIds]);
        await pool.query('DELETE FROM customer_emails WHERE tenant_id = ANY($1)', [createdTenantIds]);
        await pool.query('DELETE FROM customers WHERE tenant_id = ANY($1)', [createdTenantIds]);
        await pool.query('DELETE FROM taxes WHERE tenant_id = ANY($1)', [createdTenantIds]);
        await pool.query('DELETE FROM sessions WHERE tenant_id = ANY($1)', [createdTenantIds]);
        await pool.query('DELETE FROM memberships WHERE tenant_id = ANY($1)', [createdTenantIds]);
        await pool.query('DELETE FROM audit_logs WHERE tenant_id = ANY($1)', [createdTenantIds]);
        await pool.query('DELETE FROM tenants WHERE id = ANY($1)', [createdTenantIds]);
      }
      if (createdUserIds.length) {
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]);
      }
      await pool.query("SET app.maintenance_mode = 'false'");
      await pool.end();
    }
  });

  // ---- Taxes ----

  it('1. tenant A has exactly 5 Colombia taxes', async () => {
    const taxes = await productsService.listTaxes(ctxA);
    expect(taxes).toHaveLength(5);
    const codes = taxes.map((t) => t.code).sort();
    expect(codes).toEqual(['EXCLUDED', 'IVA_0_EX', 'IVA_19', 'IVA_5', 'NON_TAXED']);
  });

  it('2. taxes include IVA 19% with rate 0.19', async () => {
    const taxes = await productsService.listTaxes(ctxA);
    const iva19 = taxes.find((t) => t.code === 'IVA_19');
    expect(iva19).toBeDefined();
    expect(parseFloat(iva19!.rate)).toBeCloseTo(0.19, 4);
    expect(iva19!.treatment).toBe('TAXED');
  });

  it('3. IVA 21% is NOT seeded', async () => {
    const taxes = await productsService.listTaxes(ctxA);
    const iva21 = taxes.find((t) => parseFloat(t.rate) === 0.21);
    expect(iva21).toBeUndefined();
  });

  it('4. tenant B taxes are isolated from tenant A', async () => {
    // Both should have 5 taxes, but they are separate rows
    const taxesA = await productsService.listTaxes(ctxA);
    const taxesB = await productsService.listTaxes(ctxB);
    const idsA = taxesA.map((t) => t.id);
    const idsB = taxesB.map((t) => t.id);
    // No shared IDs
    const overlap = idsA.filter((id) => idsB.includes(id));
    expect(overlap).toHaveLength(0);
  });

  // ---- Customers ----

  it('5. create a customer in tenant A', async () => {
    const customer = await customersService.create(ctxA, {
      identification_type: 'NIT',
      identification: `900${runId.slice(-6)}`,
      legal_name: 'Empresa Test A',
      email_primary: `empresa_a_${runId}@test.dev`,
    });
    expect(customer.id).toBeDefined();
    expect(customer.tenant_id).toBe(tenantAId);
    expect(customer.legal_name).toBe('Empresa Test A');
  });

  it('6. duplicate identification in same tenant is rejected', async () => {
    const ident = `DUP${runId.slice(-6)}`;
    await customersService.create(ctxA, {
      identification_type: 'CC',
      identification: ident,
      legal_name: 'Primero',
      email_primary: `dup1_${runId}@test.dev`,
    });

    await expect(
      customersService.create(ctxA, {
        identification_type: 'CC',
        identification: ident,
        legal_name: 'Duplicado',
        email_primary: `dup2_${runId}@test.dev`,
      }),
    ).rejects.toThrow('already exists');
  });

  it('7. same identification in different tenants is allowed', async () => {
    const ident = `SHARED${runId.slice(-4)}`;
    const cA = await customersService.create(ctxA, {
      identification_type: 'CC',
      identification: ident,
      legal_name: 'Cliente en A',
      email_primary: `shared_a_${runId}@test.dev`,
    });
    const cB = await customersService.create(ctxB, {
      identification_type: 'CC',
      identification: ident,
      legal_name: 'Cliente en B',
      email_primary: `shared_b_${runId}@test.dev`,
    });
    expect(cA.id).not.toBe(cB.id);
    expect(cA.tenant_id).toBe(tenantAId);
    expect(cB.tenant_id).toBe(tenantBId);
  });

  it('8. tenant B cannot see tenant A customers', async () => {
    // Create a customer in A
    const cA = await customersService.create(ctxA, {
      identification_type: 'PPN',
      identification: `ISO${runId.slice(-5)}`,
      legal_name: 'Isolation Test',
      email_primary: `iso_${runId}@test.dev`,
    });

    // Trying to GET it with ctxB should throw NotFound (RLS hides it)
    await expect(customersService.findOne(ctxB, cA.id)).rejects.toThrow();
  });

  it('9. list customers with search returns matching results', async () => {
    const unique = `SearchMe_${runId}`;
    await customersService.create(ctxA, {
      identification_type: 'CC',
      identification: `SCH${runId.slice(-4)}`,
      legal_name: unique,
      email_primary: `search_${runId}@test.dev`,
    });

    const result = await customersService.list(ctxA, { search: unique });
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data[0]?.legal_name).toBe(unique);
  });

  it('10. patch customer updates fields', async () => {
    const c = await customersService.create(ctxA, {
      identification_type: 'CC',
      identification: `PATCH${runId.slice(-4)}`,
      legal_name: 'Original',
      email_primary: `patch_${runId}@test.dev`,
    });

    const updated = await customersService.patch(ctxA, c.id, { legal_name: 'Updated' });
    expect(updated.legal_name).toBe('Updated');
  });

  // ---- Products ----

  it('11. create a product in tenant A', async () => {
    const product = await productsService.create(ctxA, {
      internal_code: `P${runId.slice(-6)}`,
      name: 'Producto Test',
      base_price: '100000.000000',
      tax_treatment: 'TAXED',
    });
    expect(product.id).toBeDefined();
    expect(product.base_price).toBe('100000.000000');
    expect(typeof product.base_price).toBe('string'); // never number
  });

  it('12. duplicate internal_code in same tenant is rejected', async () => {
    const code = `DUPROD${runId.slice(-4)}`;
    await productsService.create(ctxA, {
      internal_code: code,
      name: 'Primero',
      base_price: '0.000000',
    });
    await expect(
      productsService.create(ctxA, {
        internal_code: code,
        name: 'Duplicado',
        base_price: '0.000000',
      }),
    ).rejects.toThrow('already exists');
  });

  it('13. inactive product is excluded from default list (active=true)', async () => {
    const code = `INACT${runId.slice(-5)}`;
    const p = await productsService.create(ctxA, {
      internal_code: code,
      name: 'Inactive Product',
      base_price: '50.000000',
    });

    // Deactivate
    await productsService.patch(ctxA, p.id, { is_active: false });

    // Default list (active=true by default) should not include it
    const result = await productsService.list(ctxA, { active: true });
    const found = result.data.find((pr) => pr.id === p.id);
    expect(found).toBeUndefined();

    // With active=false explicitly we see inactive too
    const allResult = await productsService.list(ctxA, { active: false });
    const foundAll = allResult.data.find((pr) => pr.id === p.id);
    expect(foundAll).toBeDefined();
  });

  it('14. base_price is returned as string, not number', async () => {
    const p = await productsService.create(ctxA, {
      internal_code: `STR${runId.slice(-5)}`,
      name: 'Price as string',
      base_price: '9999.500000',
    });
    expect(typeof p.base_price).toBe('string');
    expect(p.base_price).toBe('9999.500000');
  });

  it('15. pagination cursor works', async () => {
    // Create 3 products
    for (let i = 0; i < 3; i++) {
      await productsService.create(ctxA, {
        internal_code: `PAG${runId.slice(-4)}_${i}`,
        name: `Paginated ${i}`,
        base_price: '1.000000',
      });
    }

    const page1 = await productsService.list(ctxA, { limit: 2 });
    expect(page1.data.length).toBe(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await productsService.list(ctxA, { limit: 2, cursor: page1.nextCursor! });
    expect(page2.data.length).toBeGreaterThanOrEqual(1);
    // No overlap between pages
    const ids1 = page1.data.map((p) => p.id);
    const ids2 = page2.data.map((p) => p.id);
    expect(ids1.filter((id) => ids2.includes(id))).toHaveLength(0);
  });
});
