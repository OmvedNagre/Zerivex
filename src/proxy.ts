import { NextRequest, NextResponse } from 'next/server';
import {
  defaultRateLimiter,
  getClientIp,
  RateLimitTier,
  validateRequestBodySize,
} from '@/core/security/rate-limiter';

/**
 * Production Security & Rate Limiting Edge Proxy (Next.js 16)
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req.headers);

  // 1. Staff Portal Kill Switch & Edge Protection
  if (pathname.startsWith('/staff') || pathname.startsWith('/api/staff')) {
    if (process.env.STAFF_PORTAL_ENABLED === 'false') {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Protect UI pages (except login)
    if (pathname.startsWith('/staff') && !pathname.startsWith('/staff/login')) {
      const staffCookieName =
        process.env.NODE_ENV === 'production'
          ? '__Host-zx_staff_session'
          : 'zx_staff_session';
      const staffCookie = req.cookies.get(staffCookieName);

      if (!staffCookie?.value) {
        const staffLoginUrl = new URL('/staff/login', req.url);
        const redirectRes = NextResponse.redirect(staffLoginUrl);
        redirectRes.headers.set('X-Robots-Tag', 'noindex, nofollow');
        redirectRes.headers.set('Cache-Control', 'no-store');
        return redirectRes;
      }
    }
  }

  // 2. Customer Dashboard & Onboarding Route Protection (Edge level)
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding')) {
    const cookieName =
      process.env.NODE_ENV === 'production'
        ? '__Host-zerivex_session'
        : 'zerivex_session';
    const sessionCookie = req.cookies.get(cookieName);

    if (!sessionCookie?.value) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. API Route Protection (Rate Limiting & Payload Inspection)
  if (pathname.startsWith('/api/')) {
    // A. Payload Size Inspection on Mutations
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const maxBytes = pathname.includes('/upload') ? 10 * 1024 * 1024 : 2 * 1024 * 1024;
      const sizeCheck = validateRequestBodySize(req.headers, maxBytes);
      if (!sizeCheck.valid) {
        return NextResponse.json(
          { error: sizeCheck.error || 'Payload too large' },
          { status: 413 }
        );
      }
    }

    // B. Tiered Rate Limiting
    let tier: RateLimitTier = 'API_STANDARD';
    if (pathname.startsWith('/api/auth/')) {
      tier = 'AUTH';
    } else if (
      pathname.startsWith('/api/scans') ||
      pathname.startsWith('/api/schedules') ||
      pathname.startsWith('/api/v1/ci/scan')
    ) {
      tier = 'SCANS';
    } else if (pathname.startsWith('/api/health')) {
      tier = 'PUBLIC';
    }

    const rateLimitKey = `${tier}:${ip}`;
    const result = defaultRateLimiter.check(rateLimitKey, tier);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please retry after ${result.retryAfterSeconds} seconds.`,
          retryAfter: result.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfterSeconds),
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': String(Math.ceil(result.resetInMs / 1000)),
          },
        }
      );
    }
  }

  // 4. Pass request and append Defense-in-Depth HTTP Security Headers
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' https: data:; img-src 'self' data: https: blob:; connect-src 'self' https:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"
    );
  }
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  );

  // Phase C: Staff routes must be completely hidden from search engines and never cached
  if (pathname.startsWith('/staff') || pathname.startsWith('/api/staff')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'no-store');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
