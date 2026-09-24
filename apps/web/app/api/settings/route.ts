import { type NextRequest, NextResponse } from 'next/server';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

function forwardHeaders(request: NextRequest) {
  const session = request.cookies.get('nuvora_session')?.value;
  const csrf = request.cookies.get('nuvora_csrf')?.value;
  return {
    'Content-Type': 'application/json',
    ...(session ? { Cookie: `nuvora_session=${encodeURIComponent(session)}` } : {}),
    ...(csrf ? { 'x-csrf-token': csrf } : {}),
  };
}

export async function GET(request: NextRequest) {
  const res = await fetch(`${API_URL}/settings`, { headers: forwardHeaders(request), cache: 'no-store' });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(request: NextRequest) {
  const body = await request.text();
  const res = await fetch(`${API_URL}/settings`, {
    method: 'PUT',
    headers: forwardHeaders(request),
    body,
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
