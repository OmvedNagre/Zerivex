import { NextRequest, NextResponse } from 'next/server';
import { getEnvConfig } from '@/core/config/env-validator';

export async function GET(req: NextRequest) {
  const config = getEnvConfig();
  if (config.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Mock authentication is disabled in production' }, { status: 403 });
  }

  const state = req.nextUrl.searchParams.get('state') || '';
  const mockEmail = req.nextUrl.searchParams.get('email') || config.INITIAL_OWNER_EMAIL || 'owner@zerivex.local';

  return NextResponse.redirect(
    `${config.NEXT_PUBLIC_APP_URL}/api/auth/callback/mock?code=mock_code&state=${state}&mock_email=${encodeURIComponent(mockEmail)}`
  );
}
