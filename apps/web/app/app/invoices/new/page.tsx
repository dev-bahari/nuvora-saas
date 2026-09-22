import { redirect } from 'next/navigation';

// Creation happens via the dialog in the invoices list page.
// Redirect any direct navigation to /app/invoices so the user lands with
// the full list context where the "Nueva factura" dialog can be opened.
export default function NewInvoicePage() {
  redirect('/app/invoices');
}
