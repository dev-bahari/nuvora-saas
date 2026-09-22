import { NextResponse } from 'next/server';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

/**
 * Internal render endpoint — protected by one-use token issued by the API.
 * Returns the invoice HTML for Playwright to render to PDF.
 * Token is validated and consumed by the API before calling this route.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new NextResponse('Missing render token', { status: 401 });
  }

  // Validate token with API
  const validateRes = await fetch(`${API_URL}/invoices/${id}/render-token/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!validateRes.ok) {
    return new NextResponse('Invalid or expired render token', { status: 403 });
  }

  // Fetch the invoice data (token validation confirmed tenant access)
  const docRes = await fetch(`${API_URL}/invoices/${id}`, {
    headers: { 'X-Internal-Render': 'true' },
  });

  if (!docRes.ok) {
    return new NextResponse('Document not found', { status: 404 });
  }

  // Return HTML response for Playwright to consume
  // ponytail: inline HTML until design system diverges from server template
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Factura ${id}</title></head>
<body><p>Render via internal API — see ArtifactsService.pdfRenderer for full template.</p></body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
