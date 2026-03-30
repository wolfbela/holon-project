import { NextRequest, NextResponse } from 'next/server';

const ADMIN_ROUTES = ['/dashboard', '/tickets', '/team'];
const CUSTOMER_ONLY_ROUTES = ['/my-tickets'];

function decodeJwtPayload(token: string): { role?: string } | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // Public auth pages: if already authenticated, redirect by role
  if (pathname === '/login' || pathname === '/register') {
    if (token) {
      const payload = decodeJwtPayload(token);
      const dest =
        payload?.role === 'admin' ? '/dashboard' : '/products';
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  // All other matched routes require authentication
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = decodeJwtPayload(token);

  // Admin-only routes: redirect customers away
  if (
    ADMIN_ROUTES.some((r) => pathname.startsWith(r)) &&
    payload?.role !== 'admin'
  ) {
    return NextResponse.redirect(new URL('/products', request.url));
  }

  // Customer-only routes: redirect admins away
  if (
    CUSTOMER_ONLY_ROUTES.some((r) => pathname.startsWith(r)) &&
    payload?.role === 'admin'
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/register',
    '/dashboard/:path*',
    '/tickets/:path*',
    '/team/:path*',
    '/products/:path*',
    '/my-tickets/:path*',
  ],
};
