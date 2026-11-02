import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffPermission } from '@/core/staff/staff-session-service';
import { getCreditLedger } from '@/core/credits/credit-service';
export async function GET(req: NextRequest) {
  try {
    await requireStaffPermission(req, 'VIEW_ORGS');
    const organizationId = req.nextUrl.searchParams.get('organizationId');
    if (!z.string().uuid().safeParse(organizationId).success) return NextResponse.json({ error: 'Valid organizationId required' }, { status: 400 });
    return NextResponse.json({ success: true, data: await getCreditLedger(organizationId!) });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    return NextResponse.json({ error: err.statusCode ? err.message : 'Unable to load credits' }, { status: err.statusCode || 500 });
  }
}
