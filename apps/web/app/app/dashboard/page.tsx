import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '../../../components/ui/PageHeader';
import { MetricCard } from '../../../components/dashboard/MetricCard';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface DashboardMetrics {
  invoicesThisMonth: number;
  revenueThisMonth: string;
  pendingDian: number;
  rejectedThisMonth: number;
  ivaTotalThisMonth?: string;
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
  DIAN_ACCEPTED: 'Aceptado DIAN',
  DIAN_PENDING: 'Pendiente DIAN',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  ISSUED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DIAN_ACCEPTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PROCESSING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DIAN_PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CANCELLED_BY_CREDIT_NOTE: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

function fmt(amount: string): string {
  const n = parseFloat(amount);
  if (isNaN(n)) return '$ 0';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(raw: string): string {
  if (!raw) return '—';
  try { return new Date(raw).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return raw; }
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
    ivaTotalThisMonth: '0',
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

  const hasPending = metrics.pendingDian > 0;
  const hasRejected = metrics.rejectedThisMonth > 0;

  return (
    <div className="page-content">
      <PageHeader
        title="Dashboard"
        description="Resumen de actividad fiscal del mes."
        action={
          <Link href="/app/invoices/new" className="ui-button-primary" data-testid="new-invoice-btn">
            Nueva factura
          </Link>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Facturas emitidas"
          value={metrics.invoicesThisMonth.toString()}
          sub="este mes"
          accent="blue"
        />
        <MetricCard
          label="Pendiente / Rechazadas"
          value={`${metrics.pendingDian} / ${metrics.rejectedThisMonth}`}
          sub={hasPending || hasRejected ? 'requieren atención' : 'todo al día'}
          accent={hasPending || hasRejected ? 'amber' : 'neutral'}
        />
        <MetricCard
          label="Total facturado"
          value={fmt(metrics.revenueThisMonth)}
          sub="COP · este mes"
          accent="green"
        />
        <MetricCard
          label="IVA generado"
          value={fmt(metrics.ivaTotalThisMonth ?? '0')}
          sub="COP · este mes"
          accent="neutral"
        />
      </div>

      {/* Recent documents */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Documentos recientes</h2>
          <Link href="/app/invoices" className="text-sm text-blue-600 hover:underline">
            Ver todos →
          </Link>
        </div>

        {metrics.recentDocuments.length === 0 ? (
          <div className="ui-empty-state py-10">
            <p className="text-base font-semibold">Aún no hay documentos</p>
            <p className="ui-muted mt-2 text-sm">Crea tu primera factura para ver la actividad aquí.</p>
            <div className="mt-6">
              <Link href="/app/invoices/new" className="ui-button-primary">
                Nueva factura
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--card-border)' }}>
            <table className="min-w-full divide-y text-sm" style={{ borderColor: 'var(--card-border)' }}>
              <thead>
                <tr className="text-left">
                  {['Cliente', 'Número', 'Fecha', 'Total', 'Estado'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide ui-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                {metrics.recentDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/app/invoices/${doc.id}`} className="hover:underline">
                        {doc.customerName || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 ui-muted font-mono text-xs">#{doc.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 ui-muted">{fmtDate(doc.issueDate)}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{doc.currency} {doc.grandTotal}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[doc.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[doc.status] ?? doc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
