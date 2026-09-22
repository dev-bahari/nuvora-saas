'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface Customer {
  id: string;
  legal_name: string;
  identification_type: string;
  identification: string;
}

interface CustomersResponse {
  data: Customer[];
}

async function createDraft(formData: FormData) {
  'use server';
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  const customerId = formData.get('customerId') as string;
  const description = formData.get('description') as string;
  const quantity = formData.get('quantity') as string;
  const unitPrice = formData.get('unitPrice') as string;
  const taxTreatment = (formData.get('taxTreatment') as string) || 'TAXED';
  const taxRate = parseFloat((formData.get('taxRate') as string) || '19');

  const res = await fetch(`${API_URL}/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${COOKIE_NAME}=${sessionToken}`,
    },
    body: JSON.stringify({
      customerId,
      lines: [{ description, quantity, unitPrice, taxTreatment, taxRate, discountPct: 0 }],
    }),
  });

  if (res.status === 401) redirect('/login');

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Error al crear el borrador');
  }

  const draft = await res.json() as { id: string };
  redirect(`/app/invoices/${draft.id}`);
}

export default async function NewInvoicePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  let customers: Customer[] = [];
  try {
    const res = await fetch(`${API_URL}/customers?limit=100`, {
      headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
      cache: 'no-store',
    });
    if (res.status === 401) redirect('/login');
    if (res.ok) {
      const body = await res.json() as CustomersResponse;
      customers = body.data ?? [];
    }
  } catch {
    // show empty select
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Nueva factura</h1>

        <form action={createDraft} className="space-y-4">
          <div>
            <label htmlFor="customerId" className="block text-sm font-medium mb-1">
              Cliente
            </label>
            <select
              id="customerId"
              name="customerId"
              required
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Seleccionar cliente…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legal_name} — {c.identification_type}: {c.identification}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="border rounded p-4 space-y-3">
            <legend className="text-sm font-medium px-1">Primera línea</legend>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Descripción
              </label>
              <input
                id="description"
                name="description"
                type="text"
                required
                placeholder="Servicio o producto"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium mb-1">
                  Cantidad
                </label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="0.000001"
                  step="any"
                  required
                  defaultValue="1"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="unitPrice" className="block text-sm font-medium mb-1">
                  Precio unitario (COP)
                </label>
                <input
                  id="unitPrice"
                  name="unitPrice"
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="0.00"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="taxTreatment" className="block text-sm font-medium mb-1">
                  Tratamiento IVA
                </label>
                <select id="taxTreatment" name="taxTreatment" className="w-full border rounded px-3 py-2">
                  <option value="TAXED">Gravado</option>
                  <option value="EXEMPT">Exento</option>
                  <option value="EXCLUDED">Excluido</option>
                  <option value="NON_TAXED">No gravado</option>
                </select>
              </div>
              <div>
                <label htmlFor="taxRate" className="block text-sm font-medium mb-1">
                  Tasa IVA (%)
                </label>
                <input
                  id="taxRate"
                  name="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  defaultValue="19"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </fieldset>

          <p className="text-sm text-neutral-500">
            Puedes agregar más líneas en el editor después de guardar.
          </p>

          <div className="flex gap-3">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Crear borrador
            </button>
            <a href="/app/invoices" className="px-6 py-2 border rounded hover:bg-neutral-100">
              Cancelar
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
