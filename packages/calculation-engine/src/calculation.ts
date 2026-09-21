/**
 * Fiscal calculation engine — pure domain math.
 * All money: Decimal arithmetic, ROUND_HALF_UP, serialized as string.
 */

import { Decimal } from 'decimal.js';
import type {
  LineInput,
  LineResult,
  TaxSummary,
  AIUInput,
  AIUResult,
  InvoiceInput,
  InvoiceResult,
  CreditNoteInput,
  CreditNoteResult,
  DebitNoteInput,
  DebitNoteResult,
} from '@nuvora/contracts';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── roundMoney ──────────────────────────────────────────────────────────────

export function roundMoney(amount: Decimal, scale = 2): string {
  return amount.toDecimalPlaces(scale, Decimal.ROUND_HALF_UP).toFixed(scale);
}

// ─── calculateLine ───────────────────────────────────────────────────────────

export function calculateLine(line: LineInput): LineResult {
  const qty = new Decimal(line.quantity);
  const price = new Decimal(line.unitPrice);
  const discPct = new Decimal(line.discountPct ?? 0);

  const gross = qty.times(price);
  const grossRounded = new Decimal(roundMoney(gross));

  const discount = grossRounded.times(discPct).dividedBy(100);
  const discountRounded = new Decimal(roundMoney(discount));

  const taxableBase = grossRounded.minus(discountRounded);

  const taxRate = line.taxRate ?? 0;
  const taxAmount =
    line.taxTreatment === 'TAXED' && taxRate > 0
      ? new Decimal(roundMoney(taxableBase.times(taxRate).dividedBy(100)))
      : new Decimal('0');

  return Object.freeze({
    description: line.description,
    grossAmount: roundMoney(gross),
    discountAmount: roundMoney(discount),
    taxableBase: roundMoney(taxableBase),
    taxAmount: taxAmount.toFixed(2),
    lineTotal: roundMoney(taxableBase.plus(taxAmount)),
    taxTreatment: line.taxTreatment,
    taxRate,
  });
}

// ─── calculateTaxes ──────────────────────────────────────────────────────────

export function calculateTaxes(lines: readonly LineResult[]): TaxSummary[] {
  const map = new Map<string, { base: Decimal; tax: Decimal; treatment: LineResult['taxTreatment']; rate: number }>();

  for (const line of lines) {
    const key = `${line.taxTreatment}:${line.taxRate}`;
    const existing = map.get(key);
    if (existing) {
      existing.base = existing.base.plus(line.taxableBase);
      existing.tax = existing.tax.plus(line.taxAmount);
    } else {
      map.set(key, {
        base: new Decimal(line.taxableBase),
        tax: new Decimal(line.taxAmount),
        treatment: line.taxTreatment,
        rate: line.taxRate,
      });
    }
  }

  return Array.from(map.values()).map((g) =>
    Object.freeze({
      taxTreatment: g.treatment,
      taxRate: g.rate,
      taxableBase: roundMoney(g.base),
      taxAmount: roundMoney(g.tax),
    }),
  );
}

// ─── calculateAIU ────────────────────────────────────────────────────────────

export function calculateAIU(input: AIUInput): AIUResult {
  const base = new Decimal(input.base);
  const aiuPct = new Decimal(input.administracionPct)
    .plus(input.imprevistosPct)
    .plus(input.utilidadPct);

  // AIU amount = round(base × total_pct / 100)
  const aiuAmount = new Decimal(roundMoney(base.times(aiuPct).dividedBy(100)));

  // U amount = round(base × U_pct / 100)  — round before applying IVA
  const uAmount = new Decimal(roundMoney(base.times(input.utilidadPct).dividedBy(100)));

  // IVA = round(rounded_U_amount × iva / 100)
  const ivaPct = new Decimal(input.ivaOnUtilidadPct ?? 0);
  const ivaAmount = new Decimal(roundMoney(uAmount.times(ivaPct).dividedBy(100)));

  const total = new Decimal(roundMoney(base.plus(aiuAmount).plus(ivaAmount)));

  const belowMinimum =
    input.minimumBaseLimit != null
      ? base.lessThan(input.minimumBaseLimit)
      : false;

  return Object.freeze({
    base: roundMoney(base),
    aiuAmount: aiuAmount.toFixed(2),
    uAmount: uAmount.toFixed(2),
    ivaAmount: ivaAmount.toFixed(2),
    total: total.toFixed(2),
    mode: input.mode ?? 'SPECIAL',
    belowMinimum,
  });
}

// ─── calculateInvoice ────────────────────────────────────────────────────────

export function calculateInvoice(invoice: InvoiceInput): InvoiceResult {
  const lines = invoice.lines.map((l) => calculateLine(l));
  const taxSummary = calculateTaxes(lines);

  const subtotal = new Decimal(
    roundMoney(lines.reduce((acc, l) => acc.plus(l.taxableBase), new Decimal(0))),
  );
  const totalTax = new Decimal(
    roundMoney(lines.reduce((acc, l) => acc.plus(l.taxAmount), new Decimal(0))),
  );

  const aiu = invoice.aiu ? calculateAIU(invoice.aiu) : null;

  const grandTotal = roundMoney(
    subtotal.plus(totalTax).plus(aiu ? new Decimal(aiu.total) : new Decimal(0)),
  );

  return Object.freeze({
    lines,
    taxSummary,
    subtotal: subtotal.toFixed(2),
    totalTax: totalTax.toFixed(2),
    grandTotal,
    aiu,
    currency: invoice.currency ?? 'COP',
  });
}

// ─── calculateCreditNote ─────────────────────────────────────────────────────

export function calculateCreditNote(
  original: InvoiceResult,
  adjustment: CreditNoteInput,
): CreditNoteResult {
  let lines: LineResult[];

  if (adjustment.fullReversal) {
    // Mirror all original lines with negated amounts
    lines = original.lines.map((l) =>
      Object.freeze({
        ...l,
        grossAmount: roundMoney(new Decimal(l.grossAmount).negated()),
        discountAmount: roundMoney(new Decimal(l.discountAmount).negated()),
        taxableBase: roundMoney(new Decimal(l.taxableBase).negated()),
        taxAmount: roundMoney(new Decimal(l.taxAmount).negated()),
        lineTotal: roundMoney(new Decimal(l.lineTotal).negated()),
      }),
    );
  } else {
    lines = (adjustment.lines ?? []).map((l) => {
      const r = calculateLine(l);
      return Object.freeze({
        ...r,
        grossAmount: roundMoney(new Decimal(r.grossAmount).negated()),
        discountAmount: roundMoney(new Decimal(r.discountAmount).negated()),
        taxableBase: roundMoney(new Decimal(r.taxableBase).negated()),
        taxAmount: roundMoney(new Decimal(r.taxAmount).negated()),
        lineTotal: roundMoney(new Decimal(r.lineTotal).negated()),
      });
    });
  }

  const taxSummary = calculateTaxes(lines);
  const subtotal = new Decimal(
    roundMoney(lines.reduce((acc, l) => acc.plus(l.taxableBase), new Decimal(0))),
  );
  const totalTax = new Decimal(
    roundMoney(lines.reduce((acc, l) => acc.plus(l.taxAmount), new Decimal(0))),
  );
  const grandTotal = roundMoney(subtotal.plus(totalTax));

  return Object.freeze({
    lines,
    taxSummary,
    subtotal: subtotal.toFixed(2),
    totalTax: totalTax.toFixed(2),
    grandTotal,
  });
}

// ─── calculateDebitNote ──────────────────────────────────────────────────────

export function calculateDebitNote(
  _original: InvoiceResult,
  adjustment: DebitNoteInput,
): DebitNoteResult {
  const lines = adjustment.lines.map((l) => calculateLine(l));
  const taxSummary = calculateTaxes(lines);

  const subtotal = new Decimal(
    roundMoney(lines.reduce((acc, l) => acc.plus(l.taxableBase), new Decimal(0))),
  );
  const totalTax = new Decimal(
    roundMoney(lines.reduce((acc, l) => acc.plus(l.taxAmount), new Decimal(0))),
  );
  const grandTotal = roundMoney(subtotal.plus(totalTax));

  return Object.freeze({
    lines,
    taxSummary,
    subtotal: subtotal.toFixed(2),
    totalTax: totalTax.toFixed(2),
    grandTotal,
  });
}
