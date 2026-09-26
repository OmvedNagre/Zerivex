import { NextRequest, NextResponse } from 'next/server';
import {
  defaultRateLimiter,
  getClientIp,
  RateLimitTier,
  validateRequestBodySize,
} from '@/core/security/rate-limiter';

/**
 * Production Security & Rate Limiting Edge Middleware (Phase 14)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req.headers);

  // 1. API Route Protection (Rate Limiting & Payload Inspection)
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

  // 2. Pass request and append Defense-in-Depth HTTP Security Headers
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  );

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
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
