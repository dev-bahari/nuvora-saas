import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface Product {
  id: string;
  internal_code: string;
  name: string;
  type: string;
  base_price: string;
  tax_treatment: string;
  is_active: boolean;
}

interface PagedResponse {
  data: Product[];
  nextCursor: string | null;
  total: number;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; cursor?: string; active?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  const { search, cursor, active } = await searchParams;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (cursor) params.set('cursor', cursor);
  if (active) params.set('active', active);

  let result: PagedResponse = { data: [], nextCursor: null, total: 0 };
  try {
    const res = await fetch(`${API_URL}/products?${params}`, {
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
          <h1 className="text-2xl font-bold">Productos y servicios</h1>
          <Link
            href="/app/products/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Nuevo producto
          </Link>
        </div>

        <form method="GET" className="flex gap-2" role="search">
          <label htmlFor="search-products" className="sr-only">Buscar productos</label>
          <input
            id="search-products"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Nombre, código…"
            className="flex-1 border rounded px-3 py-2"
          />
          <button type="submit" className="px-4 py-2 border rounded hover:bg-neutral-100">
            Buscar
          </button>
        </form>

        <p className="text-sm text-neutral-500">{result.total} productos</p>

        {result.data.length === 0 ? (
          <p className="text-neutral-400">Sin resultados.</p>
        ) : (
          <ul className="divide-y border rounded" aria-label="Lista de productos">
            {result.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-4 hover:bg-neutral-50">
                <div>
                  <Link href={`/app/products/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-sm text-neutral-500">
                    {p.internal_code} · {p.type} · ${p.base_price}
                  </p>
                </div>
                {!p.is_active && (
                  <span className="text-xs bg-neutral-200 px-2 py-1 rounded">Inactivo</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {result.nextCursor && (
          <Link
            href={`/app/products?${new URLSearchParams({ ...(search ? { search } : {}), cursor: result.nextCursor })}`}
            className="text-blue-600 hover:underline"
          >
            Siguiente página →
          </Link>
        )}
      </div>
    </main>
  );
}
