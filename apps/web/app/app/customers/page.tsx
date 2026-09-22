import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '../../../components/ui/PageHeader';
import { CustomersClient, type CustomerListItem } from './CustomersClient';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface PagedResponse {
  data: CustomerListItem[];
  nextCursor: string | null;
  total: number;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  const { cursor } = await searchParams;
  const params = new URLSearchParams();
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
    <div className="page-content">
      <PageHeader title="Clientes" />
      <CustomersClient
        initialData={result.data}
        total={result.total}
        nextCursor={result.nextCursor}
      />
    </div>
  );
}
