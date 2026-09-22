import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

const NAV = [
  { href: '/app/dashboard', label: 'Dashboard' },
  { href: '/app/invoices', label: 'Facturas' },
  { href: '/app/customers', label: 'Clientes' },
  { href: '/app/products', label: 'Productos' },
  { href: '/app/settings', label: 'Configuración' },
];

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
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r bg-white dark:bg-slate-900 flex flex-col">
        <div className="p-4 border-b">
          <p className="font-semibold text-sm truncate">{tenantName}</p>
          <p className="text-xs text-neutral-500 truncate">{fullName}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-3 py-2 rounded text-sm hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t">
          <form action="/api/logout" method="POST">
            <button
              type="submit"
              className="w-full text-left px-3 py-2 rounded text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
