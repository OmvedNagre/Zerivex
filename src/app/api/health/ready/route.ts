import { NextResponse } from 'next/server';
import { checkReadiness } from '@/core/observability/health-service';

export async function GET() {
  const result = await checkReadiness();
  if (result.ready) {
    return NextResponse.json(
      {
        ready: true,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      ready: false,
      timestamp: new Date().toISOString(),
      reason: result.reason,
    },
    { status: 503 }
  );
}
