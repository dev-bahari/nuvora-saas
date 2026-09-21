import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface Customer {
  id: string;
  legal_name: string;
  identification_type: string;
  identification: string;
  email_primary: string;
  is_active: boolean;
}

interface PagedResponse {
  data: Customer[];
  nextCursor: string | null;
  total: number;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; cursor?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  const { search, cursor } = await searchParams;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (cursor) params.set('cursor', cursor);

  let result: PagedResponse = { data: [], nextCursor: null, total: 0 };
  try {
    const res = await fetch(`${API_URL}/customers?${params}`, {
      headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
      cache: 'no-store',
    });
    if (res.status === 401) redirect('/login');
    if (res.ok) result = await res.json() as PagedResponse;
  } catch {
    // show empty state
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Clientes</h1>
          <Link
            href="/app/customers/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Nuevo cliente
          </Link>
        </div>

        <form method="GET" className="flex gap-2" role="search">
          <label htmlFor="search" className="sr-only">Buscar clientes</label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Nombre, identificación, email…"
            className="flex-1 border rounded px-3 py-2"
            aria-label="Buscar clientes"
          />
          <button type="submit" className="px-4 py-2 border rounded hover:bg-neutral-100">
            Buscar
          </button>
        </form>

        <p className="text-sm text-neutral-500">{result.total} clientes</p>

        {result.data.length === 0 ? (
          <p className="text-neutral-400">Sin resultados.</p>
        ) : (
          <ul className="divide-y border rounded" aria-label="Lista de clientes">
            {result.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between p-4 hover:bg-neutral-50">
                <div>
                  <Link href={`/app/customers/${c.id}`} className="font-medium hover:underline">
                    {c.legal_name}
                  </Link>
                  <p className="text-sm text-neutral-500">
                    {c.identification_type}: {c.identification} · {c.email_primary}
                  </p>
                </div>
                {!c.is_active && (
                  <span className="text-xs bg-neutral-200 px-2 py-1 rounded">Inactivo</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {result.nextCursor && (
          <Link
            href={`/app/customers?${new URLSearchParams({ ...(search ? { search } : {}), cursor: result.nextCursor })}`}
            className="text-blue-600 hover:underline"
          >
            Siguiente página →
          </Link>
        )}
      </div>
    </main>
  );
}
