import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '../../components/app-shell/AppShell';
import { ToastProvider } from '../../components/ui/ToastProvider';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) redirect('/login');

  let tenantName = '';
  let fullName = '';
  try {
    const res = await fetch(`${API_URL}/auth/session`, {
      headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
      cache: 'no-store',
    });
    if (!res.ok) redirect('/login');
    const s = await res.json() as { tenantName: string; fullName: string };
    tenantName = s.tenantName;
    fullName = s.fullName;
  } catch {
    redirect('/login');
  }

  return (
    <ToastProvider><AppShell tenantName={tenantName} fullName={fullName}>{children}</AppShell></ToastProvider>
  );
}
