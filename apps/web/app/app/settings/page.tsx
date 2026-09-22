'use client';

import { useEffect, useState } from 'react';

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

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>({
    legalName: '', nit: '', address: '', city: '', phone: '', email: '',
    taxRegime: 'SIMPLIFICADO', dianEnvironment: 'HABILITACION', dianSoftwareId: '',
  });
  const [dianPin, setDianPin] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/settings`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data: Settings | null) => {
        if (data) setForm({ ...data, dianSoftwareId: data.dianSoftwareId ?? '' });
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (field: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaveState('saving');
    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          address: form.address || null,
          city: form.city || null,
          phone: form.phone || null,
          email: form.email || null,
          dianSoftwareId: form.dianSoftwareId || null,
          dianSoftwarePin: dianPin || null,
        }),
      });
      setSaveState(res.ok ? 'saved' : 'error');
    } catch {
      setSaveState('error');
    }
    setTimeout(() => setSaveState('idle'), 3000);
  }

  if (loading) return <main className="p-8 text-neutral-400">Cargando…</main>;

  return (
    <main className="p-8">
      <div className="max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold">Configuración de empresa</h1>

        <form onSubmit={save} className="space-y-6">
          {/* Company info */}
          <section className="border rounded p-5 space-y-4 bg-white dark:bg-slate-900">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-neutral-500">Datos de la empresa</h2>

            <Field label="Razón social" required>
              <input type="text" value={form.legalName} onChange={set('legalName')} required
                className="input" placeholder="Empresa S.A.S." />
            </Field>

            <Field label="NIT" required>
              <input type="text" value={form.nit} onChange={set('nit')} required
                className="input" placeholder="900123456-7" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Ciudad">
                <input type="text" value={form.city ?? ''} onChange={set('city')}
                  className="input" placeholder="Bogotá" />
              </Field>
              <Field label="Teléfono">
                <input type="text" value={form.phone ?? ''} onChange={set('phone')}
                  className="input" placeholder="+57 300 000 0000" />
              </Field>
            </div>

            <Field label="Dirección">
              <input type="text" value={form.address ?? ''} onChange={set('address')}
                className="input" placeholder="Calle 123 # 45-67" />
            </Field>

            <Field label="Email de contacto">
              <input type="email" value={form.email ?? ''} onChange={set('email')}
                className="input" placeholder="info@empresa.com" />
            </Field>

            <Field label="Régimen tributario">
              <select value={form.taxRegime} onChange={set('taxRegime')} className="input">
                <option value="SIMPLIFICADO">Régimen simplificado</option>
                <option value="COMUN">Régimen común</option>
                <option value="NO_APLICA">No aplica</option>
              </select>
            </Field>
          </section>

          {/* DIAN */}
          <section className="border rounded p-5 space-y-4 bg-white dark:bg-slate-900">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-neutral-500">Configuración DIAN</h2>

            <Field label="Ambiente">
              <select value={form.dianEnvironment} onChange={set('dianEnvironment')} className="input">
                <option value="HABILITACION">Habilitación (pruebas)</option>
                <option value="PRODUCCION">Producción</option>
              </select>
            </Field>

            <Field label="Software ID">
              <input type="text" value={form.dianSoftwareId ?? ''} onChange={set('dianSoftwareId')}
                className="input" placeholder="UUID del software DIAN" />
            </Field>

            <Field label="Software PIN" hint="Solo escribe para actualizar. No se muestra por seguridad.">
              <input type="password" value={dianPin} onChange={(e) => setDianPin(e.target.value)}
                className="input" placeholder="••••••••" autoComplete="new-password" />
            </Field>
          </section>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saveState === 'saving'}
              className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60 text-sm"
            >
              {saveState === 'saving' ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {saveState === 'saved' && <span className="text-green-600 text-sm">✓ Guardado</span>}
            {saveState === 'error' && <span className="text-red-600 text-sm">Error al guardar</span>}
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
    </label>
  );
}
