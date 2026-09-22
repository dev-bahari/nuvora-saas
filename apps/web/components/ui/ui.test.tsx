import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/app/customers'); });

test('dialog receives focus, traps keyboard focus, closes on Escape and restores its trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Nuevo cliente', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo cliente' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await dialog.getByRole('button', { name: 'Guardar cliente' }).focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('confirmation defaults to cancel and Escape never performs the destructive action', async ({ page }) => {
  await page.getByRole('button', { name: 'Eliminar prueba' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Eliminar cliente' });
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Resultado')).toHaveText('Sin cambios');
  await page.getByRole('button', { name: 'Eliminar prueba' }).click();
  await dialog.getByRole('button', { name: 'Eliminar cliente', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Procesando…' })).toBeDisabled();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel('Resultado')).toHaveText('Eliminado');
});

test('toasts announce success and error, and can be dismissed without stealing focus', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Aviso de éxito' });
  await trigger.click();
  await expect(page.getByRole('status').filter({ hasText: 'Cliente guardado' })).toBeVisible();
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Aviso de error' }).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos guardar');
  await page.getByRole('button', { name: 'Cerrar notificación' }).last().click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('failed confirmation keeps the dialog open and its error toast reachable above the modal', async ({ page }) => {
  await page.getByRole('button', { name: 'Eliminar con error' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Eliminar cliente' });
  await dialog.getByRole('button', { name: 'Eliminar cliente', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos eliminar');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar notificación' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Resultado')).toHaveText('Sin cambios');
});

test('desktop navigation marks the current section and logout requires confirmation', async ({ page }) => {
  await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Cerrar sesión' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(/\/app\/customers$/);
});

test('390px mobile navigation and filters stay reachable and do not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  const drawer = page.getByRole('dialog', { name: 'Navegación' });
  await expect(drawer.getByRole('link', { name: 'Clientes' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeFocused();
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  const filters = page.getByRole('dialog', { name: 'Filtros' });
  await filters.getByLabel('Estado').selectOption('active');
  await filters.getByRole('button', { name: 'Ver resultados' }).click();
  await expect(page.getByRole('button', { name: 'Filtros (1)' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.getByRole('button', { name: 'Filtros', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('dark theme and reduced motion retain a visible shell', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('heading', { name: 'Clientes', exact: true })).toBeVisible();
});

test('feedback icons and primary text keep accessible contrast in both themes', async ({ page }) => {
  await page.getByRole('button', { name: 'Aviso de error' }).click();
  for (const dark of [false, true]) {
    if (dark) await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
    const ratios = await page.evaluate(() => {
      function luminance(color: string) {
        const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
        return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
      }
      function contrast(foreground: string, background: string) {
        const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
        return (values[0]! + 0.05) / (values[1]! + 0.05);
      }
      const icon = getComputedStyle(document.querySelector('.ui-toast-error > svg')!);
      const toast = getComputedStyle(document.querySelector('.ui-toast-error')!);
      const button = getComputedStyle(document.querySelector('.ui-button-primary')!);
      return { icon: contrast(icon.color, toast.backgroundColor), button: contrast(button.color, button.backgroundColor) };
    });
    expect(ratios.icon).toBeGreaterThanOrEqual(3);
    expect(ratios.button).toBeGreaterThanOrEqual(4.5);
  }
});
