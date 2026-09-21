'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function NewProductPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGlobalError('');
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      internal_code: fd.get('internal_code') as string,
      name: fd.get('name') as string,
      type: fd.get('type') as string,
      unit_of_measure: fd.get('unit_of_measure') as string,
      base_price: fd.get('base_price') as string,
      tax_treatment: fd.get('tax_treatment') as string,
      description: fd.get('description') as string || undefined,
      standard_code: fd.get('standard_code') as string || undefined,
    };

    try {
      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json() as { id: string };
        router.push(`/app/products/${data.id}`);
        return;
      }

      if (res.status === 409) {
        setGlobalError('Ya existe un producto con ese código interno.');
      } else {
        setGlobalError('Error al crear el producto.');
      }
    } catch {
      setGlobalError('Error de red.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Nuevo producto</h1>

        {globalError && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="internal_code" className="block text-sm font-medium">
              Código interno <span aria-hidden="true">*</span>
            </label>
            <input
              id="internal_code"
              name="internal_code"
              type="text"
              required
              aria-required="true"
              className="mt-1 block w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Nombre <span aria-hidden="true">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              aria-required="true"
              className="mt-1 block w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium">Tipo</label>
            <select id="type" name="type" className="mt-1 block w-full border rounded px-3 py-2">
              <option value="PRODUCT">Producto</option>
              <option value="SERVICE">Servicio</option>
            </select>
          </div>

          <div>
            <label htmlFor="unit_of_measure" className="block text-sm font-medium">Unidad</label>
            <input
              id="unit_of_measure"
              name="unit_of_measure"
              type="text"
              defaultValue="UNIT"
              className="mt-1 block w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="base_price" className="block text-sm font-medium">
              Precio base <span aria-hidden="true">*</span>
            </label>
            <input
              id="base_price"
              name="base_price"
              type="text"
              pattern="^\d+(\.\d{1,6})?$"
              required
              aria-required="true"
              placeholder="0.000000"
              className="mt-1 block w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="tax_treatment" className="block text-sm font-medium">Tratamiento fiscal</label>
            <select id="tax_treatment" name="tax_treatment" className="mt-1 block w-full border rounded px-3 py-2">
              <option value="TAXED">Gravado</option>
              <option value="EXEMPT">Exento</option>
              <option value="EXCLUDED">Excluido</option>
              <option value="NON_TAXED">No gravado</option>
            </select>
          </div>

          <div>
            <label htmlFor="standard_code" className="block text-sm font-medium">Código estándar</label>
            <input
              id="standard_code"
              name="standard_code"
              type="text"
              className="mt-1 block w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium">Descripción</label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="mt-1 block w-full border rounded px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : 'Crear producto'}
          </button>
        </form>
      </div>
    </main>
  );
}
