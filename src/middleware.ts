import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const publicPaths = ['/login', '/api/auth'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/manifest') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Allow public paths
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check auth token
  const token = request.cookies.get('token')?.value;
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('token', '', { maxAge: 0 });
    return response;
  }

  // Add user info to request headers for API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.sub);
  requestHeaders.set('x-user-role', payload.role);
  requestHeaders.set('x-user-store', payload.store_id);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
};
