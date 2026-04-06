import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { UserRole } from '@/types';

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret');

const publicPaths = ['/login', '/api/auth', '/track', '/api/repairs/track', '/portal', '/api/portal'];

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

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sub = payload.sub as string;
    const role = payload.role as UserRole;
    const storeId = payload.store_id as string;

    // Add user info to request headers for API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', sub);
    requestHeaders.set('x-user-role', role);
    requestHeaders.set('x-user-store', storeId);

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('token', '', { maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
};
