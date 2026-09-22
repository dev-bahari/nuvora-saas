import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface DashboardMetrics {
  invoicesThisMonth: number;
  revenueThisMonth: string;
  pendingDian: number;
  rejectedThisMonth: number;
  recentDocuments: Array<{
    id: string;
    documentType: string;
    status: string;
    customerName: string;
    grandTotal: string;
    currency: string;
    issueDate: string;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  ISSUED: 'Emitido',
  REJECTED: 'Rechazado',
  PROCESSING: 'Procesando',
  CANCELLED_BY_CREDIT_NOTE: 'Anulado',
  CREDIT_NOTE: 'Nota crédito',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-neutral-100 text-neutral-600',
  ISSUED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  CANCELLED_BY_CREDIT_NOTE: 'bg-neutral-200 text-neutral-500',
};

function fmt(amount: string): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
    parseFloat(amount),
  );
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  let metrics: DashboardMetrics = {
    invoicesThisMonth: 0,
    revenueThisMonth: '0',
    pendingDian: 0,
    rejectedThisMonth: 0,
    recentDocuments: [],
  };

  try {
    const res = await fetch(`${API_URL}/metrics`, {
      headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
      cache: 'no-store',
    });
    if (res.status === 401) redirect('/login');
    if (res.ok) metrics = await res.json() as DashboardMetrics;
  } catch {
    // show defaults
  }

  const kpis = [
    {
      label: 'Facturas emitidas (mes)',
      value: metrics.invoicesThisMonth.toString(),
      sub: 'documentos',
      color: 'border-l-blue-500',
    },
    {
      label: 'Ingresos del mes',
      value: fmt(metrics.revenueThisMonth),
      sub: 'COP',
      color: 'border-l-green-500',
    },
    {
      label: 'Pendiente DIAN',
      value: metrics.pendingDian.toString(),
      sub: metrics.pendingDian === 1 ? 'documento' : 'documentos',
      color: metrics.pendingDian > 0 ? 'border-l-yellow-500' : 'border-l-neutral-200',
    },
    {
      label: 'Rechazadas (mes)',
      value: metrics.rejectedThisMonth.toString(),
      sub: 'documentos',
      color: metrics.rejectedThisMonth > 0 ? 'border-l-red-500' : 'border-l-neutral-200',
    },
  ];

  return (
    <main className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/app/invoices/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Nueva factura
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`bg-white dark:bg-slate-900 border rounded p-5 border-l-4 ${kpi.color}`}>
            <p className="text-xs text-neutral-500 uppercase tracking-wide">{kpi.label}</p>
            <p className="mt-2 text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs text-neutral-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Documentos recientes</h2>
          <Link href="/app/invoices" className="text-sm text-blue-600 hover:underline">
            Ver todos →
          </Link>
        </div>

        {metrics.recentDocuments.length === 0 ? (
          <div className="border rounded p-8 text-center text-neutral-400">
            <p>Aún no hay documentos.</p>
            <Link href="/app/invoices/new" className="mt-2 inline-block text-blue-600 hover:underline text-sm">
              Crear primera factura
            </Link>
          </div>
        ) : (
          <ul className="divide-y border rounded bg-white dark:bg-slate-900">
            {metrics.recentDocuments.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-slate-800">
                <div>
                  <Link href={`/app/invoices/${doc.id}`} className="font-medium hover:underline text-sm">
                    {doc.customerName || '—'}
                  </Link>
                  <p className="text-xs text-neutral-400">{doc.issueDate} · {STATUS_LABELS[doc.documentType] ?? doc.documentType}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">{doc.currency} {doc.grandTotal}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[doc.status] ?? 'bg-neutral-100'}`}>
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
