import { test, expect } from '@playwright/test';

// These tests describe the expected UI behaviour for the Settings page redesign (Task 4).
// They require a running Nuvora stack (API + web) and an authenticated test session.
// Skip in CI until the full stack is wired for E2E.
const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:3002';

test.describe('Settings page', () => {
  test.skip('renders Empresa and DIAN cards', async ({ page }) => {
    await page.goto(`${BASE}/app/settings`);
    await expect(page.getByRole('heading', { name: /configuración/i })).toBeVisible();
    // Cards headings (uppercase labels rendered as text)
    await expect(page.getByText(/empresa/i).first()).toBeVisible();
    await expect(page.getByText(/dian/i).first()).toBeVisible();
    await expect(page.getByText(/plan/i).first()).toBeVisible();
  });

  test.skip('DIAN secrets are masked — no plaintext PIN in DOM', async ({ page }) => {
    await page.goto(`${BASE}/app/settings`);
    // The visible card shows masked bullets, never the actual PIN value
    const body = await page.content();
    // A real PIN would be a numeric string; the page must only show bullet placeholders
    // We can't know the actual PIN, but we verify there are no password inputs visible on the main page
    const visiblePasswordInputs = page.locator('input[type="password"]:visible');
    await expect(visiblePasswordInputs).toHaveCount(0);
    // The masked placeholder should appear
    await expect(page.getByText('••••••••').first()).toBeVisible();
    // Suppress unused variable warning
    void body;
  });

  test.skip('Edit Empresa dialog opens and has accessible field labels', async ({ page }) => {
    await page.goto(`${BASE}/app/settings`);
    const editButtons = page.getByRole('button', { name: /editar/i });
    // First edit button is for Empresa
    await editButtons.first().click();
    // Dialog should appear with a heading
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /empresa/i })).toBeVisible();
    // Accessible labels for required fields
    await expect(dialog.getByRole('textbox', { name: /razón social/i })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /nit/i })).toBeVisible();
  });

  test.skip('keyboard: Tab reaches Edit button, Enter opens dialog, Escape closes it', async ({ page }) => {
    await page.goto(`${BASE}/app/settings`);
    // Focus the first Edit button via keyboard
    await page.keyboard.press('Tab');
    // Keep tabbing until an Edit button is focused
    for (let i = 0; i < 20; i++) {
      const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
      if (focused === 'Editar') break;
      await page.keyboard.press('Tab');
    }
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(focused).toBe('Editar');

    // Enter opens the dialog
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();

    // Escape closes the dialog
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test.skip('DIAN confirm dialog appears before saving, and toast shows on success', async ({ page }) => {
    await page.goto(`${BASE}/app/settings`);
    // Open DIAN dialog (second Edit button)
    const editButtons = page.getByRole('button', { name: /editar/i });
    await editButtons.nth(1).click();
    const dianDialog = page.getByRole('dialog').first();
    await expect(dianDialog).toBeVisible();

    // Click Guardar inside DIAN dialog — should open confirm dialog
    await dianDialog.getByRole('button', { name: /guardar/i }).click();
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByText(/credenciales fiscales/i)).toBeVisible();

    // Confirm saves and toast appears
    await confirmDialog.getByRole('button', { name: /confirmar/i }).click();
    // Toast with success message
    await expect(page.getByRole('status')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Tax settings page', () => {
  test.skip('shows tax catalog table with Colombia taxes', async ({ page }) => {
    await page.goto(`${BASE}/app/settings/taxes`);
    await expect(page.getByRole('heading', { name: /impuestos/i })).toBeVisible();
    // Table should have a caption or aria-label
    const table = page.getByRole('table', { name: /catálogo/i });
    await expect(table).toBeVisible();
  });

  test.skip('tax table has no Edit controls — read-only', async ({ page }) => {
    await page.goto(`${BASE}/app/settings/taxes`);
    await expect(page.getByRole('button', { name: /editar/i })).toHaveCount(0);
  });
});
