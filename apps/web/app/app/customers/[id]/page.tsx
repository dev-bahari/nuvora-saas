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

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  const { id } = await params;

  let customer: Customer | null = null;
  const res = await fetch(`${API_URL}/customers/${id}`, {
    headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 404) notFound();
  if (res.ok) customer = await res.json() as Customer;
  if (!customer) notFound();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/app/customers" className="text-neutral-500 hover:text-neutral-700">← Clientes</Link>
          <h1 className="text-2xl font-bold">{customer.legal_name}</h1>
          {!customer.is_active && (
            <span className="text-xs bg-neutral-200 px-2 py-1 rounded">Inactivo</span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-neutral-500">Tipo</dt>
            <dd>{customer.type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Identificación</dt>
            <dd>{customer.identification_type}: {customer.identification}{customer.dv ? `-${customer.dv}` : ''}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Email</dt>
            <dd>{customer.email_primary}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Teléfono</dt>
            <dd>{customer.phone ?? '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-sm font-medium text-neutral-500">Dirección</dt>
            <dd>
              {[customer.address, customer.municipality, customer.department, customer.country]
                .filter(Boolean)
                .join(', ') || '—'}
            </dd>
          </div>
        </dl>

        <Link
          href={`/app/customers/${id}/edit`}
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Editar
        </Link>
      </div>
    </main>
  );
}
