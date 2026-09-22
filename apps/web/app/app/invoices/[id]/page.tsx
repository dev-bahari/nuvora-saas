import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { InvoiceEditor } from '../../../../components/invoice-editor/InvoiceEditor';
import type { DraftDocument } from '@nuvora/contracts';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

export default async function InvoiceDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  const { id } = await params;

  let doc: DraftDocument | null = null;
  try {
    const res = await fetch(`${API_URL}/invoices/${id}`, {
      headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
      cache: 'no-store',
    });
    if (res.status === 401) redirect('/login');
    if (res.status === 404) notFound();
    if (res.ok) doc = await res.json() as DraftDocument;
  } catch {
    notFound();
  }

  if (!doc) notFound();

  return <InvoiceEditor initialDoc={doc} />;
}
