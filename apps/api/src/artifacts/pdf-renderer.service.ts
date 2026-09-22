import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { DraftDocument } from '@nuvora/contracts';
import { toViewModel } from '@nuvora/invoice-view';

/**
 * PdfRendererService — generates PDF from a DraftDocument using Playwright.
 *
 * The HTML is generated inline from the invoice-view model to avoid a round-trip
 * to the web service. Playwright must be installed (browsers included).
 *
 * ponytail: inline HTML generation; promote to web render endpoint when the
 * design system diverges from the server-generated template.
 */
@Injectable()
export class PdfRendererService {
  async render(doc: DraftDocument): Promise<Buffer> {
    const vm = toViewModel(doc);
    const html = buildHtml(vm, doc);

    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /** SHA-256 of content — used for artifact integrity */
  static sha256(buf: Buffer): string {
    return crypto.createHash('sha256').update(buf).digest('hex');
  }
}

function buildHtml(vm: ReturnType<typeof toViewModel>, doc: DraftDocument): string {
  const watermark = vm.isDraft
    ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);
        font-size:60px;color:rgba(255,0,0,0.15);font-weight:900;white-space:nowrap;pointer-events:none;">
        BORRADOR — NO VÁLIDO COMO FACTURA</div>`
    : '';

  const lines = doc.lines
    .map(
      (l) => `<tr>
      <td>${l.description}</td>
      <td style="text-align:right">${l.quantity}</td>
      <td style="text-align:right">${l.unitPrice}</td>
      <td style="text-align:right">${l.taxTreatment}</td>
      <td style="text-align:right">${l.lineTotal}</td>
    </tr>`,
    )
    .join('');

  const taxes = doc.taxSummary
    .map((t) => `<tr><td>IVA ${t.taxRate}%</td><td style="text-align:right">${t.taxAmount}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; }
  h1 { font-size: 16px; margin: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #f4f4f4; border-bottom: 1px solid #ccc; padding: 6px; text-align: left; }
  td { border-bottom: 1px solid #eee; padding: 6px; }
  .totals td { font-weight: bold; }
  .header { display: flex; justify-content: space-between; margin-bottom: 16px; }
  .cude { font-size: 9px; color: #666; margin-top: 16px; word-break: break-all; }
</style>
</head>
<body>
${watermark}
<div class="header">
  <div>
    <h1>${vm.documentType === 'INVOICE' ? 'Factura de Venta' : vm.documentType}</h1>
    <p>No. ${doc.numberPrefix ?? ''}${doc.documentNumber ?? '(pendiente)'}</p>
    <p>Fecha: ${vm.issueDate}</p>
  </div>
</div>
<table>
  <tr>
    <th>Descripción</th>
    <th style="text-align:right">Cant.</th>
    <th style="text-align:right">Precio</th>
    <th style="text-align:right">IVA</th>
    <th style="text-align:right">Total</th>
  </tr>
  ${lines}
  <tr class="totals">
    <td colspan="4">Subtotal</td><td style="text-align:right">${doc.currency} ${vm.subtotal}</td>
  </tr>
  ${taxes}
  <tr class="totals" style="border-top:2px solid #333">
    <td colspan="4">TOTAL</td><td style="text-align:right">${doc.currency} ${vm.grandTotal}</td>
  </tr>
</table>
${doc.cude ? `<div class="cude">CUDE: ${doc.cude}</div>` : ''}
</body>
</html>`;
}
