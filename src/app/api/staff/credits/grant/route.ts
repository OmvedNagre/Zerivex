import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffPermission, requireStaffReauth } from '@/core/staff/staff-session-service';
import { grantScanCredits } from '@/core/credits/credit-service';
import { readJsonBody } from '@/core/security/request-body';

const grantSchema = z.object({ organizationId: z.string().uuid(), amount: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(5).max(1000), idempotencyKey: z.string().regex(/^[\w:-]{8,128}$/) });
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaffPermission(req, 'GRANT_CREDITS');
    requireStaffReauth(staff);
    const parsed = grantSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) return NextResponse.json({ success: false, error: 'An organization, integer amount, reason, and idempotency key are required.' }, { status: 400 });
    if (staff.role === 'STAFF_ADMIN' && parsed.data.amount > 1000) return NextResponse.json({ success: false, error: 'Staff admins may grant at most 1,000 scan credits per transaction.' }, { status: 403 });
    const result = await grantScanCredits({ ...parsed.data, userId: staff.userId });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const err = error as Error & { statusCode?: number; reauthRequired?: boolean };
    return NextResponse.json({ success: false, error: err.statusCode ? err.message : 'Credit grant failed', reauthRequired: Boolean(err.reauthRequired) }, { status: err.statusCode || 500 });
  }
}
