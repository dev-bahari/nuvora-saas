// Deterministic visual evidence: the real Next shell uses synthetic API data;
// the Vite fixture exercises shared primitives without adding a production route.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const web = resolve(root, 'apps/web');
const webRequire = createRequire(resolve(web, 'package.json'));
const evidence = resolve(root, '.impeccable/review');
await mkdir(evidence, { recursive: true });
const api = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/auth/session') {
    if (!req.headers.cookie?.includes('nuvora_session=visual-fixture')) { res.writeHead(401).end('{}'); return; }
    res.end(JSON.stringify({ userId: 'fixture-user', tenantId: 'fixture-tenant', email: 'ana@example.test', tenantName: 'Empresa de prueba', fullName: 'Ana García' }));
  } else if (req.url === '/metrics') {
    res.end(JSON.stringify({ invoicesThisMonth: 0, revenueThisMonth: '0', pendingDian: 0, rejectedThisMonth: 0, recentDocuments: [] }));
  } else { res.writeHead(404).end('{}'); }
});
await new Promise(resolve => api.listen(3001, '127.0.0.1', resolve));
const next = spawn(process.execPath, [webRequire.resolve('next/dist/bin/next'), 'start', '--port', '3106'], { cwd: web, windowsHide: true, stdio: 'pipe' });
next.stderr.on('data', data => process.stderr.write(data));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let fixture;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch('http://localhost:3106/login')).ok) break; } catch { /* Wait for Next to bind its test port. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await page.context().addCookies([{ name: 'nuvora_session', value: 'visual-fixture', domain: 'localhost', path: '/' }]);
  await page.goto('http://localhost:3106/app/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(evidence, 'task-1-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  console.log('Mobile overflow:', await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflowing: Array.from(document.querySelectorAll('body *')).filter(element => element.getBoundingClientRect().right > innerWidth + 1).map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right })).slice(0, 15) })));
  await page.screenshot({ path: resolve(evidence, 'task-1-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.screenshot({ path: resolve(evidence, 'task-1-mobile-drawer.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.screenshot({ path: resolve(evidence, 'task-1-dark-confirmation.png'), fullPage: true });
  await page.context().clearCookies();
  await page.goto('http://localhost:3106/app/dashboard');
  await expect(page).toHaveURL('http://localhost:3106/login');
  await page.context().addCookies([{ name: 'nuvora_session', value: 'stale-fixture', domain: 'localhost', path: '/' }]);
  await page.goto('http://localhost:3106/app/dashboard');
  await expect(page).toHaveURL('http://localhost:3106/login');
  fixture = await import('./server.mjs');
  await page.goto('http://127.0.0.1:3105/app/customers');
  await expect(page.getByRole('heading', { name: 'Clientes', exact: true })).toBeVisible();
  // The fixture has no Next font loader. Use the same sans-serif fallback as the app.
  await page.addStyleTag({ content: ':root { --font-sans: Arial; }' });
  await page.screenshot({ path: resolve(evidence, 'task-1-primitives-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.screenshot({ path: resolve(evidence, 'task-1-primitives-mobile.png'), fullPage: true });
  console.log('Captured six views. Real Next missing/stale session redirects passed. API data is synthetic.');
} finally {
  await browser.close();
  if (fixture) await fixture.server.close();
  next.kill();
  api.close();
}
