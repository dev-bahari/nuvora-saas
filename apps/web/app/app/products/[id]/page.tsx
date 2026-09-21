import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface Product {
  id: string;
  internal_code: string;
  standard_code: string | null;
  name: string;
  description: string | null;
  type: string;
  unit_of_measure: string;
  base_price: string;
  tax_treatment: string;
  is_active: boolean;
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  const { id } = await params;

  const res = await fetch(`${API_URL}/products/${id}`, {
    headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 404) notFound();
  if (!res.ok) notFound();

  const product = await res.json() as Product;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/app/products" className="text-neutral-500 hover:text-neutral-700">← Productos</Link>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          {!product.is_active && (
            <span className="text-xs bg-neutral-200 px-2 py-1 rounded">Inactivo</span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-neutral-500">Código interno</dt>
            <dd>{product.internal_code}</dd>
          </div>
          {product.standard_code && (
            <div>
              <dt className="text-sm font-medium text-neutral-500">Código estándar</dt>
              <dd>{product.standard_code}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm font-medium text-neutral-500">Tipo</dt>
            <dd>{product.type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Unidad</dt>
            <dd>{product.unit_of_measure}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Precio base</dt>
            <dd>${product.base_price}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Tratamiento fiscal</dt>
            <dd>{product.tax_treatment}</dd>
          </div>
          {product.description && (
            <div className="col-span-2">
              <dt className="text-sm font-medium text-neutral-500">Descripción</dt>
              <dd>{product.description}</dd>
            </div>
          )}
        </dl>

        <Link
          href={`/app/products/${id}/edit`}
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Editar
        </Link>
      </div>
    </main>
  );
}
