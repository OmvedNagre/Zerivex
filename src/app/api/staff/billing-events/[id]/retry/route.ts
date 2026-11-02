import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission, requireStaffReauth } from '@/core/staff/staff-session-service';
import { retryBillingEvent } from '@/core/billing/billing-operations';
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaffPermission(req, 'RECONCILE_BILLING');
    requireStaffReauth(staff);
    const { id } = await params;
    return NextResponse.json({ success: true, data: await retryBillingEvent(id) });
  } catch (error) {
    const err = error as Error & { statusCode?: number; reauthRequired?: boolean };
    return NextResponse.json({ error: err.statusCode ? err.message : 'Reconciliation failed. Check Stripe configuration.', reauthRequired: Boolean(err.reauthRequired) }, { status: err.statusCode || 500 });
  }
}
