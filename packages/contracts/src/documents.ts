/**
 * Document domain contracts — types, enums and Zod schemas.
 * Shared between API, Web and packages.
 */

import { z } from 'zod';
import { LineInputSchema, AIUInputSchema } from './fiscal.js';

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export type DocumentStatus =
  | 'DRAFT'
  | 'READY'
  | 'PROCESSING'
  | 'DIAN_PENDING'
  | 'DIAN_ACCEPTED'
  | 'ISSUED'
  | 'REJECTED'
  | 'CANCELLED_BY_CREDIT_NOTE';

export type DocumentType = 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';

// ─────────────────────────────────────────────
// Create draft schema
// ─────────────────────────────────────────────

export const CreateDraftSchema = z.object({
  customerId: z.string().uuid({ message: 'customerId must be a valid UUID' }),
  lines: z.array(LineInputSchema).min(1, 'At least one line is required'),
  aiu: AIUInputSchema.optional(),
  currency: z.string().length(3).optional().default('COP'),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'issueDate must be YYYY-MM-DD').optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD').optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateDraftDto = z.infer<typeof CreateDraftSchema>;

// ─────────────────────────────────────────────
// Patch draft schema
// ─────────────────────────────────────────────

export const PatchDraftSchema = z.object({
  version: z.number().int().min(1, 'version is required for optimistic concurrency'),
  customerId: z.string().uuid().optional(),
  lines: z.array(LineInputSchema).min(1).optional(),
  aiu: AIUInputSchema.optional().nullable(),
  currency: z.string().length(3).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type PatchDraftDto = z.infer<typeof PatchDraftSchema>;

// ─────────────────────────────────────────────
// Response interfaces
// ─────────────────────────────────────────────

export interface DraftLine {
  readonly id: string;
  readonly position: number;
  readonly productId: string | null;
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly discountPct: number;
  readonly taxTreatment: string;
  readonly taxRate: number;
  // calculated
  readonly grossAmount: string;
  readonly discountAmount: string;
  readonly taxableBase: string;
  readonly taxAmount: string;
  readonly lineTotal: string;
}

export interface DraftTaxSummary {
  readonly taxTreatment: string;
  readonly taxRate: number;
  readonly taxableBase: string;
  readonly taxAmount: string;
}

export interface DraftAIU {
  readonly base: string;
  readonly administracionPct: number;
  readonly imprevistoPct: number;
  readonly utilidadPct: number;
  readonly ivaOnUtilidadPct: number;
  readonly mode: string;
  readonly minimumBaseLimit: string | null;
  // calculated
  readonly aiuAmount: string;
  readonly uAmount: string;
  readonly ivaAmount: string;
  readonly total: string;
  readonly belowMinimum: boolean;
}

export interface DraftCustomerSnapshot {
  readonly id: string;
  readonly legalName: string;
  readonly identificationType: string;
  readonly identification: string;
  readonly dv: string | null;
  readonly emailPrimary: string;
  readonly address: string | null;
  readonly municipality: string | null;
  readonly department: string | null;
  readonly country: string;
}

export interface DraftDocument {
  readonly id: string;
  readonly tenantId: string;
  readonly documentType: DocumentType;
  readonly status: DocumentStatus;
  readonly version: number;
  readonly customerId: string | null;
  readonly customerSnapshot: DraftCustomerSnapshot;
  readonly currency: string;
  readonly issueDate: string;
  readonly dueDate: string | null;
  readonly notes: string | null;
  // totals (Money strings)
  readonly subtotal: string;
  readonly totalTax: string;
  readonly grandTotal: string;
  // related
  readonly lines: readonly DraftLine[];
  readonly taxSummary: readonly DraftTaxSummary[];
  readonly aiu: DraftAIU | null;
  // numbering (set on issue)
  readonly numberPrefix?: string | null;
  readonly documentNumber?: number | null;
  // adjustment references (CREDIT_NOTE / DEBIT_NOTE)
  readonly sourceDocumentId?: string | null;
  readonly cude?: string | null;
  readonly reasonCode?: string | null;
  // meta
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DraftListItem {
  readonly id: string;
  readonly documentType: DocumentType;
  readonly status: DocumentStatus;
  readonly version: number;
  readonly customerName: string;
  readonly currency: string;
  readonly grandTotal: string;
  readonly issueDate: string;
  readonly createdAt: string;
}

export interface PagedDraftResult {
  readonly data: readonly DraftListItem[];
  readonly cursor: string | null;
  readonly total: number;
}
