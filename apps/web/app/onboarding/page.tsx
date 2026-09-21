'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const COOKIE_NAME = 'nuvora_session';
const CSRF_COOKIE = 'nuvora_csrf';

const onboardingSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
  fullName: z.string().min(2, 'Nombre completo requerido'),
  tenantName: z.string().min(2, 'Nombre de empresa requerido'),
});

interface ActionState {
  error?: string;
}

async function onboardingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  'use server';

  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
    tenantName: formData.get('tenantName'),
  };

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };
  }

  let sessionToken: string | undefined;
  let csrfToken: string | undefined;

  try {
    const res = await fetch(`${API_URL}/auth/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      if (res.status === 409) return { error: 'El correo ya está registrado.' };
      return { error: body.message ?? 'Error al crear la cuenta.' };
    }

    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
      const match = c.match(/^nuvora_session=([^;]+)/);
      const csrfMatch = c.match(/^nuvora_csrf=([^;]+)/);
      if (match) sessionToken = decodeURIComponent(match[1] ?? '');
      if (csrfMatch) csrfToken = decodeURIComponent(csrfMatch[1] ?? '');
    }
  } catch {
    return { error: 'Error de conexión. Intente más tarde.' };
  }

  if (!sessionToken) {
    return { error: 'Error al iniciar sesión automáticamente. Por favor inicia sesión manualmente.' };
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

export default function OnboardingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Nuvora</h1>
          <p className="text-sm text-neutral-500 mt-1">Crea tu cuenta y empresa</p>
        </div>

        <form action={onboardingAction} className="space-y-4">
          <div>
            <label htmlFor="tenantName" className="block text-sm font-medium mb-1">
              Nombre de la empresa
            </label>
            <input
              id="tenantName"
              name="tenantName"
              type="text"
              required
              aria-required="true"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Mi Empresa SAS"
            />
          </div>

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium mb-1">
              Nombre completo
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              aria-required="true"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Juan Pérez"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-required="true"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="tu@empresa.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              aria-required="true"
              minLength={8}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded px-3 py-2 text-sm font-medium hover:bg-blue-700"
          >
            Crear cuenta
          </button>

          <p className="text-center text-sm">
            ¿Ya tienes cuenta?{' '}
            <a href="/login" className="text-blue-600 hover:underline">
              Inicia sesión
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
