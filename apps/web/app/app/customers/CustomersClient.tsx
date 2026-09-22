'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DataToolbar } from '../../../components/ui/DataToolbar';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Dialog } from '../../../components/ui/Dialog';
import { useToast } from '../../../components/ui/ToastProvider';

export interface CustomerListItem {
  id: string;
  legal_name: string;
  identification_type: string;
  identification: string;
  email_primary: string;
  is_active: boolean;
}

export interface CustomersClientProps {
  initialData: CustomerListItem[];
  total: number;
  nextCursor: string | null;
}

const ID_TYPES: Record<string, string> = { NIT: 'NIT', CC: 'C.C.', CE: 'C.E.', PPN: 'Pasaporte' };

const EMPTY_FORM = {
  type: 'LEGAL_ENTITY',
  identification_type: 'NIT',
  identification: '',
  legal_name: '',
  email_primary: '',
  phone: '',
  address: '',
  municipality: '',
  department: '',
};

export function CustomersClient({ initialData, total, nextCursor }: CustomersClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerListItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);

  const [newForm, setNewForm] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const createBtnRef = useRef<HTMLButtonElement>(null);

  const filtered = initialData.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.legal_name.toLowerCase().includes(q) ||
      c.identification.includes(q) ||
      c.email_primary.toLowerCase().includes(q)
    );
  });

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: newForm.type,
          identification_type: newForm.identification_type,
          identification: newForm.identification,
          legal_name: newForm.legal_name,
          email_primary: newForm.email_primary,
          phone: newForm.phone || undefined,
          address: newForm.address || undefined,
          municipality: newForm.municipality || undefined,
          department: newForm.department || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? 'Error al crear el cliente');
      }
      toast.success('Cliente creado');
      setCreateOpen(false);
      setNewForm({ ...EMPTY_FORM });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear el cliente');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(c: CustomerListItem) {
    setEditCustomer(c);
    setEditForm({
      type: 'LEGAL_ENTITY',
      identification_type: c.identification_type,
      identification: c.identification,
      legal_name: c.legal_name,
      email_primary: c.email_primary,
      phone: '',
      address: '',
      municipality: '',
      department: '',
    });
    setEditOpen(true);
  }

  function requestSaveEdit() {
    setPendingEdit({ ...editForm });
    setEditOpen(false);
    setEditConfirmOpen(true);
  }

  async function confirmSaveEdit() {
    if (!editCustomer || !pendingEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${editCustomer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          identification_type: pendingEdit.identification_type,
          identification: pendingEdit.identification,
          legal_name: pendingEdit.legal_name,
          email_primary: pendingEdit.email_primary,
          phone: pendingEdit.phone || undefined,
          address: pendingEdit.address || undefined,
          municipality: pendingEdit.municipality || undefined,
          department: pendingEdit.department || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? 'Error al guardar el cliente');
      }
      toast.success('Cliente actualizado');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar el cliente');
    } finally {
      setSaving(false);
      setPendingEdit(null);
      setEditCustomer(null);
    }
  }

  const canCreate = newForm.identification && newForm.legal_name && newForm.email_primary;
  const canEdit = editForm.identification && editForm.legal_name && editForm.email_primary;

  return (
    <>
      <DataToolbar
        searchLabel="Buscar clientes"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Nombre, identificación, email…"
        activeFilterCount={0}
        onClear={() => setSearch('')}
      >
        <button
          ref={createBtnRef}
          type="button"
          className="ui-button-primary shrink-0"
          data-testid="open-new-customer"
          onClick={() => setCreateOpen(true)}
        >
          Nuevo cliente
        </button>
      </DataToolbar>

      <p className="text-sm ui-muted">{total} cliente{total !== 1 ? 's' : ''}</p>

      {filtered.length === 0 ? (
        <EmptyState
          icon="customers"
          title="Sin clientes"
          description={'Crea tu primer cliente con el botón "Nuevo cliente".'}
          action={
            <button type="button" className="ui-button-primary" onClick={() => setCreateOpen(true)}>
              Nuevo cliente
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--card-border)' }}>
          <table className="min-w-full divide-y text-sm" aria-label="Lista de clientes">
            <thead>
              <tr className="text-left">
                {['Nombre', 'Identificación', 'Email', 'Estado', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide ui-muted whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/app/customers/${c.id}`} className="hover:underline">{c.legal_name}</Link>
                  </td>
                  <td className="px-4 py-3 ui-muted">{ID_TYPES[c.identification_type] ?? c.identification_type}: {c.identification}</td>
                  <td className="px-4 py-3 ui-muted">{c.email_primary}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {c.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" className="ui-button-quiet text-xs" onClick={() => openEdit(c)}>
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
          href={`/app/customers?cursor=${nextCursor}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Siguiente página →
        </Link>
      )}

      {/* Create customer dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="Nuevo cliente" busy={creating}>
        <CustomerForm form={newForm} onChange={v => setNewForm(v as typeof newForm)} idPrefix="new" />
        <div className="ui-dialog-actions mt-6">
          <button type="button" className="ui-button-secondary" disabled={creating} onClick={() => setCreateOpen(false)}>Cancelar</button>
          <button type="button" className="ui-button-primary" disabled={creating || !canCreate} onClick={() => void handleCreate()}>
            {creating ? 'Creando…' : 'Crear cliente'}
          </button>
        </div>
      </Dialog>

      {/* Edit customer dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Editar cliente" busy={saving}>
        <CustomerForm form={editForm} onChange={v => setEditForm(v as typeof editForm)} idPrefix="edit" />
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
        description="¿Confirmas los cambios en este cliente? Los datos anteriores serán reemplazados."
        confirmLabel="Guardar"
        onConfirm={confirmSaveEdit}
      />
    </>
  );
}

interface FormState { [key: string]: string }

function CustomerForm({ form, onChange, idPrefix }: { form: FormState; onChange: (f: FormState) => void; idPrefix: string }) {
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="ui-field-label" htmlFor={`${idPrefix}-type`}>Tipo de persona</label>
          <select id={`${idPrefix}-type`} className="input mt-2" value={form.type} onChange={f('type')}>
            <option value="LEGAL_ENTITY">Persona jurídica</option>
            <option value="NATURAL_PERSON">Persona natural</option>
          </select>
        </div>
        <div>
          <label className="ui-field-label" htmlFor={`${idPrefix}-identification_type`}>Tipo de ID</label>
          <select id={`${idPrefix}-identification_type`} className="input mt-2" value={form.identification_type} onChange={f('identification_type')}>
            <option value="NIT">NIT</option>
            <option value="CC">Cédula de ciudadanía</option>
            <option value="CE">Cédula de extranjería</option>
            <option value="PPN">Pasaporte</option>
          </select>
        </div>
      </div>
      <div>
        <label className="ui-field-label" htmlFor={`${idPrefix}-identification`}>Número de identificación *</label>
        <input id={`${idPrefix}-identification`} className="input mt-2" type="text" required value={form.identification} onChange={f('identification')} />
      </div>
      <div>
        <label className="ui-field-label" htmlFor={`${idPrefix}-legal_name`}>Razón social / Nombre *</label>
        <input id={`${idPrefix}-legal_name`} className="input mt-2" type="text" required value={form.legal_name} onChange={f('legal_name')} />
      </div>
      <div>
        <label className="ui-field-label" htmlFor={`${idPrefix}-email_primary`}>Email principal *</label>
        <input id={`${idPrefix}-email_primary`} className="input mt-2" type="email" required value={form.email_primary} onChange={f('email_primary')} />
      </div>
      <div>
        <label className="ui-field-label" htmlFor={`${idPrefix}-phone`}>Teléfono</label>
        <input id={`${idPrefix}-phone`} className="input mt-2" type="tel" value={form.phone} onChange={f('phone')} />
      </div>
      <div>
        <label className="ui-field-label" htmlFor={`${idPrefix}-address`}>Dirección</label>
        <input id={`${idPrefix}-address`} className="input mt-2" type="text" value={form.address} onChange={f('address')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="ui-field-label" htmlFor={`${idPrefix}-municipality`}>Municipio</label>
          <input id={`${idPrefix}-municipality`} className="input mt-2" type="text" value={form.municipality} onChange={f('municipality')} />
        </div>
        <div>
          <label className="ui-field-label" htmlFor={`${idPrefix}-department`}>Departamento</label>
          <input id={`${idPrefix}-department`} className="input mt-2" type="text" value={form.department} onChange={f('department')} />
        </div>
      </div>
    </div>
  );
}
