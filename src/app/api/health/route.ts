import { NextResponse } from 'next/server';
import { getSystemHealthReport } from '@/core/observability/health-service';

export async function GET() {
  try {
    const report = await getSystemHealthReport();
    const httpStatus = report.status === 'DOWN' ? 503 : 200;

    return NextResponse.json(report, { status: httpStatus });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        error: error.message || 'Health check failed',
      },
      { status: 503 }
    );
  }
}
