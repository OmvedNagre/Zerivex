'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/components/ui/Toast';
interface BillingMonitor {
  stripeConfigured: boolean;
  anomalies: { failedEvents: number; pendingEvents: number };
  events: Array<{ id: string; eventType: string; livemode: boolean; status: string; attempts: number; receivedAt: string; error: string | null; organizationName: string | null }>;
  invoices: Array<{ id: string; organizationName: string; amountDue: string; amountPaid: string; currency: string; status: string }>;
}
export default function StaffBillingEventsPage() {
  const [data, setData] = useState<BillingMonitor | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(`/api/staff/billing-events${status ? `?status=${status}` : ''}`);
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Unable to load billing events');
    setData(json.data); setError('');
  }, [status]);
  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    const timer = setInterval(() => load().catch((err: Error) => setError(err.message)), 15000);
    return () => clearInterval(timer);
  }, [load]);
  async function retry(id: string) {
    setBusy(id);
    try {
      const response = await fetch(`/api/staff/billing-events/${encodeURIComponent(id)}/retry`, { method: 'POST', headers: { 'X-Zerivex-Staff': 'true' } });
      const json = await response.json();
      if (!response.ok) throw new Error(json.reauthRequired ? 'Sign in to the staff console again before reconciling events.' : json.error || 'Retry failed');
      toast.success('Billing event reconciled.'); await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(null); }
  }
  const money = (value: string, currency: string) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value) / 100); }
    catch { return `${currency} ${Number(value) / 100}`; }
  };
  return <div className="staff-operations">
    <header><h1>Billing event monitor</h1><p>Verified Stripe events, processing failures, and reconciled invoices. Refreshes every 15 seconds.</p></header>
    {error && <p role="alert" className="staff-operation-error">{error}</p>}
    {data && !data.stripeConfigured && <p role="status">Stripe credentials or the webhook signing secret are missing. Configure them locally to receive real billing events.</p>}
    {data && <p aria-live="polite">{data.anomalies.failedEvents} failed event(s) · {data.anomalies.pendingEvents} event(s) pending for more than five minutes</p>}
    <label htmlFor="billing-status">Filter processing status</label><select id="billing-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All events</option>{['RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED'].map((item) => <option key={item}>{item}</option>)}</select>
    <section className="staff-card"><h2>Latest events</h2>{!data ? <p>Loading events…</p> : data.events.length === 0 ? <p>No verified events have been received.</p> : <div className="staff-operation-table" tabIndex={0} role="region" aria-label="Scrollable activity table"><table className="staff-table"><caption className="sr-only">Latest 100 billing events</caption><thead><tr><th scope="col">Received</th><th scope="col">Event</th><th scope="col">Organization</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{data.events.map((event) => <tr key={event.id}><td>{new Date(event.receivedAt).toLocaleString()}</td><td>{event.eventType}<br /><small>{event.livemode ? 'Live' : 'Test'} · {event.id}</small></td><td>{event.organizationName || 'Awaiting match'}</td><td>{event.status}{event.error && <p>{event.error}</p>}</td><td>{event.status === 'FAILED' && <button className="staff-btn-secondary" disabled={busy !== null} onClick={() => retry(event.id)}>{busy === event.id ? 'Reconciling…' : 'Retry reconciliation'}</button>}</td></tr>)}</tbody></table></div>}</section>
    <section className="staff-card"><h2>Invoice reconciliation</h2>{!data?.invoices.length ? <p>No invoices have been reconciled.</p> : <div className="staff-operation-table" tabIndex={0} role="region" aria-label="Scrollable activity table"><table className="staff-table"><caption className="sr-only">Latest 100 reconciled invoices</caption><thead><tr><th scope="col">Invoice</th><th scope="col">Organization</th><th scope="col">Due</th><th scope="col">Paid</th><th scope="col">Status</th></tr></thead><tbody>{data.invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.id}</td><td>{invoice.organizationName}</td><td>{money(invoice.amountDue, invoice.currency)}</td><td>{money(invoice.amountPaid, invoice.currency)}</td><td>{invoice.status}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
