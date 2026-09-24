'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { calculateInvoice, calculateAIU } from '@nuvora/calculation-engine';
import type { LineInput, InvoiceResult, AIUResult } from '@nuvora/contracts';
import { useToast } from '../../../../components/ui/ToastProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer { id: string; legal_name: string; identification_type: string; identification: string; }
interface Tax { id: string; code: string; label: string; rate: number; treatment: string; }

interface LineForm {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxTreatment: string;
  taxRate: string;
  discountPct: string;
}

interface AIUForm {
  base: string;
  administracionPct: string;
  imprevistosPct: string;
  utilidadPct: string;
  ivaOnUtilidadPct: string;
}

const newLine = (): LineForm => ({
  id: crypto.randomUUID(),
  description: '',
  quantity: '1',
  unitPrice: '',
  taxTreatment: 'TAXED',
  taxRate: '19',
  discountPct: '0',
});

const EMPTY_AIU: AIUForm = { base: '', administracionPct: '4', imprevistosPct: '3', utilidadPct: '10', ivaOnUtilidadPct: '19' };

const TAX_TREATMENTS = [
  { value: 'TAXED', label: 'Gravado IVA' },
  { value: 'EXEMPT', label: 'Exento' },
  { value: 'EXCLUDED', label: 'Excluido' },
  { value: 'NON_TAXED', label: 'No gravado' },
];

function fmt(n: string | number | null | undefined): string {
  if (n == null || n === '') return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

// ─── Live calculation ─────────────────────────────────────────────────────────

function useLiveCalc(lines: LineForm[], aiuEnabled: boolean, aiuForm: AIUForm): { result: InvoiceResult | null; aiuResult: AIUResult | null; error: string | null } {
  return useMemo(() => {
    const validLines = lines.filter(l => l.description && l.unitPrice && parseFloat(l.unitPrice) >= 0);
    if (validLines.length === 0 && !aiuEnabled) return { result: null, aiuResult: null, error: null };

    try {
      const lineInputs: LineInput[] = validLines.map(l => ({
        description: l.description,
        quantity: l.quantity || '1',
        unitPrice: l.unitPrice,
        taxTreatment: l.taxTreatment as LineInput['taxTreatment'],
        taxRate: parseFloat(l.taxRate) || 0,
        discountPct: parseFloat(l.discountPct) || 0,
      }));

      let aiuResult: AIUResult | null = null;
      if (aiuEnabled && aiuForm.base && parseFloat(aiuForm.base) > 0) {
        try {
          aiuResult = calculateAIU({
            base: aiuForm.base,
            administracionPct: parseFloat(aiuForm.administracionPct) || 0,
            imprevistosPct: parseFloat(aiuForm.imprevistosPct) || 0,
            utilidadPct: parseFloat(aiuForm.utilidadPct) || 0,
            ivaOnUtilidadPct: parseFloat(aiuForm.ivaOnUtilidadPct) || 0,
            mode: 'INFORMATIVE',
          });
        } catch { /* below minimum or invalid — skip */ }
      }

      const result = calculateInvoice({ lines: lineInputs, currency: 'COP' });
      return { result, aiuResult, error: null };
    } catch (e) {
      return { result: null, aiuResult: null, error: e instanceof Error ? e.message : 'Error de cálculo' };
    }
  }, [lines, aiuEnabled, aiuForm]);
}

// ─── Preview panel ────────────────────────────────────────────────────────────

function InvoicePreview({ result, aiuResult, customerName }: {
  result: InvoiceResult | null;
  aiuResult: AIUResult | null;
  customerName: string;
}) {
  const today = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="rounded-2xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden" style={{ borderColor: 'var(--card-border)' }}>
      {/* Document header */}
      <div className="bg-blue-600 px-6 py-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest opacity-75">Factura de venta</p>
            <p className="mt-1 text-2xl font-bold">BORRADOR</p>
          </div>
          <div className="text-right text-xs opacity-75">
            <p>Fecha</p>
            <p className="font-semibold text-sm text-white">{today}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 text-sm">
        {/* Customer */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ui-muted)' }}>Cliente</p>
          <p className="mt-1 font-medium">{customerName || <span style={{ color: 'var(--ui-muted)' }}>Sin seleccionar</span>}</p>
        </div>

        {!result ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center" style={{ borderColor: 'var(--ui-border-strong)', color: 'var(--ui-muted)' }}>
            <p className="text-sm">Agrega líneas para ver el cálculo en vivo</p>
          </div>
        ) : (
          <>
            {/* Lines table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--card-border)' }}>
                    <th className="pb-2 text-left font-semibold uppercase tracking-wide" style={{ color: 'var(--ui-muted)' }}>Descripción</th>
                    <th className="pb-2 text-right font-semibold uppercase tracking-wide" style={{ color: 'var(--ui-muted)' }}>Cant.</th>
                    <th className="pb-2 text-right font-semibold uppercase tracking-wide" style={{ color: 'var(--ui-muted)' }}>P. Unit.</th>
                    <th className="pb-2 text-right font-semibold uppercase tracking-wide" style={{ color: 'var(--ui-muted)' }}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                  {result.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3">{l.description}</td>
                      <td className="py-2 text-right tabular-nums" style={{ color: 'var(--ui-muted)' }}>—</td>
                      <td className="py-2 text-right tabular-nums" style={{ color: 'var(--ui-muted)' }}>{fmt(l.taxableBase)}</td>
                      <td className="py-2 text-right font-medium tabular-nums">{fmt(l.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* AIU breakdown */}
            {aiuResult && (
              <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: 'var(--ui-border-strong)', background: 'var(--ui-hover)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ui-muted)' }}>Contrato AIU</p>
                <div className="space-y-1 text-xs">
                  <Row label="Base del contrato" value={fmt(aiuResult.base)} />
                  <Row label="A+I+U" value={fmt(aiuResult.aiuAmount)} />
                  <Row label="IVA sobre utilidad" value={fmt(aiuResult.ivaAmount)} />
                  <div className="border-t pt-1 mt-1 font-semibold" style={{ borderColor: 'var(--card-border)' }}>
                    <Row label="Total AIU" value={`COP ${fmt(aiuResult.total)}`} bold />
                  </div>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="border-t pt-4 space-y-1.5" style={{ borderColor: 'var(--card-border)' }}>
              <Row label="Subtotal" value={`COP ${fmt(result.subtotal)}`} />
              {result.taxSummary.map((t, i) => (
                <Row
                  key={i}
                  label={t.taxTreatment === 'TAXED' ? `IVA ${t.taxRate}%` : t.taxTreatment}
                  value={`COP ${fmt(t.taxAmount)}`}
                />
              ))}
              <div className="border-t pt-2 mt-2" style={{ borderColor: 'var(--card-border)' }}>
                <Row
                  label="Total a pagar"
                  value={`COP ${fmt(result.grandTotal)}`}
                  bold
                  large
                />
              </div>
            </div>

            <p className="text-xs text-center" style={{ color: 'var(--ui-muted)' }}>
              Vista previa — los valores fiscales definitivos se calculan al emitir
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, large }: { label: string; value: string; bold?: boolean; large?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${large ? 'text-base' : 'text-xs'} ${bold ? 'font-semibold' : ''}`}>
      <span style={{ color: bold ? 'var(--foreground)' : 'var(--ui-muted)' }}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export function InvoiceEditor({ customers, taxes }: { customers: Customer[]; taxes: Tax[] }) {
  const router = useRouter();
  const toast = useToast();

  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<LineForm[]>([newLine()]);
  const [aiuEnabled, setAiuEnabled] = useState(false);
  const [aiuForm, setAiuForm] = useState<AIUForm>({ ...EMPTY_AIU });
  const [saving, setSaving] = useState(false);

  const { result, aiuResult } = useLiveCalc(lines, aiuEnabled, aiuForm);

  const selectedCustomer = customers.find(c => c.id === customerId);

  const addLine = useCallback(() => setLines(ls => [...ls, newLine()]), []);
  const removeLine = useCallback((id: string) => setLines(ls => ls.filter(l => l.id !== id)), []);
  const updateLine = useCallback((id: string, field: keyof LineForm, value: string) =>
    setLines(ls => ls.map(l => l.id === id ? { ...l, [field]: value } : l)), []);

  function autoFillTax(id: string, treatment: string, taxCode: string) {
    const tax = taxes.find(t => t.code === taxCode);
    setLines(ls => ls.map(l => {
      if (l.id !== id) return l;
      return { ...l, taxTreatment: treatment, taxRate: tax ? String(tax.rate) : l.taxRate };
    }));
  }

  const canSave = customerId && lines.some(l => l.description && l.unitPrice);

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const validLines = lines.filter(l => l.description && l.unitPrice);
      const body: Record<string, unknown> = {
        customerId,
        lines: validLines.map(l => ({
          description: l.description,
          quantity: l.quantity || '1',
          unitPrice: l.unitPrice,
          taxTreatment: l.taxTreatment,
          taxRate: parseFloat(l.taxRate) || 0,
          discountPct: parseFloat(l.discountPct) || 0,
        })),
      };
      if (aiuEnabled && aiuForm.base) {
        body['aiu'] = {
          base: aiuForm.base,
          administracionPct: parseFloat(aiuForm.administracionPct),
          imprevistosPct: parseFloat(aiuForm.imprevistosPct),
          utilidadPct: parseFloat(aiuForm.utilidadPct),
          ivaOnUtilidadPct: parseFloat(aiuForm.ivaOnUtilidadPct),
        };
      }

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? 'Error al crear el borrador');
      }
      const draft = await res.json() as { id: string };
      toast.success('Borrador creado');
      router.push(`/app/invoices/${draft.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear el borrador');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      {/* ── Left: editor ── */}
      <div className="space-y-6">
        {/* Customer */}
        <section className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--card-border)', background: 'var(--ui-surface)' }}>
          <h2 className="font-semibold">Cliente</h2>
          <div>
            <label className="ui-field-label" htmlFor="editor-customer">Cliente *</label>
            <select id="editor-customer" className="input mt-2" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
              <option value="">Seleccionar cliente…</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.legal_name} — {c.identification_type}: {c.identification}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Lines */}
        <section className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--card-border)', background: 'var(--ui-surface)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Líneas de factura</h2>
            <button type="button" className="ui-button-secondary text-xs py-1.5 px-3 min-h-0" onClick={addLine}>
              + Agregar línea
            </button>
          </div>

          <div className="space-y-4">
            {lines.map((line, idx) => (
              <div key={line.id} className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--ui-border-strong)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--ui-muted)' }}>Línea {idx + 1}</span>
                  {lines.length > 1 && (
                    <button type="button" className="ui-icon-button h-7 w-7 text-red-500 hover:text-red-700" aria-label="Eliminar línea" onClick={() => removeLine(line.id)}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path d="M6.5 1a.5.5 0 000 1h3a.5.5 0 000-1h-3zM2 4.5A.5.5 0 012.5 4h11a.5.5 0 010 1h-.69l-.92 8.29A1.5 1.5 0 0110.4 15H5.6a1.5 1.5 0 01-1.49-1.71L3.19 5H2.5A.5.5 0 012 4.5z"/>
                      </svg>
                    </button>
                  )}
                </div>

                <div>
                  <label className="ui-field-label" htmlFor={`line-desc-${line.id}`}>Descripción *</label>
                  <input
                    id={`line-desc-${line.id}`}
                    className="input mt-1"
                    type="text"
                    placeholder="Descripción del producto o servicio"
                    value={line.description}
                    onChange={e => updateLine(line.id, 'description', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="ui-field-label text-xs" htmlFor={`line-qty-${line.id}`}>Cantidad</label>
                    <input id={`line-qty-${line.id}`} className="input mt-1" type="number" min="0.000001" step="any" value={line.quantity} onChange={e => updateLine(line.id, 'quantity', e.target.value)} />
                  </div>
                  <div>
                    <label className="ui-field-label text-xs" htmlFor={`line-price-${line.id}`}>Precio unit. *</label>
                    <input id={`line-price-${line.id}`} className="input mt-1" type="number" min="0" step="any" placeholder="0.00" value={line.unitPrice} onChange={e => updateLine(line.id, 'unitPrice', e.target.value)} />
                  </div>
                  <div>
                    <label className="ui-field-label text-xs" htmlFor={`line-disc-${line.id}`}>Descuento %</label>
                    <input id={`line-disc-${line.id}`} className="input mt-1" type="number" min="0" max="100" step="any" value={line.discountPct} onChange={e => updateLine(line.id, 'discountPct', e.target.value)} />
                  </div>
                  <div>
                    <label className="ui-field-label text-xs" htmlFor={`line-tax-${line.id}`}>IVA</label>
                    <select
                      id={`line-tax-${line.id}`}
                      className="input mt-1"
                      value={`${line.taxTreatment}:${line.taxRate}`}
                      onChange={e => {
                        const [treatment = '', code = ''] = e.target.value.split(':');
                        autoFillTax(line.id, treatment, code);
                      }}
                    >
                      {taxes.map(t => (
                        <option key={t.id} value={`${t.treatment}:${t.code}`}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Line subtotal chip */}
                {result?.lines[idx] && (
                  <p className="text-right text-xs font-semibold" style={{ color: 'var(--ui-primary)' }}>
                    Subtotal línea: COP {fmt(result.lines[idx].lineTotal)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* AIU section */}
        <section className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--card-border)', background: 'var(--ui-surface)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Contrato AIU</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ui-muted)' }}>Administración, Imprevistos y Utilidad — para contratos de obra o servicios</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={aiuEnabled}
                onChange={e => setAiuEnabled(e.target.checked)}
                aria-label="Activar cálculo AIU"
              />
              <div className="h-6 w-11 rounded-full border-2 transition-colors peer-checked:border-blue-600 peer-checked:bg-blue-600"
                style={{ background: aiuEnabled ? undefined : 'var(--ui-border-strong)', borderColor: aiuEnabled ? undefined : 'var(--ui-border-strong)' }}>
                <div className={`mt-0.5 ml-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${aiuEnabled ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm font-medium">{aiuEnabled ? 'Activo' : 'Inactivo'}</span>
            </label>
          </div>

          {aiuEnabled && (
            <div className="space-y-4">
              <div>
                <label className="ui-field-label" htmlFor="aiu-base">Base del contrato (COP) *</label>
                <input id="aiu-base" className="input mt-2" type="number" min="0" step="any" placeholder="0.00" value={aiuForm.base} onChange={e => setAiuForm(f => ({ ...f, base: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { key: 'administracionPct', label: 'A - Administración %' },
                  { key: 'imprevistosPct', label: 'I - Imprevistos %' },
                  { key: 'utilidadPct', label: 'U - Utilidad %' },
                  { key: 'ivaOnUtilidadPct', label: 'IVA sobre U %' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="ui-field-label text-xs" htmlFor={`aiu-${key}`}>{label}</label>
                    <input
                      id={`aiu-${key}`}
                      className="input mt-1"
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={aiuForm[key as keyof AIUForm]}
                      onChange={e => setAiuForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              {aiuResult && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl p-3 text-sm" style={{ background: 'var(--ui-hover)' }}>
                  <Chip label="A+I+U" value={`COP ${fmt(aiuResult.aiuAmount)}`} />
                  <Chip label="Utilidad bruta" value={`COP ${fmt(aiuResult.uAmount)}`} />
                  <Chip label="IVA utilidad" value={`COP ${fmt(aiuResult.ivaAmount)}`} />
                  <Chip label="Total AIU" value={`COP ${fmt(aiuResult.total)}`} accent />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-6">
          <button type="button" className="ui-button-secondary" onClick={() => router.back()}>
            Cancelar
          </button>
          <button type="button" className="ui-button-primary" disabled={!canSave || saving} onClick={() => void handleSave()}>
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </button>
        </div>
      </div>

      {/* ── Right: live preview ── */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ui-muted)' }}>
          Vista previa en vivo
        </p>
        <InvoicePreview
          result={result}
          aiuResult={aiuResult}
          customerName={selectedCustomer?.legal_name ?? ''}
        />
      </div>
    </div>
  );
}

function Chip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--ui-muted)' }}>{label}</p>
      <p className={`font-semibold tabular-nums ${accent ? 'text-blue-600 dark:text-blue-400' : ''}`}>{value}</p>
    </div>
  );
}
