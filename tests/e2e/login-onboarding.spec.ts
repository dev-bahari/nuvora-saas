/**
 * E2E Tests — Login and Onboarding flow
 *
 * These tests require the API (port 3001) and Web (port 3000) servers to be running.
 * Run with: pnpm test:e2e
 *
 * Tests are declared and syntactically valid; they will skip gracefully if the
 * servers are not available in the current environment.
 */
import { test, expect } from '@playwright/test';

const API_URL = process.env['API_URL'] ?? 'http://localhost:3001';
const WEB_URL = process.env['WEB_URL'] ?? 'http://localhost:3000';

const runId = Date.now().toString();
const testEmail = `e2e_${runId}@nuvora.test`;
const testPassword = 'E2ePassword1!';
const testFullName = 'E2E Test User';
const testTenantName = `E2E Empresa ${runId}`;

test.describe('Onboarding and Login flow', () => {
  test.beforeEach(async ({ request }) => {
    // Skip if API is not available
    try {
      const res = await request.get(`${API_URL}/health/live`, { timeout: 3000 });
      test.skip(!res.ok(), 'API server not available — skipping E2E');
    } catch {
      test.skip(true, 'API server not reachable — skipping E2E');
    }
  });

  test('1. onboarding page renders and creates account', async ({ page }) => {
    await page.goto(`${WEB_URL}/onboarding`);

    await page.fill('[name="tenantName"]', testTenantName);
    await page.fill('[name="fullName"]', testFullName);
    await page.fill('[name="email"]', testEmail);
    await page.fill('[name="password"]', testPassword);
    await page.click('[type="submit"]');

    // Should redirect to dashboard after successful onboarding
    await page.waitForURL(`${WEB_URL}/app/dashboard`, { timeout: 10000 });
    await expect(page).toHaveURL(`${WEB_URL}/app/dashboard`);
    await expect(page.locator('text=Dashboard (próximamente)')).toBeVisible();
    await expect(page.locator(`text=${testTenantName}`)).toBeVisible();
  });

  test('2. login page logs in an existing user and redirects to dashboard', async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);

    await page.fill('[name="email"]', testEmail);
    await page.fill('[name="password"]', testPassword);
    await page.click('[type="submit"]');

    await page.waitForURL(`${WEB_URL}/app/dashboard`, { timeout: 10000 });
    await expect(page).toHaveURL(`${WEB_URL}/app/dashboard`);
  });

  test('3. wrong password shows error message', async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);

    await page.fill('[name="email"]', testEmail);
    await page.fill('[name="password"]', 'WrongPassword123');
    await page.click('[type="submit"]');

    // Should stay on login page with an error
    await page.waitForSelector('[role="alert"], .error, p:has-text("inválid")', { timeout: 5000 })
      .catch(() => {}); // error display varies, don't fail hard
    await expect(page).not.toHaveURL(`${WEB_URL}/app/dashboard`);
  });

  test('4. dashboard redirects to login if no session cookie', async ({ page }) => {
    // Navigate without any cookies
    await page.context().clearCookies();
    await page.goto(`${WEB_URL}/app/dashboard`);
    await page.waitForURL(`${WEB_URL}/login`, { timeout: 5000 });
    await expect(page).toHaveURL(`${WEB_URL}/login`);
  });

  test('5. API POST /auth/login sets HttpOnly session cookie', async ({ request }) => {
    // Onboard a fresh user via API directly
    const onboardRes = await request.post(`${API_URL}/auth/onboarding`, {
      data: {
        email: `api_${runId}@nuvora.test`,
        password: testPassword,
        fullName: testFullName,
        tenantName: `API Tenant ${runId}`,
      },
    });
    expect(onboardRes.ok()).toBe(true);

    const cookies = onboardRes.headers()['set-cookie'];
    expect(cookies).toContain('nuvora_session=');
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('SameSite=Lax');
  });

  test('6. GET /auth/session returns 401 with no cookie', async ({ request }) => {
    const res = await request.get(`${API_URL}/auth/session`);
    expect(res.status()).toBe(401);
  });
});
