'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DataToolbar } from '../../../components/ui/DataToolbar';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Dialog } from '../../../components/ui/Dialog';
import { useToast } from '../../../components/ui/ToastProvider';

export interface ProductListItem {
  id: string;
  internal_code: string;
  name: string;
  type: string;
  base_price: string;
  tax_treatment: string;
  is_active: boolean;
}

export interface ProductsClientProps {
  initialData: ProductListItem[];
  total: number;
  nextCursor: string | null;
  activeFilter: string;
}

const TAX_LABELS: Record<string, string> = {
  TAXED: 'Gravado',
  EXEMPT: 'Exento',
  EXCLUDED: 'Excluido',
  NON_TAXED: 'No gravado',
};

const ACTIVE_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
];

const EMPTY_FORM = {
  internal_code: '',
  name: '',
  type: 'PRODUCT',
  unit_of_measure: 'UNIT',
  base_price: '',
  tax_treatment: 'TAXED',
};

export function ProductsClient({ initialData, total, nextCursor, activeFilter }: ProductsClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState(activeFilter);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductListItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const createBtnRef = useRef<HTMLButtonElement>(null);

  function updateFilter(v: string) {
    setActiveChip(v);
    const url = v ? `/app/products?active=${v}` : '/app/products';
    router.push(url);
  }

  const filtered = initialData.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.internal_code.toLowerCase().includes(q);
  });

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          internal_code: newForm.internal_code,
          name: newForm.name,
          type: newForm.type,
          unit_of_measure: newForm.unit_of_measure,
          base_price: newForm.base_price,
          tax_treatment: newForm.tax_treatment,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? 'Error al crear el producto');
      }
      toast.success('Producto creado');
      setCreateOpen(false);
      setNewForm({ ...EMPTY_FORM });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear el producto');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(p: ProductListItem) {
    setEditProduct(p);
    setEditForm({
      internal_code: p.internal_code,
      name: p.name,
      type: p.type,
      unit_of_measure: 'UNIT',
      base_price: p.base_price,
      tax_treatment: p.tax_treatment,
    });
    setEditOpen(true);
  }

  function requestSaveEdit() {
    setPendingEdit({ ...editForm });
    setEditOpen(false);
    setEditConfirmOpen(true);
  }

  async function confirmSaveEdit() {
    if (!editProduct || !pendingEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${editProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: pendingEdit.name,
          unit_of_measure: pendingEdit.unit_of_measure,
          base_price: pendingEdit.base_price,
          tax_treatment: pendingEdit.tax_treatment,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? 'Error al guardar el producto');
      }
      toast.success('Producto actualizado');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar el producto');
    } finally {
      setSaving(false);
      setPendingEdit(null);
      setEditProduct(null);
    }
  }

  const canCreate = newForm.internal_code && newForm.name && newForm.base_price;
  const canEdit = editForm.name && editForm.base_price;
  const activeFilterCount = activeChip ? 1 : 0;

  const filterChips = (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
      {ACTIVE_FILTERS.map(({ value, label }) => (
        <button
          key={value || 'all'}
          type="button"
          aria-pressed={activeChip === value}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            activeChip === value
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          onClick={() => updateFilter(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <DataToolbar
        searchLabel="Buscar productos"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Nombre, código…"
        filters={filterChips}
        activeFilterCount={activeFilterCount}
        onClear={() => { setSearch(''); updateFilter(''); }}
      >
        <button
          ref={createBtnRef}
          type="button"
          className="ui-button-primary shrink-0"
          data-testid="open-new-product"
          onClick={() => setCreateOpen(true)}
        >
          Nuevo producto
        </button>
      </DataToolbar>

      <p className="text-sm ui-muted">{total} producto{total !== 1 ? 's' : ''}</p>

      {filtered.length === 0 ? (
        <EmptyState
          icon="products"
          title="Sin productos"
          description={'Crea tu primer producto con el botón "Nuevo producto".'}
          action={
            <button type="button" className="ui-button-primary" onClick={() => setCreateOpen(true)}>
              Nuevo producto
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--card-border)' }}>
          <table className="min-w-full divide-y text-sm" aria-label="Lista de productos">
            <thead>
              <tr className="text-left">
                {['Código', 'Nombre', 'Tipo', 'Precio base', 'IVA', 'Estado', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide ui-muted whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-mono text-xs ui-muted">{p.internal_code}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/app/products/${p.id}`} className="hover:underline">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 ui-muted">{p.type === 'SERVICE' ? 'Servicio' : 'Producto'}</td>
                  <td className="px-4 py-3 tabular-nums">${p.base_price}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {TAX_LABELS[p.tax_treatment] ?? p.tax_treatment}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" className="ui-button-quiet text-xs" onClick={() => openEdit(p)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <Link
          href={`/app/products?cursor=${nextCursor}${activeChip ? `&active=${activeChip}` : ''}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Siguiente página →
        </Link>
      )}

      {/* Create product dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="Nuevo producto" busy={creating}>
        <ProductForm form={newForm} onChange={v => setNewForm(v as typeof newForm)} idPrefix="new" />
        <div className="ui-dialog-actions mt-6">
          <button type="button" className="ui-button-secondary" disabled={creating} onClick={() => setCreateOpen(false)}>Cancelar</button>
          <button type="button" className="ui-button-primary" disabled={creating || !canCreate} onClick={() => void handleCreate()}>
            {creating ? 'Creando…' : 'Crear producto'}
          </button>
        </div>
      </Dialog>

      {/* Edit product dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Editar producto" busy={saving}>
        <ProductForm form={editForm} onChange={v => setEditForm(v as typeof editForm)} idPrefix="edit" />
        <div className="ui-dialog-actions mt-6">
          <button type="button" className="ui-button-secondary" disabled={saving} onClick={() => setEditOpen(false)}>Cancelar</button>
          <button type="button" className="ui-button-primary" disabled={saving || !canEdit} onClick={requestSaveEdit}>
            Guardar cambios
          </button>
        </div>
      </Dialog>

      {/* Confirm edit */}
      <ConfirmDialog
        open={editConfirmOpen}
        onOpenChange={open => {
          if (!open) { setEditConfirmOpen(false); setPendingEdit(null); }
        }}
        title="Guardar cambios"
        description="¿Confirmas los cambios en este producto? Los datos anteriores serán reemplazados."
        confirmLabel="Guardar"
        onConfirm={confirmSaveEdit}
      />
    </>
  );
}

interface FormState { [key: string]: string }

function ProductForm({ form, onChange, idPrefix }: { form: FormState; onChange: (f: FormState) => void; idPrefix: string }) {
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <div>
        <label className="ui-field-label" htmlFor={`${idPrefix}-internal_code`}>Código interno *</label>
        <input id={`${idPrefix}-internal_code`} className="input mt-2" type="text" required value={form.internal_code} onChange={f('internal_code')} />
      </div>
      <div>
        <label className="ui-field-label" htmlFor={`${idPrefix}-name`}>Nombre *</label>
        <input id={`${idPrefix}-name`} className="input mt-2" type="text" required value={form.name} onChange={f('name')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="ui-field-label" htmlFor={`${idPrefix}-type`}>Tipo</label>
          <select id={`${idPrefix}-type`} className="input mt-2" value={form.type} onChange={f('type')}>
            <option value="PRODUCT">Producto</option>
            <option value="SERVICE">Servicio</option>
          </select>
        </div>
        <div>
          <label className="ui-field-label" htmlFor={`${idPrefix}-unit_of_measure`}>Unidad</label>
          <input id={`${idPrefix}-unit_of_measure`} className="input mt-2" type="text" value={form.unit_of_measure} onChange={f('unit_of_measure')} />
        </div>
      </div>
      <div>
        <label className="ui-field-label" htmlFor={`${idPrefix}-base_price`}>Precio base *</label>
        <input id={`${idPrefix}-base_price`} className="input mt-2" type="text" pattern="^\d+(\.\d{1,6})?$" required placeholder="0.000000" value={form.base_price} onChange={f('base_price')} />
      </div>
      <div>
        <label className="ui-field-label" htmlFor={`${idPrefix}-tax_treatment`}>Tratamiento fiscal</label>
        <select id={`${idPrefix}-tax_treatment`} className="input mt-2" value={form.tax_treatment} onChange={f('tax_treatment')}>
          <option value="TAXED">Gravado</option>
          <option value="EXEMPT">Exento</option>
          <option value="EXCLUDED">Excluido</option>
          <option value="NON_TAXED">No gravado</option>
        </select>
      </div>
    </div>
  );
}
