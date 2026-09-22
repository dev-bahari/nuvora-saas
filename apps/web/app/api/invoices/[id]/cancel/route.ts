import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = request.cookies.get('nuvora_session')?.value;
  const csrf = request.cookies.get('nuvora_csrf')?.value;
  const res = await fetch(`${API_URL}/invoices/${id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Cookie: `nuvora_session=${encodeURIComponent(session)}` } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
