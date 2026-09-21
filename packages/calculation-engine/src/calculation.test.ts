import { describe, it, expect } from 'vitest';
import {
  roundMoney,
  calculateLine,
  calculateTaxes,
  calculateAIU,
  calculateInvoice,
  calculateCreditNote,
  calculateDebitNote,
} from './calculation.js';
import { DomainError } from '@nuvora/contracts';
import { Decimal } from 'decimal.js';

// ─── roundMoney ──────────────────────────────────────────────────────────────

describe('roundMoney', () => {
  it('rounds to 2 decimal places ROUND_HALF_UP', () => {
    expect(roundMoney(new Decimal('1.005'))).toBe('1.01');
    expect(roundMoney(new Decimal('1.004'))).toBe('1.00');
    expect(roundMoney(new Decimal('1.2345'))).toBe('1.23');
  });

  it('supports custom scale', () => {
    expect(roundMoney(new Decimal('1.23456789'), 6)).toBe('1.234568');
  });
});

// ─── calculateLine ───────────────────────────────────────────────────────────

describe('calculateLine', () => {
  it('calculates taxed line IVA 19%', () => {
    const result = calculateLine({
      description: 'Service A',
      quantity: '10',
      unitPrice: '1000',
      discountPct: 0,
      taxTreatment: 'TAXED',
      taxRate: 19,
    });
    expect(result.grossAmount).toBe('10000.00');
    expect(result.discountAmount).toBe('0.00');
    expect(result.taxableBase).toBe('10000.00');
    expect(result.taxAmount).toBe('1900.00');
    expect(result.lineTotal).toBe('11900.00');
  });

  it('calculates taxed line IVA 5%', () => {
    const result = calculateLine({
      description: 'Service B',
      quantity: '5',
      unitPrice: '200',
      discountPct: 0,
      taxTreatment: 'TAXED',
      taxRate: 5,
    });
    expect(result.taxAmount).toBe('50.00');
    expect(result.lineTotal).toBe('1050.00');
  });

  it('exempt line: tax is zero', () => {
    const result = calculateLine({
      description: 'Exempt',
      quantity: '1',
      unitPrice: '500',
      taxTreatment: 'EXEMPT',
      taxRate: 0,
    });
    expect(result.taxAmount).toBe('0.00');
    expect(result.lineTotal).toBe('500.00');
  });

  it('excluded line: tax is zero', () => {
    const result = calculateLine({
      description: 'Excluded',
      quantity: '2',
      unitPrice: '100',
      taxTreatment: 'EXCLUDED',
      taxRate: 0,
    });
    expect(result.taxAmount).toBe('0.00');
    expect(result.lineTotal).toBe('200.00');
  });

  it('non_taxed line: tax is zero', () => {
    const result = calculateLine({
      description: 'Non taxed',
      quantity: '3',
      unitPrice: '300',
      taxTreatment: 'NON_TAXED',
      taxRate: 0,
    });
    expect(result.taxAmount).toBe('0.00');
    expect(result.lineTotal).toBe('900.00');
  });

  it('applies discount correctly', () => {
    const result = calculateLine({
      description: 'Discounted',
      quantity: '1',
      unitPrice: '1000',
      discountPct: 10,
      taxTreatment: 'TAXED',
      taxRate: 19,
    });
    expect(result.grossAmount).toBe('1000.00');
    expect(result.discountAmount).toBe('100.00');
    expect(result.taxableBase).toBe('900.00');
    expect(result.taxAmount).toBe('171.00');
    expect(result.lineTotal).toBe('1071.00');
  });

  it('handles 100% discount', () => {
    const result = calculateLine({
      description: 'Free',
      quantity: '5',
      unitPrice: '200',
      discountPct: 100,
      taxTreatment: 'TAXED',
      taxRate: 19,
    });
    expect(result.taxableBase).toBe('0.00');
    expect(result.taxAmount).toBe('0.00');
    expect(result.lineTotal).toBe('0.00');
  });

  it('rounds correctly for fractional amounts', () => {
    const result = calculateLine({
      description: 'Fractional',
      quantity: '3',
      unitPrice: '33.33',
      taxTreatment: 'TAXED',
      taxRate: 19,
    });
    // gross = 3 × 33.33 = 99.99; tax = 99.99 × 0.19 = 18.9981 → 19.00
    expect(result.grossAmount).toBe('99.99');
    expect(result.taxAmount).toBe('19.00');
    expect(result.lineTotal).toBe('118.99');
  });
});

// ─── calculateTaxes ──────────────────────────────────────────────────────────

describe('calculateTaxes', () => {
  it('groups lines by treatment+rate', () => {
    const lines = [
      calculateLine({ description: 'A', quantity: '1', unitPrice: '1000', taxTreatment: 'TAXED', taxRate: 19 }),
      calculateLine({ description: 'B', quantity: '1', unitPrice: '2000', taxTreatment: 'TAXED', taxRate: 19 }),
      calculateLine({ description: 'C', quantity: '1', unitPrice: '500', taxTreatment: 'TAXED', taxRate: 5 }),
      calculateLine({ description: 'D', quantity: '1', unitPrice: '300', taxTreatment: 'EXEMPT', taxRate: 0 }),
    ];
    const summary = calculateTaxes(lines);
    const t19 = summary.find((s) => s.taxTreatment === 'TAXED' && s.taxRate === 19)!;
    const t5 = summary.find((s) => s.taxTreatment === 'TAXED' && s.taxRate === 5)!;
    const exempt = summary.find((s) => s.taxTreatment === 'EXEMPT')!;

    expect(t19.taxableBase).toBe('3000.00');
    expect(t19.taxAmount).toBe('570.00');
    expect(t5.taxableBase).toBe('500.00');
    expect(t5.taxAmount).toBe('25.00');
    expect(exempt.taxableBase).toBe('300.00');
    expect(exempt.taxAmount).toBe('0.00');
  });

  it('sum of grouped tax amounts equals sum of line tax amounts', () => {
    const lines = [
      calculateLine({ description: 'A', quantity: '3', unitPrice: '333.33', taxTreatment: 'TAXED', taxRate: 19 }),
      calculateLine({ description: 'B', quantity: '2', unitPrice: '500', taxTreatment: 'TAXED', taxRate: 19 }),
      calculateLine({ description: 'C', quantity: '1', unitPrice: '1000', taxTreatment: 'EXCLUDED', taxRate: 0 }),
    ];
    const summary = calculateTaxes(lines);
    const summedFromSummary = summary
      .reduce((acc, s) => acc.plus(s.taxAmount), new Decimal(0))
      .toFixed(2);
    const summedFromLines = lines
      .reduce((acc, l) => acc.plus(l.taxAmount), new Decimal(0))
      .toFixed(2);
    expect(summedFromSummary).toBe(summedFromLines);
  });
});

// ─── calculateAIU ────────────────────────────────────────────────────────────

describe('calculateAIU', () => {
  it('canonical case: base 38888155.32, A4 I3 U10 IVA19 → 46238016.67', () => {
    const result = calculateAIU({
      base: '38888155.32',
      administracionPct: 4,
      imprevistosPct: 3,
      utilidadPct: 10,
      ivaOnUtilidadPct: 19,
      mode: 'SPECIAL',
    });
    expect(result.total).toBe('46238016.67');
  });

  it('AIU with no IVA', () => {
    const result = calculateAIU({
      base: '100000',
      administracionPct: 5,
      imprevistosPct: 2,
      utilidadPct: 8,
      ivaOnUtilidadPct: 0,
      mode: 'SPECIAL',
    });
    // AIU = 100000 × 0.15 = 15000
    expect(result.aiuAmount).toBe('15000.00');
    expect(result.ivaAmount).toBe('0.00');
    expect(result.total).toBe('115000.00');
  });

  it('throws DomainError when SPECIAL mode and base < limit', () => {
    expect(() =>
      calculateAIU({
        base: '50000',
        administracionPct: 4,
        imprevistosPct: 3,
        utilidadPct: 10,
        ivaOnUtilidadPct: 19,
        mode: 'SPECIAL',
        minimumBaseLimit: '100000',
      }),
    ).toThrow(DomainError);
  });

  it('belowMinimum false when base >= limit', () => {
    const result = calculateAIU({
      base: '200000',
      administracionPct: 4,
      imprevistosPct: 3,
      utilidadPct: 10,
      ivaOnUtilidadPct: 19,
      mode: 'SPECIAL',
      minimumBaseLimit: '100000',
    });
    expect(result.belowMinimum).toBe(false);
  });

  it('INFORMATIVE mode passes through', () => {
    const result = calculateAIU({
      base: '100000',
      administracionPct: 4,
      imprevistosPct: 3,
      utilidadPct: 10,
      ivaOnUtilidadPct: 19,
      mode: 'INFORMATIVE',
    });
    expect(result.mode).toBe('INFORMATIVE');
  });
});

// ─── calculateInvoice ────────────────────────────────────────────────────────

describe('calculateInvoice', () => {
  it('single taxed line invoice', () => {
    const result = calculateInvoice({
      lines: [{ description: 'X', quantity: '1', unitPrice: '1000', taxTreatment: 'TAXED', taxRate: 19 }],
    });
    expect(result.subtotal).toBe('1000.00');
    expect(result.totalTax).toBe('190.00');
    expect(result.grandTotal).toBe('1190.00');
    expect(result.aiu).toBeNull();
  });

  it('mixed lines invoice grand total', () => {
    const result = calculateInvoice({
      lines: [
        { description: 'A', quantity: '2', unitPrice: '500', taxTreatment: 'TAXED', taxRate: 19 },
        { description: 'B', quantity: '1', unitPrice: '300', taxTreatment: 'EXEMPT', taxRate: 0 },
      ],
    });
    // subtotal = 1000 + 300 = 1300; tax = 190; grand = 1490
    expect(result.grandTotal).toBe('1490.00');
  });

  it('grand total is order-independent', () => {
    const lines = [
      { description: 'A', quantity: '1', unitPrice: '100', taxTreatment: 'TAXED' as const, taxRate: 19 },
      { description: 'B', quantity: '1', unitPrice: '200', taxTreatment: 'EXEMPT' as const, taxRate: 0 },
      { description: 'C', quantity: '1', unitPrice: '300', taxTreatment: 'TAXED' as const, taxRate: 5 },
    ];
    const r1 = calculateInvoice({ lines });
    const r2 = calculateInvoice({ lines: [...lines].reverse() });
    expect(r1.grandTotal).toBe(r2.grandTotal);
  });

  it('invoice with AIU includes AIU total in grandTotal', () => {
    const result = calculateInvoice({
      lines: [{ description: 'X', quantity: '1', unitPrice: '1000', taxTreatment: 'TAXED', taxRate: 19 }],
      aiu: {
        base: '100000',
        administracionPct: 4,
        imprevistosPct: 3,
        utilidadPct: 10,
        ivaOnUtilidadPct: 19,
        mode: 'SPECIAL',
      },
    });
    expect(result.aiu).not.toBeNull();
    // grandTotal = lines total + AIU total
    const aiuTotal = new Decimal(result.aiu!.total);
    const linesTotal = new Decimal(result.subtotal).plus(result.totalTax);
    expect(result.grandTotal).toBe(linesTotal.plus(aiuTotal).toFixed(2));
  });
});

// ─── calculateCreditNote ─────────────────────────────────────────────────────

describe('calculateCreditNote', () => {
  it('full reversal produces negative grand total', () => {
    const original = calculateInvoice({
      lines: [{ description: 'X', quantity: '1', unitPrice: '1000', taxTreatment: 'TAXED', taxRate: 19 }],
    });
    const cn = calculateCreditNote(original, { fullReversal: true });
    expect(cn.grandTotal).toBe('-1190.00');
  });

  it('partial credit note with specific lines', () => {
    const original = calculateInvoice({
      lines: [
        { description: 'A', quantity: '2', unitPrice: '500', taxTreatment: 'TAXED', taxRate: 19 },
      ],
    });
    const cn = calculateCreditNote(original, {
      fullReversal: false,
      lines: [{ description: 'A partial', quantity: '1', unitPrice: '500', taxTreatment: 'TAXED', taxRate: 19 }],
    });
    expect(cn.grandTotal).toBe('-595.00');
  });
});

// ─── calculateDebitNote ──────────────────────────────────────────────────────

describe('calculateDebitNote', () => {
  it('debit note has positive grand total', () => {
    const original = calculateInvoice({
      lines: [{ description: 'X', quantity: '1', unitPrice: '1000', taxTreatment: 'TAXED', taxRate: 19 }],
    });
    const dn = calculateDebitNote(original, {
      lines: [{ description: 'Extra', quantity: '1', unitPrice: '200', taxTreatment: 'TAXED', taxRate: 19 }],
    });
    expect(dn.grandTotal).toBe('238.00');
  });
});
