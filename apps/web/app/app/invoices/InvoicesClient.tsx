'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DataToolbar } from '../../../components/ui/DataToolbar';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Dialog } from '../../../components/ui/Dialog';
import { useToast } from '../../../components/ui/ToastProvider';

export interface InvoiceListItem {
  id: string;
  documentType: string;
  status: string;
  customerName: string;
  currency: string;
  grandTotal: string;
  issueDate: string;
  createdAt: string;
}

interface Customer {
  id: string;
  legal_name: string;
  identification_type: string;
  identification: string;
}

export interface InvoicesClientProps {
  initialData: InvoiceListItem[];
  total: number;
  nextCursor: string | null;
  activeStatus: string;
  customers: Customer[];
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  READY: 'Listo',
  PROCESSING: 'Procesando',
  DIAN_PENDING: 'Pendiente DIAN',
  DIAN_ACCEPTED: 'Aceptado DIAN',
  ISSUED: 'Emitido',
  REJECTED: 'Rechazado',
  CANCELLED_BY_CREDIT_NOTE: 'Anulado',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  ISSUED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DIAN_ACCEPTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PROCESSING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DIAN_PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CANCELLED_BY_CREDIT_NOTE: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'ISSUED', label: 'Emitido' },
  { value: 'DIAN_ACCEPTED', label: 'Aceptado DIAN' },
  { value: 'CANCELLED_BY_CREDIT_NOTE', label: 'Anulado' },
];

function fmtDate(raw: string): string {
  if (!raw) return '—';
  try { return new Date(raw).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return raw; }
}

export function InvoicesClient({ initialData, total, nextCursor, activeStatus, customers }: InvoicesClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(activeStatus);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // confirm state for emit / cancel
  const [confirmAction, setConfirmAction] = useState<{
    type: 'emit' | 'cancel';
    invoiceId: string;
    label: string;
  } | null>(null);

  // new invoice form state
  const [newForm, setNewForm] = useState({
    customerId: '',
    description: '',
    quantity: '1',
    unitPrice: '',
    taxTreatment: 'TAXED',
    taxRate: '19',
  });
  const createBtnRef = useRef<HTMLButtonElement>(null);

  const filtered = initialData.filter((inv) => {
    if (search) {
      const q = search.toLowerCase();
      if (!inv.customerName?.toLowerCase().includes(q) && !inv.id.includes(q)) return false;
    }
    return true;
  });

  function updateStatus(s: string) {
    setStatus(s);
    const url = s ? `/app/invoices?status=${s}` : '/app/invoices';
    router.push(url);
  }

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: newForm.customerId,
          lines: [{
            description: newForm.description,
            quantity: newForm.quantity,
            unitPrice: newForm.unitPrice,
            taxTreatment: newForm.taxTreatment,
            taxRate: parseFloat(newForm.taxRate),
            discountPct: 0,
          }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? 'Error al crear el borrador');
      }
      const draft = await res.json() as { id: string };
      toast.success('Borrador creado');
      setCreateOpen(false);
      router.push(`/app/invoices/${draft.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear el borrador');
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmedAction() {
    if (!confirmAction) return;
    const { type, invoiceId } = confirmAction;
    const endpoint = type === 'emit'
      ? `/api/invoices/${invoiceId}/emit`
      : `/api/invoices/${invoiceId}/cancel`;
    const res = await fetch(endpoint, { method: 'POST', credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message ?? 'No se pudo completar la acción');
    }
    toast.success(type === 'emit' ? 'Factura emitida' : 'Factura anulada');
    router.refresh();
  }

  const activeFilterCount = status ? 1 : 0;

  const filterChips = (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
      {STATUS_FILTERS.map(({ value, label }) => (
        <button
          key={value || 'all'}
          type="button"
          aria-pressed={status === value}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            status === value
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          onClick={() => updateStatus(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <DataToolbar
        searchLabel="Buscar facturas"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cliente o número…"
        filters={filterChips}
        activeFilterCount={activeFilterCount}
        onClear={() => { setSearch(''); updateStatus(''); }}
      >
        <Link
          href="/app/invoices/new"
          className="ui-button-primary shrink-0"
          data-testid="open-new-invoice"
        >
          Nueva factura
        </Link>
      </DataToolbar>

      <p className="text-sm ui-muted">{total} documento{total !== 1 ? 's' : ''}</p>

      {filtered.length === 0 ? (
        <EmptyState
          icon="invoice"
          title="Sin facturas"
          description={'Crea tu primera factura con el botón "Nueva factura" para comenzar a facturar.'}
          action={
            <Link href="/app/invoices/new" className="ui-button-primary">
              Nueva factura
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--card-border)' }}>
          <table className="min-w-full divide-y text-sm" aria-label="Lista de facturas">
            <thead>
              <tr className="text-left">
                {['Cliente', 'Número', 'Fecha', 'Total', 'Estado', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide ui-muted whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/app/invoices/${inv.id}`} className="hover:underline">
                      {inv.customerName || '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 ui-muted font-mono text-xs">#{inv.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 ui-muted whitespace-nowrap">{fmtDate(inv.issueDate)}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums whitespace-nowrap">{inv.currency} {inv.grandTotal}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABELS[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      invoice={inv}
                      onEmit={() => setConfirmAction({ type: 'emit', invoiceId: inv.id, label: 'Emitir factura' })}
                      onCancel={() => setConfirmAction({ type: 'cancel', invoiceId: inv.id, label: 'Anular factura' })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <Link
          href={`/app/invoices?${new URLSearchParams({ ...(status ? { status } : {}), cursor: nextCursor })}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Siguiente página →
        </Link>
      )}

      {/* Create invoice dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="Nueva factura" busy={creating}>
        <div className="space-y-4">
          <div>
            <label className="ui-field-label" htmlFor="new-customerId">Cliente</label>
            <select
              id="new-customerId"
              className="input mt-2"
              value={newForm.customerId}
              onChange={e => setNewForm(f => ({ ...f, customerId: e.target.value }))}
              required
            >
              <option value="">Seleccionar cliente…</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.legal_name} — {c.identification_type}: {c.identification}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ui-field-label" htmlFor="new-description">Descripción</label>
            <input
              id="new-description"
              className="input mt-2"
              type="text"
              placeholder="Servicio o producto"
              value={newForm.description}
              onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ui-field-label" htmlFor="new-quantity">Cantidad</label>
              <input id="new-quantity" className="input mt-2" type="number" min="0.000001" step="any" value={newForm.quantity} onChange={e => setNewForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="new-unitPrice">Precio unitario (COP)</label>
              <input id="new-unitPrice" className="input mt-2" type="number" min="0" step="any" placeholder="0.00" value={newForm.unitPrice} onChange={e => setNewForm(f => ({ ...f, unitPrice: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ui-field-label" htmlFor="new-taxTreatment">Tratamiento IVA</label>
              <select id="new-taxTreatment" className="input mt-2" value={newForm.taxTreatment} onChange={e => setNewForm(f => ({ ...f, taxTreatment: e.target.value }))}>
                <option value="TAXED">Gravado</option>
                <option value="EXEMPT">Exento</option>
                <option value="EXCLUDED">Excluido</option>
                <option value="NON_TAXED">No gravado</option>
              </select>
            </div>
            <div>
              <label className="ui-field-label" htmlFor="new-taxRate">Tasa IVA (%)</label>
              <input id="new-taxRate" className="input mt-2" type="number" min="0" max="100" step="any" value={newForm.taxRate} onChange={e => setNewForm(f => ({ ...f, taxRate: e.target.value }))} />
            </div>
          </div>
          <p className="text-sm ui-muted">Puedes agregar más líneas en el editor después de guardar.</p>
        </div>
        <div className="ui-dialog-actions mt-6">
          <button type="button" className="ui-button-secondary" disabled={creating} onClick={() => setCreateOpen(false)}>Cancelar</button>
          <button type="button" className="ui-button-primary" disabled={creating || !newForm.customerId || !newForm.description || !newForm.unitPrice} onClick={() => void handleCreate()}>
            {creating ? 'Creando…' : 'Crear borrador'}
          </button>
        </div>
      </Dialog>

      {/* Confirm emit / cancel */}
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={open => { if (!open) setConfirmAction(null); }}
        title={confirmAction?.type === 'emit' ? 'Emitir factura' : 'Anular factura'}
        description={
          confirmAction?.type === 'emit'
            ? 'Una vez emitida, la factura será enviada a la DIAN. Esta acción no se puede deshacer.'
            : 'Anular la factura creará una nota crédito y la dejará sin efecto fiscal. Esta acción es irreversible.'
        }
        confirmLabel={confirmAction?.type === 'emit' ? 'Emitir' : 'Anular'}
        onConfirm={handleConfirmedAction}
        destructive={confirmAction?.type === 'cancel'}
      />
    </>
  );
}

function RowActions({ invoice, onEmit, onCancel }: { invoice: InvoiceListItem; onEmit: () => void; onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const canEmit = invoice.status === 'DRAFT' || invoice.status === 'READY';
  const canCancel = invoice.status === 'ISSUED' || invoice.status === 'DIAN_ACCEPTED';

  if (!canEmit && !canCancel) return null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className="ui-icon-button"
        aria-label="Acciones de factura"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onBlur={e => { if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) setOpen(false); }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 min-w-36 rounded-lg border bg-white py-1 shadow-lg dark:bg-slate-900"
          style={{ borderColor: 'var(--card-border)' }}
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
        >
          {canEmit && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => { setOpen(false); onEmit(); }}
            >
              Emitir
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => { setOpen(false); onCancel(); }}
            >
              Anular
            </button>
          )}
        </div>
      )}
    </div>
  );
}
