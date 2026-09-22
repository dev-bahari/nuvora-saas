import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '../../../../components/ui/PageHeader';
import { InvoiceEditor } from './InvoiceEditor';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface Customer { id: string; legal_name: string; identification_type: string; identification: string; }
interface Tax { id: string; code: string; label: string; rate: number; treatment: string; }

export default async function NewInvoicePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  const headers = { Cookie: `${COOKIE_NAME}=${sessionToken}`, 'Content-Type': 'application/json' };

  let customers: Customer[] = [];
  let taxes: Tax[] = [];

  await Promise.all([
    fetch(`${API_URL}/customers?limit=200`, { headers, cache: 'no-store' }).then(async res => {
      if (res.status === 401) redirect('/login');
      if (res.ok) { const body = await res.json() as { data: Customer[] }; customers = body.data ?? []; }
    }).catch(() => {}),

    fetch(`${API_URL}/taxes`, { headers, cache: 'no-store' }).then(async res => {
      if (res.ok) { taxes = await res.json() as Tax[]; }
    }).catch(() => {}),
  ]);

  return (
    <div className="page-content">
      <PageHeader
        title="Nueva factura"
        description="Crea un borrador con líneas, cálculo en vivo y vista previa antes de emitir"
      />
      <InvoiceEditor customers={customers} taxes={taxes} />
    </div>
  );
}
