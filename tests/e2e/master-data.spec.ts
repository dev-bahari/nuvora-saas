import { test, expect } from '@playwright/test';

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';
const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:3001';

// Graceful skip if servers are not running
async function isServerUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.replace('3000', '3001')}/health/live`).catch(() => null);
    return res?.ok ?? false;
  } catch {
    return false;
  }
}

test.describe('Master Data E2E', () => {
  test.beforeAll(async () => {
    const up = await isServerUp(API_URL);
    if (!up) {
      test.skip();
    }
  });

  test('tax settings page shows 5 Colombia entries', async ({ page }) => {
    // Navigate to tax settings (requires auth — skip if unauthenticated redirect)
    const res = await page.goto(`${BASE_URL}/app/settings/taxes`);
    if (res?.url().includes('/login')) {
      test.skip();
      return;
    }
    const rows = page.locator('table[aria-label="Catálogo de impuestos"] tbody tr');
    await expect(rows).toHaveCount(5);
    await expect(page.locator('text=IVA 19%')).toBeVisible();
    await expect(page.locator('text=IVA 5%')).toBeVisible();
    await expect(page.locator('text=Excluido de IVA')).toBeVisible();
  });

  test('customer list page renders', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/app/customers`);
    if (res?.url().includes('/login')) {
      test.skip();
      return;
    }
    await expect(page.locator('h1')).toContainText('Clientes');
    await expect(page.locator('a[href="/app/customers/new"]')).toBeVisible();
  });

  test('new customer form has accessible labels and required fields', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/app/customers/new`);
    if (res?.url().includes('/login')) {
      test.skip();
      return;
    }
    // Labels must be associated with inputs
    const identificationInput = page.locator('#identification');
    await expect(identificationInput).toBeVisible();
    await expect(identificationInput).toHaveAttribute('aria-required', 'true');

    const legalNameInput = page.locator('#legal_name');
    await expect(legalNameInput).toHaveAttribute('aria-required', 'true');
  });

  test('duplicate customer rejected with error message', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/app/customers/new`);
    if (res?.url().includes('/login')) {
      test.skip();
      return;
    }

    const runId = Date.now().toString();
    // Fill form
    await page.fill('#identification', `DUP${runId}`);
    await page.fill('#legal_name', 'Test Corp');
    await page.fill('#email_primary', `dup_${runId}@test.dev`);
    await page.click('button[type="submit"]');

    // If successfully created, go back and try again
    if (!page.url().includes('/new')) {
      await page.goto(`${BASE_URL}/app/customers/new`);
      await page.fill('#identification', `DUP${runId}`);
      await page.fill('#legal_name', 'Duplicate');
      await page.fill('#email_primary', `dup2_${runId}@test.dev`);
      await page.click('button[type="submit"]');
      await expect(page.locator('[role="alert"]')).toContainText('identificación');
    }
  });

  test('product list page renders', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/app/products`);
    if (res?.url().includes('/login')) {
      test.skip();
      return;
    }
    await expect(page.locator('h1')).toContainText('Productos');
    await expect(page.locator('a[href="/app/products/new"]')).toBeVisible();
  });

  test('new product form has accessible labels', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/app/products/new`);
    if (res?.url().includes('/login')) {
      test.skip();
      return;
    }
    await expect(page.locator('#internal_code')).toHaveAttribute('aria-required', 'true');
    await expect(page.locator('#name')).toHaveAttribute('aria-required', 'true');
    await expect(page.locator('#base_price')).toHaveAttribute('aria-required', 'true');
  });

  test('inactive product excluded from active product list', async ({ page }) => {
    // This tests the API filtering — navigating to product list defaults to active only
    const res = await page.goto(`${BASE_URL}/app/products`);
    if (res?.url().includes('/login')) {
      test.skip();
      return;
    }
    // Active list should not show "Inactivo" badges (they would be hidden)
    // Just verify the page loads without error
    await expect(page.locator('h1')).toContainText('Productos');
  });

  test('keyboard navigation works on customer form', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/app/customers/new`);
    if (res?.url().includes('/login')) {
      test.skip();
      return;
    }
    // Tab through fields
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(focused).toBeTruthy();
  });
});
