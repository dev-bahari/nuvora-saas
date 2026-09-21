import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { z } from 'zod';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';
const CSRF_COOKIE = 'nuvora_csrf';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres'),
});

async function loginAction(formData: FormData): Promise<void> {
  'use server';

  const raw = { email: formData.get('email'), password: formData.get('password') };
  const parsed = loginSchema.safeParse(raw);

  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Datos inválidos')}`);
  }

  let sessionToken: string | undefined;
  let csrfToken: string | undefined;

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      if (res.status === 429) {
        redirect('/login?error=Demasiados+intentos.+Intente+m%C3%A1s+tarde.');
      }
      redirect(`/login?error=${encodeURIComponent(body.message ?? 'Credenciales inválidas')}`);
    }

    // Extract cookies from API response
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
      const match = c.match(/^nuvora_session=([^;]+)/);
      const csrfMatch = c.match(/^nuvora_csrf=([^;]+)/);
      if (match) sessionToken = decodeURIComponent(match[1] ?? '');
      if (csrfMatch) csrfToken = decodeURIComponent(csrfMatch[1] ?? '');
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    redirect('/login?error=Error+de+conexi%C3%B3n.+Intente+m%C3%A1s+tarde.');
  }

  if (!sessionToken) {
    redirect('/login?error=Error+al+iniciar+sesi%C3%B3n.+Intente+de+nuevo.');
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  if (csrfToken) {
    cookieStore.set(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env['NODE_ENV'] === 'production',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
  }

  redirect('/app/dashboard');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-sm space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 p-2 flex items-center justify-center shadow-md mb-3">
            <Image
              src="/icono-blanco.png"
              alt="Logo Empyra"
              width={36}
              height={36}
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900">Empyra</h1>
          <p className="text-sm text-slate-500 mt-1">Inicia sesión en tu cuenta</p>
        </div>

        {params?.error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
            {params.error}
          </div>
        )}

        <form action={loginAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-required="true"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-leaf-500"
              placeholder="tu@empresa.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-required="true"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-leaf-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-leaf-600 hover:bg-leaf-500 text-white font-bold rounded-xl py-3 text-sm shadow-md shadow-leaf-600/20 transition-all cursor-pointer"
          >
            Iniciar sesión
          </button>

          <p className="text-center text-sm text-slate-600">
            ¿No tienes cuenta?{' '}
            <a href="/onboarding" className="text-leaf-700 font-bold hover:underline">
              Crear cuenta gratis
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
