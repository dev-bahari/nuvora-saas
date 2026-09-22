import { test, expect } from '@playwright/test';

// These tests describe the expected UI behaviour after Task 2 is applied.
// They require a running Nuvora stack (API + web) and a seeded test tenant.
// Skip in CI until the full stack is wired for E2E (see Task 6 of the main plan).
const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:3002';

test.describe('Dashboard', () => {
  test.skip('shows four KPI cards', async ({ page }) => {
    await page.goto(`${BASE}/app/dashboard`);
    const cards = page.locator('article');
    await expect(cards).toHaveCount(4);
  });

  test.skip('primary action links to invoice creation flow', async ({ page }) => {
    await page.goto(`${BASE}/app/dashboard`);
    const btn = page.getByTestId('new-invoice-btn');
    await expect(btn).toBeVisible();
    await btn.click();
    // After click user should be on invoices page (new flow opens dialog there)
    await expect(page).toHaveURL(/\/app\/invoices/);
  });
});

test.describe('Invoices list', () => {
  test.skip('opens filter dialog at 390px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/app/invoices`);
    // On mobile the toolbar shows a "Filtros" button that opens a dialog
    const filtersBtn = page.getByRole('button', { name: /filtros/i });
    await expect(filtersBtn).toBeVisible();
    await filtersBtn.click();
    await expect(page.getByRole('dialog', { name: /filtros/i })).toBeVisible();
  });

  test.skip('all filter chips are reachable without overflow at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/app/invoices`);
    const filtersBtn = page.getByRole('button', { name: /filtros/i });
    await filtersBtn.click();
    const dialog = page.getByRole('dialog', { name: /filtros/i });
    // Each status chip must be visible inside the dialog
    for (const label of ['Todos', 'Borrador', 'Emitido', 'Aceptado DIAN', 'Anulado']) {
      await expect(dialog.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test.skip('opens new invoice dialog from primary action', async ({ page }) => {
    await page.goto(`${BASE}/app/invoices`);
    const btn = page.getByTestId('open-new-invoice');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.getByRole('dialog', { name: /nueva factura/i })).toBeVisible();
    // Escape should close without side effects
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /nueva factura/i })).not.toBeVisible();
  });

  test.skip('emit action requires confirmation', async ({ page }) => {
    // Assumes at least one DRAFT invoice is present in the test seed
    await page.goto(`${BASE}/app/invoices`);
    const actionBtn = page.getByRole('button', { name: /acciones de factura/i }).first();
    await actionBtn.click();
    await page.getByRole('menuitem', { name: /emitir/i }).click();
    const dialog = page.getByRole('alertdialog', { name: /emitir factura/i });
    await expect(dialog).toBeVisible();
    // Escape closes without emitting
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test.skip('cancel action requires confirmation with destructive styling', async ({ page }) => {
    // Assumes at least one ISSUED invoice is present in the test seed
    await page.goto(`${BASE}/app/invoices`);
    const actionBtn = page.getByRole('button', { name: /acciones de factura/i }).first();
    await actionBtn.click();
    await page.getByRole('menuitem', { name: /anular/i }).click();
    const dialog = page.getByRole('alertdialog', { name: /anular factura/i });
    await expect(dialog).toBeVisible();
    // Confirm button must carry danger styling
    const confirmBtn = dialog.getByRole('button', { name: /anular/i });
    await expect(confirmBtn).toHaveClass(/ui-button-danger/);
  });

  test.skip('search filters list client-side', async ({ page }) => {
    await page.goto(`${BASE}/app/invoices`);
    const searchInput = page.getByRole('searchbox');
    await searchInput.fill('cliente-inexistente-xyz');
    await expect(page.getByRole('row')).toHaveCount(1); // header only
  });
});
