import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/core/staff/staff-session-service';
import { query } from '@/core/db/database';
export async function GET(req: NextRequest) {
  try {
    const staff = await requireStaffPermission(req, 'VIEW_BILLING');
    const status = req.nextUrl.searchParams.get('status');
    const events = await query(`SELECT e.id, e.event_type as "eventType", e.livemode, e.processing_status as status,
      e.attempts, e.received_at as "receivedAt", e.processed_at as "processedAt", e.error_message as error,
      o.name as "organizationName" FROM billing_events e LEFT JOIN organizations o ON o.id = e.organization_id
      WHERE ($1::text IS NULL OR e.processing_status = $1) ORDER BY e.received_at DESC LIMIT 100`, [status || null]);
    const invoices = await query(`SELECT i.id, i.amount_due as "amountDue", i.amount_paid as "amountPaid", i.currency,
      i.status, o.name as "organizationName", i.updated_at as "updatedAt"
      FROM billing_invoices i JOIN organizations o ON o.id = i.organization_id ORDER BY i.updated_at DESC LIMIT 100`);
    const anomalies = await query(`SELECT COUNT(*) FILTER (WHERE processing_status = 'FAILED')::int as "failedEvents",
      COUNT(*) FILTER (WHERE processing_status = 'RECEIVED' AND received_at < NOW() - INTERVAL '5 minutes')::int as "pendingEvents"
      FROM billing_events`);
    return NextResponse.json({ success: true, data: { events: events.rows, invoices: invoices.rows,
      anomalies: anomalies.rows[0], stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET), role: staff.role } });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    return NextResponse.json({ error: err.statusCode ? err.message : 'Unable to load billing events' }, { status: err.statusCode || 500 });
  }
}
