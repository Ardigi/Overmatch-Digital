import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow dev-login page only in development
  if (pathname === '/dev-login' && process.env.NODE_ENV === 'production') {
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  // Protected routes that require authentication
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/'));

  if (isProtectedRoute) {
    // Check for NextAuth session
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      // In development, check for dev session
      if (process.env.NODE_ENV === 'development' && pathname.startsWith('/dashboard')) {
        const devSession = request.cookies.get('dev-session');

        if (devSession) {
          try {
            const session = JSON.parse(devSession.value);
            if (session.user) {
              // Valid dev session, allow access
              return NextResponse.next();
            }
          } catch (error) {
            // Invalid dev session
          }
        }
      }

      // No valid session, redirect to login
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Add user info to request headers for API routes
    if (pathname.startsWith('/api/')) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', token.sub || '');
      requestHeaders.set('x-user-email', token.email || '');

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/dev-login'],
};
