import { redirect } from 'next/navigation';

// Create/edit moved to dialog on list page.
export default function NewCustomerPage() {
  redirect('/app/customers');
}
