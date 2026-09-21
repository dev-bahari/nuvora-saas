'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

interface FieldError {
  field: string;
  message: string;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors([]);
    setGlobalError('');
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      type: fd.get('type') as string,
      identification_type: fd.get('identification_type') as string,
      identification: fd.get('identification') as string,
      legal_name: fd.get('legal_name') as string,
      email_primary: fd.get('email_primary') as string,
      phone: fd.get('phone') as string || undefined,
      address: fd.get('address') as string || undefined,
      municipality: fd.get('municipality') as string || undefined,
      department: fd.get('department') as string || undefined,
    };

    try {
      const res = await fetch(`${API_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json() as { id: string };
        router.push(`/app/customers/${data.id}`);
        return;
      }

      if (res.status === 409) {
        setGlobalError('Ya existe un cliente con esa identificación.');
      } else {
        setGlobalError('Error al crear el cliente.');
      }
    } catch {
      setGlobalError('Error de red.');
    } finally {
      setSubmitting(false);
    }
  }

  function fieldError(field: string) {
    return errors.find((e) => e.field === field)?.message;
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Nuevo cliente</h1>

        {globalError && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="type" className="block text-sm font-medium">Tipo de persona</label>
            <select
              id="type"
              name="type"
              className="mt-1 block w-full border rounded px-3 py-2"
              aria-required="true"
            >
              <option value="LEGAL_ENTITY">Persona jurídica</option>
              <option value="NATURAL_PERSON">Persona natural</option>
            </select>
          </div>

          <div>
            <label htmlFor="identification_type" className="block text-sm font-medium">Tipo de identificación</label>
            <select
              id="identification_type"
              name="identification_type"
              className="mt-1 block w-full border rounded px-3 py-2"
              aria-required="true"
            >
              <option value="NIT">NIT</option>
              <option value="CC">Cédula de ciudadanía</option>
              <option value="CE">Cédula de extranjería</option>
              <option value="PPN">Pasaporte</option>
            </select>
          </div>

          <div>
            <label htmlFor="identification" className="block text-sm font-medium">
              Número de identificación <span aria-hidden="true">*</span>
            </label>
            <input
              id="identification"
              name="identification"
              type="text"
              required
              aria-required="true"
              aria-describedby={fieldError('identification') ? 'identification-error' : undefined}
              className="mt-1 block w-full border rounded px-3 py-2"
            />
            {fieldError('identification') && (
              <p id="identification-error" role="alert" className="text-sm text-red-600 mt-1">
                {fieldError('identification')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="legal_name" className="block text-sm font-medium">
              Razón social / Nombre <span aria-hidden="true">*</span>
            </label>
            <input
              id="legal_name"
              name="legal_name"
              type="text"
              required
              aria-required="true"
              className="mt-1 block w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="email_primary" className="block text-sm font-medium">
              Email principal <span aria-hidden="true">*</span>
            </label>
            <input
              id="email_primary"
              name="email_primary"
              type="email"
              required
              aria-required="true"
              className="mt-1 block w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium">Teléfono</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="mt-1 block w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium">Dirección</label>
            <input
              id="address"
              name="address"
              type="text"
              className="mt-1 block w-full border rounded px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="municipality" className="block text-sm font-medium">Municipio</label>
              <input
                id="municipality"
                name="municipality"
                type="text"
                className="mt-1 block w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="department" className="block text-sm font-medium">Departamento</label>
              <input
                id="department"
                name="department"
                type="text"
                className="mt-1 block w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : 'Crear cliente'}
          </button>
        </form>
      </div>
    </main>
  );
}
