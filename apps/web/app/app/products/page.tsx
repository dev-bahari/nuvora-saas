import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ProductsClient, type ProductListItem } from './ProductsClient';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface PagedResponse {
  data: ProductListItem[];
  nextCursor: string | null;
  total: number;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; active?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  const { cursor, active } = await searchParams;
  const params = new URLSearchParams();
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
    <div className="page-content">
      <PageHeader title="Productos y servicios" />
      <ProductsClient
        initialData={result.data}
        total={result.total}
        nextCursor={result.nextCursor}
        activeFilter={active ?? ''}
      />
    </div>
  );
}
