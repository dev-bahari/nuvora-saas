/**
 * Fiscal domain contracts — types only, no runtime logic.
 * Imported by calculation-engine and any app layer.
 */

import { z } from 'zod';

// ---------- primitive aliases ----------

/** Decimal money value serialized as a string (never number). */
export type Money = string;

// ---------- tax treatment ----------

export type TaxTreatment = 'TAXED' | 'EXEMPT' | 'EXCLUDED' | 'NON_TAXED';

export type AiuTaxMode = 'SPECIAL' | 'INFORMATIVE' | 'NONE';

// ---------- Zod schemas ----------

/** Accepts only safe decimal strings: no NaN, no exponent, ≤6 decimals. */
const decimalString = z
  .string()
  .regex(
    /^-?\d+(\.\d{1,6})?$/,
    'Must be a decimal string with at most 6 decimal places, no exponent',
  );

export const positiveMoneySchema = decimalString.refine(
  (v) => parseFloat(v) >= 0,
  { message: 'Money value must be non-negative' },
);

export const nonZeroPositiveMoneySchema = decimalString.refine(
  (v) => parseFloat(v) > 0,
  { message: 'Money value must be positive' },
);

// ---------- line ----------

export const LineInputSchema = z.object({
  description: z.string().min(1),
  quantity: decimalString.refine((v) => parseFloat(v) > 0, { message: 'Quantity must be positive' }),
  unitPrice: positiveMoneySchema,
  discountPct: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .default(0),
  taxTreatment: z.enum(['TAXED', 'EXEMPT', 'EXCLUDED', 'NON_TAXED']),
  taxRate: z.number().min(0).max(100).optional().default(0),
});

export type LineInput = z.infer<typeof LineInputSchema>;

export interface LineResult {
  readonly description: string;
  readonly grossAmount: Money;   // quantity × unitPrice
  readonly discountAmount: Money;
  readonly taxableBase: Money;   // grossAmount − discountAmount
  readonly taxAmount: Money;
  readonly lineTotal: Money;     // taxableBase + taxAmount
  readonly taxTreatment: TaxTreatment;
  readonly taxRate: number;
}

// ---------- taxes ----------

export interface TaxSummary {
  readonly taxTreatment: TaxTreatment;
  readonly taxRate: number;
  readonly taxableBase: Money;
  readonly taxAmount: Money;
}

// ---------- AIU ----------

export const AIUInputSchema = z.object({
  base: nonZeroPositiveMoneySchema,
  administracionPct: z.number().min(0).max(100),
  imprevistosPct: z.number().min(0).max(100),
  utilidadPct: z.number().min(0).max(100),
  ivaOnUtilidadPct: z.number().min(0).max(100).optional().default(0),
  mode: z.enum(['SPECIAL', 'INFORMATIVE', 'NONE']).optional().default('SPECIAL'),
  minimumBaseLimit: positiveMoneySchema.optional(),
});

export type AIUInput = z.infer<typeof AIUInputSchema>;

export interface AIUResult {
  readonly base: Money;
  readonly aiuAmount: Money;       // base × (A+I+U)/100, rounded
  readonly uAmount: Money;         // base × U/100, rounded
  readonly ivaAmount: Money;       // round(uAmount) × iva/100, rounded
  readonly total: Money;           // base + aiuAmount + ivaAmount
  readonly mode: AiuTaxMode;
  readonly belowMinimum: boolean;
}

// ---------- invoice ----------

export const InvoiceInputSchema = z.object({
  lines: z.array(LineInputSchema).min(1),
  aiu: AIUInputSchema.optional(),
  currency: z.string().length(3).optional().default('COP'),
});

export type InvoiceInput = z.infer<typeof InvoiceInputSchema>;

export interface InvoiceResult {
  readonly lines: readonly LineResult[];
  readonly taxSummary: readonly TaxSummary[];
  readonly subtotal: Money;        // sum of lineTotal
  readonly totalTax: Money;
  readonly grandTotal: Money;
  readonly aiu: AIUResult | null;
  readonly currency: string;
}

// ---------- credit note ----------

export const CreditNoteInputSchema = z.object({
  lines: z.array(LineInputSchema).optional(),
  fullReversal: z.boolean().optional().default(false),
});

export type CreditNoteInput = z.infer<typeof CreditNoteInputSchema>;

export interface CreditNoteResult {
  readonly lines: readonly LineResult[];
  readonly taxSummary: readonly TaxSummary[];
  readonly subtotal: Money;
  readonly totalTax: Money;
  readonly grandTotal: Money;       // always negative (credit)
}

// ---------- debit note ----------

export const DebitNoteInputSchema = z.object({
  lines: z.array(LineInputSchema).min(1),
});

export type DebitNoteInput = z.infer<typeof DebitNoteInputSchema>;

export interface DebitNoteResult {
  readonly lines: readonly LineResult[];
  readonly taxSummary: readonly TaxSummary[];
  readonly subtotal: Money;
  readonly totalTax: Money;
  readonly grandTotal: Money;       // always positive (debit)
}

// ---------- domain error ----------

export class DomainError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_INPUT'
      | 'NEGATIVE_LINE_TOTAL'
      | 'AIU_BELOW_MINIMUM'
      | 'DEBIT_NOTE_NEGATIVE',
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
