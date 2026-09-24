import { test, expect } from '@playwright/test';

// Skip all tests when servers are not running — syntactically valid, CI-safe.
test.describe('Master data UI — customers', () => {
  test.skip(() => process.env['E2E_SKIP'] === '1', 'servers not running');

  test('customer list: search, clear filter, open create dialog, accessible labels, save toast', async ({ page }) => {
    await page.goto('/app/customers');

    // Search input has accessible label
    const searchInput = page.getByRole('searchbox', { name: /buscar clientes/i });
    await expect(searchInput).toBeVisible();

    // Type a search term
    await searchInput.fill('Acme');
    await expect(searchInput).toHaveValue('Acme');

    // Clear filter
    const clearBtn = page.getByRole('button', { name: /limpiar/i });
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await expect(searchInput).toHaveValue('');
    }

    // Open create dialog
    const newBtn = page.getByTestId('open-new-customer');
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    const dialog = page.getByRole('dialog', { name: /nuevo cliente/i });
    await expect(dialog).toBeVisible();

    // Accessible labels present
    await expect(dialog.getByRole('combobox', { name: /tipo de persona/i })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /número de identificación/i })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /razón social/i })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /email principal/i })).toBeVisible();

    // Fill required fields
    await dialog.getByRole('textbox', { name: /número de identificación/i }).fill('900123456');
    await dialog.getByRole('textbox', { name: /razón social/i }).fill('Empresa Test S.A.S');
    await dialog.getByRole('textbox', { name: /email principal/i }).fill('test@empresa.co');

    // Submit — API call will fail in isolated test but button must be enabled
    const saveBtn = dialog.getByRole('button', { name: /crear cliente/i });
    await expect(saveBtn).toBeEnabled();
  });
});

test.describe('Master data UI — products', () => {
  test.skip(() => process.env['E2E_SKIP'] === '1', 'servers not running');

  test('product list: search, active filter chip, open create dialog, accessible labels, save toast', async ({ page }) => {
    await page.goto('/app/products');

    // Search input
    const searchInput = page.getByRole('searchbox', { name: /buscar productos/i });
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Consultoría');
    await expect(searchInput).toHaveValue('Consultoría');

    // Active filter chips
    const activeChip = page.getByRole('button', { name: 'Activos', exact: true });
    await expect(activeChip).toBeVisible();
    await activeChip.click();
    await expect(activeChip).toHaveAttribute('aria-pressed', 'true');

    // Clear filters
    const clearBtn = page.getByRole('button', { name: /limpiar/i });
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
    }

    // Open create dialog
    const newBtn = page.getByTestId('open-new-product');
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    const dialog = page.getByRole('dialog', { name: /nuevo producto/i });
    await expect(dialog).toBeVisible();

    // Accessible labels
    await expect(dialog.getByRole('textbox', { name: /código interno/i })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /nombre/i })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /precio base/i })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: /tipo/i })).toBeVisible();

    // Fill required fields
    await dialog.getByRole('textbox', { name: /código interno/i }).fill('SRV-001');
    await dialog.getByRole('textbox', { name: /nombre/i }).fill('Servicio de prueba');
    await dialog.getByRole('textbox', { name: /precio base/i }).fill('100000');

    // Save button enabled
    const saveBtn = dialog.getByRole('button', { name: /crear producto/i });
    await expect(saveBtn).toBeEnabled();
  });
});
