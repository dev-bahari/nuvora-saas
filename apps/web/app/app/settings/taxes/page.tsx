import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

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
    // show empty state
  }

  return (
    <main className="page-content">
      <PageHeader
        title="Catálogo de impuestos"
        description="Impuestos configurados para Colombia (solo lectura — datos semilla)."
      />

      <div className="max-w-2xl">
        {taxes.length === 0 ? (
          <EmptyState
            title="Sin impuestos"
            description="No hay impuestos configurados para esta empresa."
          />
        ) : (
          <div className="border rounded-xl overflow-hidden bg-white dark:bg-slate-900">
            <table className="w-full border-collapse text-sm" aria-label="Catálogo de impuestos">
              <thead>
                <tr className="border-b bg-neutral-50 dark:bg-slate-800">
                  <th className="px-4 py-3 text-left font-medium ui-muted">Código</th>
                  <th className="px-4 py-3 text-left font-medium ui-muted">Descripción</th>
                  <th className="px-4 py-3 text-right font-medium ui-muted">Tarifa</th>
                  <th className="px-4 py-3 text-left font-medium ui-muted hidden sm:table-cell">Tratamiento</th>
                  <th className="px-4 py-3 text-center font-medium ui-muted hidden sm:table-cell">Activo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {taxes.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono">{t.code}</td>
                    <td className="px-4 py-3">{t.label}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{(parseFloat(t.rate) * 100).toFixed(2)}%</td>
                    <td className="px-4 py-3 ui-muted hidden sm:table-cell">{t.treatment}</td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      {t.is_active ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Activo</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-neutral-100 text-neutral-500 dark:bg-neutral-800">Inactivo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
