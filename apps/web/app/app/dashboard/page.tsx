import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';

interface SessionResponse {
  tenantName: string;
  fullName: string;
  email: string;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect('/login');
  }

  let session: SessionResponse | null = null;
  try {
    const res = await fetch(`${API_URL}/auth/session`, {
      headers: { Cookie: `${COOKIE_NAME}=${sessionToken}` },
      cache: 'no-store',
    });
    if (!res.ok) redirect('/login');
    session = await res.json() as SessionResponse;
  } catch {
    redirect('/login');
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">{session?.tenantName}</h1>
        <p className="text-neutral-600">Dashboard (próximamente)</p>
        <p className="text-sm text-neutral-400">Bienvenido, {session?.fullName}</p>
      </div>
    </main>
  );
}
