/**
 * @nuvora/invoice-view
 *
 * Presentation model and view tokens for rendering fiscal documents.
 * Used by:
 *   - apps/web components/invoice-editor/InvoicePreview (live editor)
 *   - apps/web api/internal/invoice-render (server-side PDF generation)
 *
 * IMPORTANT: This package contains NO fiscal calculation logic.
 * All monetary values are pre-calculated strings from @nuvora/contracts.
 */

import type {
  DraftDocument,
  DraftLine,
  DraftTaxSummary,
  DraftAIU,
  DraftCustomerSnapshot,
} from '@nuvora/contracts';

// ─────────────────────────────────────────────
// View Model types
// ─────────────────────────────────────────────

export interface InvoiceViewLine {
  readonly id: string;
  readonly position: number;
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly discountPct: string;      // e.g. "10.00%"
  readonly taxTreatmentLabel: string; // e.g. "IVA 19%", "Exento"
  readonly grossAmount: string;
  readonly discountAmount: string;
  readonly taxableBase: string;
  readonly taxAmount: string;
  readonly lineTotal: string;
}

export interface InvoiceViewTaxSummary {
  readonly label: string;
  readonly taxableBase: string;
  readonly taxAmount: string;
}

export interface InvoiceViewAIU {
  readonly base: string;
  readonly administracionPct: string;
  readonly imprevistoPct: string;
  readonly utilidadPct: string;
  readonly aiuAmount: string;
  readonly ivaAmount: string;
  readonly total: string;
  readonly belowMinimum: boolean;
  readonly mode: string;
}

export interface InvoiceViewCustomer {
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

/** Flat view model ready for template rendering — no fiscal logic. */
export interface InvoiceViewModel {
  readonly id: string;
  readonly documentType: string;
  readonly status: string;
  readonly isDraft: boolean;
  readonly currency: string;
  readonly issueDate: string;
  readonly dueDate: string | null;
  readonly notes: string | null;
  readonly customer: InvoiceViewCustomer;
  readonly lines: readonly InvoiceViewLine[];
  readonly taxSummary: readonly InvoiceViewTaxSummary[];
  readonly aiu: InvoiceViewAIU | null;
  readonly subtotal: string;
  readonly totalTax: string;
  readonly grandTotal: string;
}

// ─────────────────────────────────────────────
// Formatters (locale-independent, pure)
// ─────────────────────────────────────────────

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function taxTreatmentLabel(treatment: string, rate: number): string {
  switch (treatment) {
    case 'TAXED':     return `IVA ${rate}%`;
    case 'EXEMPT':    return 'Exento';
    case 'EXCLUDED':  return 'Excluido';
    case 'NON_TAXED': return 'No gravado';
    default:          return treatment;
  }
}

function taxSummaryLabel(treatment: string, rate: number): string {
  switch (treatment) {
    case 'TAXED':     return `IVA ${rate}%`;
    case 'EXEMPT':    return 'Base exenta';
    case 'EXCLUDED':  return 'Base excluida';
    case 'NON_TAXED': return 'Base no gravada';
    default:          return treatment;
  }
}

// ─────────────────────────────────────────────
// Adapter: DraftDocument → InvoiceViewModel
// ─────────────────────────────────────────────

function toViewLine(line: DraftLine): InvoiceViewLine {
  return {
    id: line.id,
    position: line.position,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountPct: formatPct(line.discountPct),
    taxTreatmentLabel: taxTreatmentLabel(line.taxTreatment, line.taxRate),
    grossAmount: line.grossAmount,
    discountAmount: line.discountAmount,
    taxableBase: line.taxableBase,
    taxAmount: line.taxAmount,
    lineTotal: line.lineTotal,
  };
}

function toViewTaxSummary(ts: DraftTaxSummary): InvoiceViewTaxSummary {
  return {
    label: taxSummaryLabel(ts.taxTreatment, ts.taxRate),
    taxableBase: ts.taxableBase,
    taxAmount: ts.taxAmount,
  };
}

function toViewAIU(aiu: DraftAIU): InvoiceViewAIU {
  return {
    base: aiu.base,
    administracionPct: formatPct(aiu.administracionPct),
    imprevistoPct: formatPct(aiu.imprevistoPct),
    utilidadPct: formatPct(aiu.utilidadPct),
    aiuAmount: aiu.aiuAmount,
    ivaAmount: aiu.ivaAmount,
    total: aiu.total,
    belowMinimum: aiu.belowMinimum,
    mode: aiu.mode,
  };
}

function toViewCustomer(snapshot: DraftCustomerSnapshot): InvoiceViewCustomer {
  return {
    legalName: snapshot.legalName,
    identificationType: snapshot.identificationType,
    identification: snapshot.identification,
    dv: snapshot.dv,
    emailPrimary: snapshot.emailPrimary,
    address: snapshot.address,
    municipality: snapshot.municipality,
    department: snapshot.department,
    country: snapshot.country,
  };
}

/**
 * Convert a DraftDocument from the API into a flat view model
 * suitable for rendering in React components or PDF templates.
 */
export function toViewModel(doc: DraftDocument): InvoiceViewModel {
  return {
    id: doc.id,
    documentType: doc.documentType,
    status: doc.status,
    isDraft: doc.status === 'DRAFT',
    currency: doc.currency,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate,
    notes: doc.notes,
    customer: toViewCustomer(doc.customerSnapshot),
    lines: doc.lines.map(toViewLine),
    taxSummary: doc.taxSummary.map(toViewTaxSummary),
    aiu: doc.aiu ? toViewAIU(doc.aiu) : null,
    subtotal: doc.subtotal,
    totalTax: doc.totalTax,
    grandTotal: doc.grandTotal,
  };
}
