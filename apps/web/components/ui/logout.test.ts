import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/logout/route';

const request = (origin = 'http://localhost:3000') => new NextRequest('http://localhost:3000/api/logout', {
  method: 'POST', headers: { origin, cookie: 'nuvora_session=session-token; nuvora_csrf=csrf-token' },
});

afterEach(() => vi.unstubAllGlobals());

describe('logout proxy', () => {
  it('forwards session and CSRF, clears both cookies and redirects only after revocation succeeds', async () => {
    let forwarded: RequestInit | undefined;
    vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => { forwarded = options; return new Response('{}'); });
    const response = await POST(request());
    expect(forwarded?.method).toBe('POST');
    expect(forwarded?.headers).toMatchObject({ Cookie: 'nuvora_session=session-token', 'x-csrf-token': 'csrf-token' });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    expect(response.cookies.get('nuvora_session')?.value).toBe('');
    expect(response.cookies.get('nuvora_csrf')?.value).toBe('');
  });
  it('rejects cross-origin requests before they revoke a session', async () => {
    vi.stubGlobal('fetch', () => { throw new Error('Must not reach API'); });
    expect((await POST(request('https://untrusted.example'))).status).toBe(403);
  });
  it('preserves session cookies on upstream failure so the user can retry', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 503 }));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
  it('returns a recoverable failure when the API is unreachable', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('Offline'); });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
