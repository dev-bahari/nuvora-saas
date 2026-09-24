'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastProvider';
import { PageHeader } from '@/components/ui/PageHeader';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

interface Settings {
  legalName: string;
  nit: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  taxRegime: 'COMUN' | 'SIMPLIFICADO' | 'NO_APLICA';
  dianEnvironment: 'HABILITACION' | 'PRODUCCION';
  dianSoftwareId: string | null;
}

interface DianStatus { configured: boolean; status: string; fingerprint?: string; expiresAt?: string; testSetId?: string; message?: string | null; invoiceAuthorization?: string; authorizationPrefix?: string; authorizationFrom?: string; authorizationTo?: string; authorizationStartDate?: string; authorizationEndDate?: string }
interface DianProgress { required: { invoices: number; creditNotes: number; debitNotes: number; total: number }; counts: { invoices: number; creditNotes: number; debitNotes: number; accepted: number; rejected: number; pending: number }; documents: Array<{ documentId:string; documentType:string; number:string; status:string; attempts:number; message?:string }> }

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="ui-field-label text-sm font-medium">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <p className="text-xs ui-muted">{hint}</p>}
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <dt className="text-sm ui-muted w-40 shrink-0">{label}</dt>
      <dd className="text-sm font-medium break-all">{value}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>({
    legalName: '', nit: '', address: '', city: '', phone: '', email: '',
    taxRegime: 'SIMPLIFICADO', dianEnvironment: 'HABILITACION', dianSoftwareId: '',
  });
  const [loading, setLoading] = useState(true);

  // Empresa dialog
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [empresaForm, setEmpresaForm] = useState<Settings>(form);
  const empresaFirstRef = useRef<HTMLInputElement>(null);

  // DIAN dialog
  const [dianOpen, setDianOpen] = useState(false);
  const [dianStatus, setDianStatus] = useState<DianStatus>({ configured: false, status: 'UNCONFIGURED' });
  const [dianProgress, setDianProgress] = useState<DianProgress | null>(null);
  const [dianForm, setDianForm] = useState({ softwareId: '', pin: '', password: '', technicalKey: '', testSetId: '', invoiceAuthorization: '', authorizationPrefix: '', authorizationFrom: '', authorizationTo: '', authorizationStartDate: '', authorizationEndDate: '', pfx: null as File | null, chain: null as File | null, environment: 'HABILITACION' as Settings['dianEnvironment'] });
  const [showPin, setShowPin] = useState(false);
  const [confirmDianOpen, setConfirmDianOpen] = useState(false);
  const dianFirstRef = useRef<HTMLSelectElement>(null);

  const toast = useToast();

  useEffect(() => {
    fetch(`${API_URL}/settings`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data: Settings | null) => {
        if (data) setForm({ ...data, dianSoftwareId: data.dianSoftwareId ?? '' });
      })
      .finally(() => setLoading(false));
    fetch(`${API_URL}/settings/dian`, { credentials: 'include' }).then((r) => r.ok ? r.json() : null).then((data: DianStatus | null) => data && setDianStatus(data));
    const loadProgress = () => fetch(`${API_URL}/settings/dian/submissions`, { credentials: 'include' }).then((r) => r.ok ? r.json() : null).then((data: DianProgress | null) => data && setDianProgress(data));
    void loadProgress(); const timer = window.setInterval(() => void loadProgress(), 5000); return () => window.clearInterval(timer);
  }, []);

  function openEmpresa() {
    setEmpresaForm({ ...form });
    setEmpresaOpen(true);
  }

  async function saveEmpresa() {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...empresaForm,
        address: empresaForm.address || null,
        city: empresaForm.city || null,
        phone: empresaForm.phone || null,
        email: empresaForm.email || null,
        dianSoftwareId: form.dianSoftwareId || null,
        dianSoftwarePin: null,
      }),
    });
    if (!res.ok) throw new Error('Error al guardar la información de empresa');
    setForm((prev) => ({ ...prev, ...empresaForm }));
    setEmpresaOpen(false);
    toast.success('Información de empresa actualizada');
  }

  function openDian() {
    setDianForm({ softwareId: form.dianSoftwareId ?? '', pin: '', password: '', technicalKey: '', testSetId: dianStatus.testSetId ?? '', invoiceAuthorization: dianStatus.invoiceAuthorization ?? '', authorizationPrefix: dianStatus.authorizationPrefix ?? '', authorizationFrom: dianStatus.authorizationFrom ?? '', authorizationTo: dianStatus.authorizationTo ?? '', authorizationStartDate: dianStatus.authorizationStartDate ?? '', authorizationEndDate: dianStatus.authorizationEndDate ?? '', pfx: null, chain: null, environment: form.dianEnvironment });
    setShowPin(false);
    setDianOpen(true);
  }

  async function saveDian() {
    if (!dianForm.pfx || !dianForm.chain) throw new Error('Selecciona el PFX y la cadena de certificados');
    const [pfxBase64, caChainBase64] = await Promise.all([fileBase64(dianForm.pfx), fileBase64(dianForm.chain)]);
    const res = await fetch(`${API_URL}/settings/dian/credentials`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pfxBase64, caChainBase64, password: dianForm.password, softwareId: dianForm.softwareId,
        softwarePin: dianForm.pin, technicalKey: dianForm.technicalKey, testSetId: dianForm.testSetId,
        invoiceAuthorization: dianForm.invoiceAuthorization, authorizationPrefix: dianForm.authorizationPrefix,
        authorizationFrom: dianForm.authorizationFrom, authorizationTo: dianForm.authorizationTo,
        authorizationStartDate: dianForm.authorizationStartDate, authorizationEndDate: dianForm.authorizationEndDate,
      }),
    });
    if (!res.ok) throw new Error('Error al guardar la configuración DIAN');
    const status = await res.json() as DianStatus;
    setDianStatus(status);
    setForm((prev) => ({ ...prev, dianEnvironment: dianForm.environment, dianSoftwareId: dianForm.softwareId || null }));
    setDianOpen(false);
    toast.success('Configuración DIAN actualizada');
  }

  const setE = (field: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEmpresaForm((prev) => ({ ...prev, [field]: e.target.value }));

  if (loading) return <main className="page-content text-neutral-400">Cargando…</main>;

  return (
    <main className="page-content">
      <PageHeader title="Configuración" />

      <div className="max-w-2xl space-y-6">
        {/* Empresa card */}
        <section className="border rounded-xl p-5 space-y-3 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wide ui-muted">Empresa</h2>
            <button type="button" className="ui-button-secondary text-sm" onClick={openEmpresa}>
              Editar
            </button>
          </div>
          <dl className="space-y-2">
            <InfoRow label="Razón social" value={form.legalName || '—'} />
            <InfoRow label="NIT" value={form.nit || '—'} />
            <InfoRow label="Email" value={form.email || '—'} />
            <InfoRow label="Dirección" value={[form.address, form.city].filter(Boolean).join(', ') || '—'} />
            <InfoRow label="Teléfono" value={form.phone || '—'} />
            <InfoRow label="Régimen" value={
              form.taxRegime === 'COMUN' ? 'Régimen común' :
              form.taxRegime === 'SIMPLIFICADO' ? 'Régimen simplificado' : 'No aplica'
            } />
          </dl>
        </section>

        <section className="border rounded-xl p-5 space-y-4 bg-white dark:bg-slate-900" aria-labelledby="dian-progress-title">
          <div><h2 id="dian-progress-title" className="font-semibold">Set de pruebas DIAN</h2><p className="text-sm ui-muted">Avance de documentos enviados desde Facturas.</p></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Facturas', dianProgress?.counts.invoices ?? 0, 30], ['Notas crédito', dianProgress?.counts.creditNotes ?? 0, 10], ['Notas débito', dianProgress?.counts.debitNotes ?? 0, 10], ['Aceptados', dianProgress?.counts.accepted ?? 0, 50]].map(([label, value, target]) => <div key={String(label)} className="rounded-lg border p-3"><p className="text-xs ui-muted">{label}</p><p className="mt-1 text-xl font-semibold">{value} <span className="text-sm ui-muted">/ {target}</span></p></div>)}
          </div>
          {dianProgress?.documents.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Documento</th><th>Tipo</th><th>Estado</th><th>Intentos</th><th>Detalle</th></tr></thead><tbody>{dianProgress.documents.map((document) => <tr key={document.documentId} className="border-b"><td className="py-2">{document.number || document.documentId.slice(0, 8)}</td><td>{document.documentType}</td><td>{document.status}</td><td>{document.attempts}</td><td className="max-w-52 truncate">{document.message ?? '—'}</td></tr>)}</tbody></table></div> : <p className="text-sm ui-muted">Aún no hay documentos enviados al set.</p>}
        </section>

        {/* DIAN card */}
        <section className="border rounded-xl p-5 space-y-3 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wide ui-muted">DIAN</h2>
            <button type="button" className="ui-button-secondary text-sm" onClick={openDian}>
              Editar
            </button>
          </div>
          <dl className="space-y-2">
            <InfoRow label="Ambiente" value={form.dianEnvironment === 'PRODUCCION' ? 'Producción' : 'Habilitación (pruebas)'} />
            <InfoRow label="Software ID" value={form.dianSoftwareId ? '••••••••' : '—'} />
            <InfoRow label="Software PIN" value="••••••••" />
            <InfoRow label="Estado del set" value={dianStatus.status} />
            <InfoRow label="Certificado" value={dianStatus.configured ? `${dianStatus.fingerprint?.slice(0, 23)}…` : 'Sin configurar'} />
            {dianStatus.expiresAt && <InfoRow label="Vence" value={new Date(dianStatus.expiresAt).toLocaleDateString('es-CO')} />}
          </dl>
        </section>

        {/* Plan card — read-only */}
        <section className="border rounded-xl p-5 space-y-3 bg-white dark:bg-slate-900">
          <h2 className="font-semibold text-sm uppercase tracking-wide ui-muted">Plan</h2>
          <dl className="space-y-2">
            <InfoRow label="Plan actual" value="Emprendedor" />
            <InfoRow label="Facturas / mes" value="100" />
          </dl>
        </section>
      </div>

      {/* Empresa edit dialog */}
      <Dialog open={empresaOpen} onOpenChange={setEmpresaOpen} title="Editar información de empresa" initialFocusRef={empresaFirstRef}>
        <form onSubmit={(e) => { e.preventDefault(); void saveEmpresa(); }} className="space-y-4">
          <Field label="Razón social" required>
            <input ref={empresaFirstRef} type="text" value={empresaForm.legalName} onChange={setE('legalName')} required className="input" placeholder="Empresa S.A.S." />
          </Field>
          <Field label="NIT" required>
            <input type="text" value={empresaForm.nit} onChange={setE('nit')} required className="input" placeholder="900123456-7" />
          </Field>
          <Field label="Email de contacto">
            <input type="email" value={empresaForm.email ?? ''} onChange={setE('email')} className="input" placeholder="info@empresa.com" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ciudad">
              <input type="text" value={empresaForm.city ?? ''} onChange={setE('city')} className="input" placeholder="Bogotá" />
            </Field>
            <Field label="Teléfono">
              <input type="text" value={empresaForm.phone ?? ''} onChange={setE('phone')} className="input" placeholder="+57 300 000 0000" />
            </Field>
          </div>
          <Field label="Dirección">
            <input type="text" value={empresaForm.address ?? ''} onChange={setE('address')} className="input" placeholder="Calle 123 # 45-67" />
          </Field>
          <Field label="Régimen tributario">
            <select value={empresaForm.taxRegime} onChange={setE('taxRegime')} className="input">
              <option value="SIMPLIFICADO">Régimen simplificado</option>
              <option value="COMUN">Régimen común</option>
              <option value="NO_APLICA">No aplica</option>
            </select>
          </Field>
          <div className="ui-dialog-actions">
            <button type="button" className="ui-button-secondary" onClick={() => setEmpresaOpen(false)}>Cancelar</button>
            <button type="submit" className="ui-button-primary">Guardar</button>
          </div>
        </form>
      </Dialog>

      {/* DIAN edit dialog */}
      <Dialog open={dianOpen} onOpenChange={setDianOpen} title="Editar configuración DIAN"
        description="Los cambios en las credenciales DIAN afectan la emisión fiscal. Revisa antes de guardar."
        initialFocusRef={dianFirstRef}>
        <div className="space-y-4">
          <Field label="Ambiente">
            <select ref={dianFirstRef} value={dianForm.environment}
              onChange={(e) => setDianForm((p) => ({ ...p, environment: e.target.value as Settings['dianEnvironment'] }))}
              className="input">
              <option value="HABILITACION">Habilitación (pruebas)</option>
              <option value="PRODUCCION">Producción</option>
            </select>
          </Field>
          <Field label="Software ID">
            <input type="text" value={dianForm.softwareId}
              onChange={(e) => setDianForm((p) => ({ ...p, softwareId: e.target.value }))}
              className="input" placeholder="UUID del software DIAN" />
          </Field>
          <Field label="Software PIN" hint="Deja vacío para mantener el PIN actual.">
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={dianForm.pin}
                onChange={(e) => setDianForm((p) => ({ ...p, pin: e.target.value }))}
                className="input pr-16"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-label="Software PIN DIAN"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs ui-muted hover:text-current"
                onClick={() => setShowPin((s) => !s)}
                aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
              >
                {showPin ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </Field>
          <Field label="Clave técnica">
            <input type="password" value={dianForm.technicalKey} onChange={(e) => setDianForm((p) => ({ ...p, technicalKey: e.target.value }))} className="input" autoComplete="new-password" required />
          </Field>
          <Field label="TestSetId" required>
            <input type="text" value={dianForm.testSetId} onChange={(e) => setDianForm((p) => ({ ...p, testSetId: e.target.value }))} className="input" required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Resolución" required><input type="text" value={dianForm.invoiceAuthorization} onChange={(e) => setDianForm((p) => ({ ...p, invoiceAuthorization: e.target.value }))} className="input" required /></Field>
            <Field label="Prefijo" required><input type="text" value={dianForm.authorizationPrefix} onChange={(e) => setDianForm((p) => ({ ...p, authorizationPrefix: e.target.value }))} className="input" required /></Field>
            <Field label="Rango desde" required><input type="number" value={dianForm.authorizationFrom} onChange={(e) => setDianForm((p) => ({ ...p, authorizationFrom: e.target.value }))} className="input" required /></Field>
            <Field label="Rango hasta" required><input type="number" value={dianForm.authorizationTo} onChange={(e) => setDianForm((p) => ({ ...p, authorizationTo: e.target.value }))} className="input" required /></Field>
            <Field label="Vigente desde" required><input type="date" value={dianForm.authorizationStartDate} onChange={(e) => setDianForm((p) => ({ ...p, authorizationStartDate: e.target.value }))} className="input" required /></Field>
            <Field label="Vigente hasta" required><input type="date" value={dianForm.authorizationEndDate} onChange={(e) => setDianForm((p) => ({ ...p, authorizationEndDate: e.target.value }))} className="input" required /></Field>
          </div>
          <Field label="Certificado PFX" required hint="Se cifra antes de almacenarse y nunca vuelve a mostrarse.">
            <input type="file" accept=".pfx,.p12" onChange={(e) => setDianForm((p) => ({ ...p, pfx: e.target.files?.[0] ?? null }))} className="input" required />
          </Field>
          <Field label="Contraseña del PFX" required>
            <input type="password" value={dianForm.password} onChange={(e) => setDianForm((p) => ({ ...p, password: e.target.value }))} className="input" autoComplete="new-password" required />
          </Field>
          <Field label="CA intermedia y raíz" required hint="Archivo PEM con ambos certificados.">
            <input type="file" accept=".pem,.cer,.crt" onChange={(e) => setDianForm((p) => ({ ...p, chain: e.target.files?.[0] ?? null }))} className="input" required />
          </Field>
          <div className="ui-dialog-actions">
            <button type="button" className="ui-button-secondary" onClick={() => setDianOpen(false)}>Cancelar</button>
            <button type="button" className="ui-button-primary" onClick={() => setConfirmDianOpen(true)}>Guardar</button>
          </div>
        </div>
      </Dialog>

      {/* DIAN confirm dialog */}
      <ConfirmDialog
        open={confirmDianOpen}
        onOpenChange={setConfirmDianOpen}
        title="Confirmar cambios DIAN"
        description="Estás a punto de actualizar las credenciales fiscales DIAN. Esta acción afecta la emisión de facturas electrónicas. ¿Confirmas?"
        confirmLabel="Confirmar y guardar"
        onConfirm={saveDian}
      />
    </main>
  );
}

async function fileBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
