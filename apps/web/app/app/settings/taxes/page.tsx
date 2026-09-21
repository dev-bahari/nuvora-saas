import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface Tax {
  id: string;
  code: string;
  tax_type: string;
  rate: string;
  treatment: string;
  label: string;
  is_active: boolean;
}

export default async function TaxSettingsPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  let taxes: Tax[] = [];
  try {
    const res = await fetch(`${API_URL}/taxes`, {
      headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
      cache: 'no-store',
    });
    if (res.status === 401) redirect('/login');
    if (res.ok) taxes = await res.json() as Tax[];
  } catch {
    // show empty
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Catálogo de impuestos</h1>
        <p className="text-sm text-neutral-500">
          Impuestos configurados para su empresa (solo lectura).
        </p>

        {taxes.length === 0 ? (
          <p className="text-neutral-400">Sin impuestos configurados.</p>
        ) : (
          <table className="w-full border-collapse" aria-label="Catálogo de impuestos">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 text-sm font-medium text-neutral-500">Código</th>
                <th className="pb-2 text-sm font-medium text-neutral-500">Descripción</th>
                <th className="pb-2 text-sm font-medium text-neutral-500">Tarifa</th>
                <th className="pb-2 text-sm font-medium text-neutral-500">Tratamiento</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {taxes.map((t) => (
                <tr key={t.id} className="hover:bg-neutral-50">
                  <td className="py-3 font-mono text-sm">{t.code}</td>
                  <td className="py-3">{t.label}</td>
                  <td className="py-3 text-sm">{(parseFloat(t.rate) * 100).toFixed(2)}%</td>
                  <td className="py-3 text-sm">{t.treatment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
