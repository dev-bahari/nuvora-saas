import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export async function POST(request: NextRequest) {
  const session = request.cookies.get('nuvora_session')?.value;
  const csrf = request.cookies.get('nuvora_csrf')?.value;
  if (session) {
    try {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Cookie: `nuvora_session=${encodeURIComponent(session)}`, 'x-csrf-token': csrf ?? '' },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return NextResponse.json({ message: 'No pudimos cerrar la sesión. Inténtalo de nuevo.' }, { status: 502 });
    } catch {
      return NextResponse.json({ message: 'No pudimos conectar. Inténtalo de nuevo.' }, { status: 502 });
    }
  }
  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  response.cookies.set('nuvora_session', '', { maxAge: 0, path: '/', httpOnly: true, sameSite: 'lax', secure: process.env['NODE_ENV'] === 'production' });
  response.cookies.set('nuvora_csrf', '', { maxAge: 0, path: '/', sameSite: 'strict', secure: process.env['NODE_ENV'] === 'production' });
  return response;
}
