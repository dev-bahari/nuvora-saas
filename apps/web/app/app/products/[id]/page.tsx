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

const TAX_LABELS: Record<string, string> = { TAXED: 'Gravado', EXEMPT: 'Exento', EXCLUDED: 'Excluido', NON_TAXED: 'No gravado' };

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  const { id } = await params;

  let product: Product | null = null;
  try {
    const res = await fetch(`${API_URL}/products/${id}`, {
      headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
      cache: 'no-store',
    });
    if (res.status === 401) redirect('/login');
    if (res.status === 404) notFound();
    if (res.ok) product = await res.json() as Product;
  } catch {
    notFound();
  }
  if (!product) notFound();

  return (
    <div className="page-content">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/app/products" className="ui-muted hover:underline text-sm">← Productos</Link>
        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
        {!product.is_active && (
          <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Inactivo
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-xl border p-6 mt-6" style={{ borderColor: 'var(--card-border)' }}>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide ui-muted">Código interno</dt>
          <dd className="mt-1 font-mono text-sm">{product.internal_code}</dd>
        </div>
        {product.standard_code && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide ui-muted">Código estándar</dt>
            <dd className="mt-1 font-mono text-sm">{product.standard_code}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide ui-muted">Tipo</dt>
          <dd className="mt-1">{product.type === 'SERVICE' ? 'Servicio' : 'Producto'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide ui-muted">Unidad</dt>
          <dd className="mt-1">{product.unit_of_measure}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide ui-muted">Precio base</dt>
          <dd className="mt-1 tabular-nums">${product.base_price}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide ui-muted">Tratamiento fiscal</dt>
          <dd className="mt-1">{TAX_LABELS[product.tax_treatment] ?? product.tax_treatment}</dd>
        </div>
        {product.description && (
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide ui-muted">Descripción</dt>
            <dd className="mt-1">{product.description}</dd>
          </div>
        )}
      </dl>

      <p className="text-sm ui-muted mt-4">Para editar, usa el botón "Editar" en la <Link href="/app/products" className="text-blue-600 hover:underline">lista de productos</Link>.</p>
    </div>
  );
}
