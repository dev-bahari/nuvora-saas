import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface DraftListItem {
  id: string;
  documentType: string;
  status: string;
  customerName: string;
  currency: string;
  grandTotal: string;
  issueDate: string;
  createdAt: string;
}

interface PagedResult {
  data: DraftListItem[];
  cursor: string | null;
  total: number;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  READY: 'Listo',
  PROCESSING: 'Procesando',
  DIAN_PENDING: 'Pendiente DIAN',
  DIAN_ACCEPTED: 'Aceptado DIAN',
  ISSUED: 'Emitido',
  REJECTED: 'Rechazado',
  CANCELLED_BY_CREDIT_NOTE: 'Anulado',
};

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
  try {
    const res = await fetch(`${API_URL}/invoices?${params}`, {
      headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
      cache: 'no-store',
    });
    if (res.status === 401) redirect('/login');
    if (res.ok) result = await res.json() as PagedResult;
  } catch {
    // show empty state
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Facturas</h1>
          <Link
            href="/app/invoices/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Nueva factura
          </Link>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['', 'DRAFT', 'ISSUED', 'REJECTED'].map((s) => (
            <Link
              key={s || 'all'}
              href={s ? `/app/invoices?status=${s}` : '/app/invoices'}
              className={`px-3 py-1 rounded border text-sm ${
                (status ?? '') === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'hover:bg-neutral-100'
              }`}
            >
              {s ? (STATUS_LABELS[s] ?? s) : 'Todos'}
            </Link>
          ))}
        </div>

        <p className="text-sm text-neutral-500">{result.total} documentos</p>

        {result.data.length === 0 ? (
          <p className="text-neutral-400">Sin resultados.</p>
        ) : (
          <ul className="divide-y border rounded" aria-label="Lista de facturas">
            {result.data.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between p-4 hover:bg-neutral-50">
                <div>
                  <Link href={`/app/invoices/${doc.id}`} className="font-medium hover:underline">
                    {doc.status === 'DRAFT' ? '(Borrador)' : `#${doc.id.slice(0, 8)}`}
                  </Link>
                  <p className="text-sm text-neutral-500">
                    {doc.customerName} · {doc.issueDate}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {doc.currency} {doc.grandTotal}
                  </p>
                  <span className="text-xs bg-neutral-200 px-2 py-1 rounded">
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {result.cursor && (
          <Link
            href={`/app/invoices?${new URLSearchParams({ ...(status ? { status } : {}), cursor: result.cursor })}`}
            className="text-blue-600 hover:underline"
          >
            Siguiente página →
          </Link>
        )}
      </div>
    </main>
  );
}
