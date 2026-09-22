import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface Customer {
  id: string;
  legal_name: string;
  identification_type: string;
  identification: string;
  dv: string | null;
  type: string;
  email_primary: string;
  phone: string | null;
  address: string | null;
  municipality: string | null;
  department: string | null;
  country: string;
  is_active: boolean;
  created_at: string;
}

const ID_TYPE_LABELS: Record<string, string> = { NIT: 'NIT', CC: 'C.C.', CE: 'C.E.', PPN: 'Pasaporte' };
const PERSON_LABELS: Record<string, string> = { LEGAL_ENTITY: 'Persona jurídica', NATURAL_PERSON: 'Persona natural' };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  const { id } = await params;

  let customer: Customer | null = null;
  try {
    const res = await fetch(`${API_URL}/customers/${id}`, {
      headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
      cache: 'no-store',
    });
    if (res.status === 401) redirect('/login');
    if (res.status === 404) notFound();
    if (res.ok) customer = await res.json() as Customer;
  } catch {
    notFound();
  }
  if (!customer) notFound();

  return (
    <div className="page-content">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/app/customers" className="ui-muted hover:underline text-sm">← Clientes</Link>
        <h1 className="text-2xl font-semibold tracking-tight">{customer.legal_name}</h1>
        {!customer.is_active && (
          <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Inactivo
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-xl border p-6 mt-6" style={{ borderColor: 'var(--card-border)' }}>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide ui-muted">Tipo de persona</dt>
          <dd className="mt-1">{PERSON_LABELS[customer.type] ?? customer.type}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide ui-muted">Identificación</dt>
          <dd className="mt-1">{ID_TYPE_LABELS[customer.identification_type] ?? customer.identification_type}: {customer.identification}{customer.dv ? `-${customer.dv}` : ''}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide ui-muted">Email</dt>
          <dd className="mt-1">{customer.email_primary}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide ui-muted">Teléfono</dt>
          <dd className="mt-1">{customer.phone ?? '—'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide ui-muted">Dirección</dt>
          <dd className="mt-1">
            {[customer.address, customer.municipality, customer.department, customer.country]
              .filter(Boolean)
              .join(', ') || '—'}
          </dd>
        </div>
      </dl>

      <p className="text-sm ui-muted mt-4">Para editar, usa el botón "Editar" en la <Link href="/app/customers" className="text-blue-600 hover:underline">lista de clientes</Link>.</p>
    </div>
  );
}
