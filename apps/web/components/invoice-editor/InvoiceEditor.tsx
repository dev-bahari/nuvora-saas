'use client';

import { useReducer, useCallback, useRef } from 'react';
import { calculateInvoice } from '@nuvora/calculation-engine';
import type { DraftDocument, DraftLine, DraftTaxSummary, LineInput, AIUInput, PatchDraftDto } from '@nuvora/contracts';
import { LineItem } from './LineItem';
import { AIUPanel } from './AIUPanel';
import { InvoicePreview } from './InvoicePreview';
import { SaveStatus } from './SaveStatus';
import type { SaveState } from './SaveStatus.js';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

// ─── State ────────────────────────────────────────────────────────────

interface EditorState {
  doc: DraftDocument;
  lines: LineInput[];
  aiu: AIUInput | null;
  notes: string;
  saveState: SaveState;
  preview: DraftDocument;
}

type Action =
  | { type: 'SET_LINE'; index: number; field: keyof LineInput; value: string | number }
  | { type: 'ADD_LINE' }
  | { type: 'REMOVE_LINE'; index: number }
  | { type: 'SET_AIU'; aiu: AIUInput | null }
  | { type: 'SET_NOTES'; notes: string }
  | { type: 'SET_SAVE_STATE'; state: SaveState }
  | { type: 'SAVED'; doc: DraftDocument };

const BLANK_LINE: LineInput = {
  description: '',
  quantity: '1',
  unitPrice: '0',
  discountPct: 0,
  taxTreatment: 'TAXED',
  taxRate: 19,
};

function buildPreview(doc: DraftDocument, lines: LineInput[], aiu: AIUInput | null, notes: string): DraftDocument {
  try {
    const result = calculateInvoice({ lines, aiu: aiu ?? undefined, currency: doc.currency });
    return {
      ...doc,
      notes: notes || null,
      lines: result.lines.map((l: import('@nuvora/contracts').LineResult, i: number): DraftLine => ({
        id: doc.lines[i]?.id ?? `local-${i}`,
        position: i,
        productId: null,
        description: lines[i]?.description ?? l.description,
        quantity: lines[i]?.quantity ?? '1',
        unitPrice: lines[i]?.unitPrice ?? '0',
        discountPct: lines[i]?.discountPct ?? 0,
        taxTreatment: l.taxTreatment,
        taxRate: l.taxRate,
        grossAmount: l.grossAmount,
        discountAmount: l.discountAmount,
        taxableBase: l.taxableBase,
        taxAmount: l.taxAmount,
        lineTotal: l.lineTotal,
      })),
      taxSummary: result.taxSummary.map((ts: import('@nuvora/contracts').TaxSummary): DraftTaxSummary => ({
        taxTreatment: ts.taxTreatment,
        taxRate: ts.taxRate,
        taxableBase: ts.taxableBase,
        taxAmount: ts.taxAmount,
      })),
      aiu: result.aiu
        ? {
            base: result.aiu.base,
            administracionPct: aiu?.administracionPct ?? 0,
            imprevistoPct: aiu?.imprevistosPct ?? 0,
            utilidadPct: aiu?.utilidadPct ?? 0,
            ivaOnUtilidadPct: aiu?.ivaOnUtilidadPct ?? 0,
            mode: result.aiu.mode,
            minimumBaseLimit: null,
            aiuAmount: result.aiu.aiuAmount,
            uAmount: result.aiu.uAmount,
            ivaAmount: result.aiu.ivaAmount,
            total: result.aiu.total,
            belowMinimum: result.aiu.belowMinimum,
          }
        : null,
      subtotal: result.subtotal,
      totalTax: result.totalTax,
      grandTotal: result.grandTotal,
    };
  } catch {
    return doc;
  }
}

function toLineInputs(doc: DraftDocument): LineInput[] {
  return doc.lines.map((l: DraftLine): LineInput => ({
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discountPct: l.discountPct,
    taxTreatment: l.taxTreatment as LineInput['taxTreatment'],
    taxRate: l.taxRate,
  }));
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'SET_LINE': {
      const lines = state.lines.map((l, i) =>
        i === action.index ? { ...l, [action.field]: action.value } : l,
      );
      return { ...state, lines, preview: buildPreview(state.doc, lines, state.aiu, state.notes) };
    }
    case 'ADD_LINE': {
      const lines = [...state.lines, { ...BLANK_LINE }];
      return { ...state, lines, preview: buildPreview(state.doc, lines, state.aiu, state.notes) };
    }
    case 'REMOVE_LINE': {
      const lines = state.lines.filter((_, i) => i !== action.index);
      return { ...state, lines, preview: buildPreview(state.doc, lines, state.aiu, state.notes) };
    }
    case 'SET_AIU': {
      return {
        ...state,
        aiu: action.aiu,
        preview: buildPreview(state.doc, state.lines, action.aiu, state.notes),
      };
    }
    case 'SET_NOTES': {
      return {
        ...state,
        notes: action.notes,
        preview: buildPreview(state.doc, state.lines, state.aiu, action.notes),
      };
    }
    case 'SET_SAVE_STATE':
      return { ...state, saveState: action.state };
    case 'SAVED':
      return {
        ...state,
        doc: action.doc,
        lines: toLineInputs(action.doc),
        saveState: 'saved',
        preview: action.doc,
      };
    default:
      return state;
  }
}

// ─── Component ───────────────────────────────────────────────────────

interface Props {
  initialDoc: DraftDocument;
}

export function InvoiceEditor({ initialDoc }: Props) {
  const [state, dispatch] = useReducer(reducer, {
    doc: initialDoc,
    lines: toLineInputs(initialDoc),
    aiu: null,
    notes: initialDoc.notes ?? '',
    saveState: 'idle',
    preview: initialDoc,
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dispatch({ type: 'SET_SAVE_STATE', state: 'saving' });
    saveTimer.current = setTimeout(async () => {
      const dto: PatchDraftDto = {
        version: state.doc.version,
        lines: state.lines,
        notes: state.notes || undefined,
        aiu: state.aiu ?? undefined,
      };
      try {
        const res = await fetch(`${API_URL}/invoices/${state.doc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(dto),
        });
        if (res.status === 409) {
          dispatch({ type: 'SET_SAVE_STATE', state: 'conflict' });
          return;
        }
        if (!res.ok) {
          dispatch({ type: 'SET_SAVE_STATE', state: 'error' });
          return;
        }
        const updated = await res.json() as DraftDocument;
        dispatch({ type: 'SAVED', doc: updated });
      } catch {
        dispatch({ type: 'SET_SAVE_STATE', state: 'error' });
      }
    }, 1200);
  }, [state.doc.id, state.doc.version, state.lines, state.notes, state.aiu]);

  function handleLineChange(index: number, field: keyof LineInput, value: string | number) {
    dispatch({ type: 'SET_LINE', index, field, value });
    scheduleSave();
  }

  function handleLineRemove(index: number) {
    dispatch({ type: 'REMOVE_LINE', index });
    scheduleSave();
  }

  function handleAddLine() {
    dispatch({ type: 'ADD_LINE' });
    scheduleSave();
  }

  function handleAIUChange(aiu: AIUInput | null) {
    dispatch({ type: 'SET_AIU', aiu });
    scheduleSave();
  }

  function handleNotesChange(notes: string) {
    dispatch({ type: 'SET_NOTES', notes });
    scheduleSave();
  }

  const isReadOnly = state.doc.status !== 'DRAFT';

  return (
    <div className="flex gap-6 min-h-screen">
      {/* Left panel — editor */}
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">
            {isReadOnly ? 'Factura' : 'Editor de borrador'}
          </h1>
          <SaveStatus state={state.saveState} />
          {isReadOnly && (
            <span className="text-xs bg-neutral-200 px-2 py-1 rounded">{state.doc.status}</span>
          )}
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-1">Notas</label>
          <textarea
            id="notes"
            value={state.notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            disabled={isReadOnly}
            rows={2}
            className="w-full border rounded px-3 py-2 text-sm disabled:bg-neutral-50"
            placeholder="Observaciones opcionales…"
          />
        </div>

        {/* Lines table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-100">
                <th className="text-left p-2 border">Descripción</th>
                <th className="text-right p-2 border w-20">Cant.</th>
                <th className="text-right p-2 border w-28">Precio</th>
                <th className="text-right p-2 border w-16">Desc.%</th>
                <th className="text-left p-2 border w-28">IVA</th>
                <th className="text-right p-2 border w-16">Tasa%</th>
                <th className="p-2 border w-8" />
              </tr>
            </thead>
            <tbody>
              {state.lines.map((line, i) => (
                <LineItem
                  key={i}
                  index={i}
                  line={line}
                  onChange={handleLineChange}
                  onRemove={handleLineRemove}
                  canRemove={!isReadOnly && state.lines.length > 1}
                />
              ))}
            </tbody>
          </table>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={handleAddLine}
            className="text-sm text-blue-600 hover:underline"
          >
            + Agregar línea
          </button>
        )}

        <AIUPanel aiu={state.aiu} onChange={handleAIUChange} />
      </div>

      {/* Right panel — preview */}
      <div className="w-96 shrink-0 p-6 sticky top-0 self-start">
        <p className="text-xs text-neutral-400 mb-3">Vista previa</p>
        <InvoicePreview doc={state.preview} />
      </div>
    </div>
  );
}
