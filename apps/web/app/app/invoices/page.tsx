import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '../../../components/ui/PageHeader';
import { InvoicesClient, type InvoiceListItem } from './InvoicesClient';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface PagedResult {
  data: InvoiceListItem[];
  cursor: string | null;
  total: number;
}

interface Customer {
  id: string;
  legal_name: string;
  identification_type: string;
  identification: string;
}

interface CustomersResponse {
  data: Customer[];
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; status?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  const { cursor, status } = await searchParams;
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (status) params.set('status', status);

  let result: PagedResult = { data: [], cursor: null, total: 0 };
  let customers: Customer[] = [];

  await Promise.all([
    fetch(`${API_URL}/invoices?${params}`, {
      headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
      cache: 'no-store',
    }).then(async res => {
      if (res.status === 401) redirect('/login');
      if (res.ok) result = await res.json() as PagedResult;
    }).catch(() => {}),

    fetch(`${API_URL}/customers?limit=100`, {
      headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
      cache: 'no-store',
    }).then(async res => {
      if (res.ok) {
        const body = await res.json() as CustomersResponse;
        customers = body.data ?? [];
      }
    }).catch(() => {}),
  ]);

  return (
    <div className="page-content">
      <PageHeader
        title="Facturas"
        description={`${result.total} documento${result.total !== 1 ? 's' : ''}`}
      />
      <InvoicesClient
        initialData={result.data}
        total={result.total}
        nextCursor={result.cursor}
        activeStatus={status ?? ''}
        customers={customers}
      />
    </div>
  );
}
