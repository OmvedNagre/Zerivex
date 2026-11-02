'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/components/ui/Toast';

interface Organization { id: string; name: string; isInternal: boolean; suspendedAt: string | null }
interface Ledger { balance: number; entries: Array<{ id: string; source: string; amount: number; reason: string; createdAt: string; actorEmail: string | null }> }
export default function StaffCreditsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [requestKey, setRequestKey] = useState('');
  useEffect(() => {
    Promise.all([fetch('/api/staff/orgs'), fetch('/api/staff/me')]).then(async ([orgResponse, meResponse]) => {
      if (!orgResponse.ok || !meResponse.ok) throw new Error('Unable to load credit permissions or organizations');
      const orgs = await orgResponse.json(); const me = await meResponse.json();
      setOrganizations(orgs.data.organizations.filter((org: Organization) => !org.isInternal && !org.suspendedAt));
      setAllowed(me.data.permissions.includes('GRANT_CREDITS'));
    }).catch((err: Error) => setError(err.message));
  }, []);
  const load = useCallback(async () => {
    if (!organizationId) { setLedger(null); return; }
    const response = await fetch(`/api/staff/credits?organizationId=${encodeURIComponent(organizationId)}`);
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Unable to load ledger');
    setLedger(json.data);
  }, [organizationId]);
  useEffect(() => { setLedger(null); setRequestKey(''); load().catch((err: Error) => setError(err.message)); }, [load]);
  async function grant(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const key = requestKey || crypto.randomUUID(); setRequestKey(key);
    try {
      const response = await fetch('/api/staff/credits/grant', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Zerivex-Staff': 'true' },
        body: JSON.stringify({ organizationId, amount: Number(amount), reason, idempotencyKey: key }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.reauthRequired ? 'Please sign in to the staff console again, then retry this grant.' : json.error || 'Grant failed');
      toast.success(json.data.duplicate ? 'This grant was already recorded.' : 'Scan credits granted.');
      setAmount(''); setReason(''); setRequestKey(''); await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <div className="staff-operations">
    <header><h1>Scan credit ledger</h1><p>One credit funds one additional scan after the organization’s monthly allocation is used. Credits do not unlock paid scan engines.</p></header>
    {error && <p role="alert" className="staff-operation-error">{error}</p>}
    <label htmlFor="credit-org">Customer organization</label>
    <select id="credit-org" value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setError(''); }}>
      <option value="">Choose an organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
    </select>
    {organizationId && <section className="staff-card"><h2>Available scan credits</h2><p className="staff-operation-balance" aria-live="polite">{ledger?.balance ?? 'Loading…'}</p></section>}
    {allowed && <form onSubmit={grant} className="staff-card staff-operation-form">
      <h2>Grant credits</h2>
      <label htmlFor="credit-amount">Number of credits</label><input id="credit-amount" inputMode="numeric" type="number" min="1" max="1000000" required value={amount} onChange={(event) => { setAmount(event.target.value); setRequestKey(''); }} />
      <label htmlFor="credit-reason">Operational reason</label><textarea id="credit-reason" required minLength={5} maxLength={1000} value={reason} onChange={(event) => { setReason(event.target.value); setRequestKey(''); }} />
      <p>Recent staff authentication is required. Admins may grant up to 1,000 credits per transaction.</p>
      <button className="staff-btn-brand" disabled={busy || !organizationId} type="submit">{busy ? 'Recording grant…' : 'Grant scan credits'}</button>
    </form>}
    {ledger && <section className="staff-card"><h2>Ledger activity</h2>
      {ledger.entries.length === 0 ? <p>No credit transactions have been recorded.</p> : <div className="staff-operation-table" tabIndex={0} role="region" aria-label="Scrollable activity table"><table className="staff-table"><caption className="sr-only">Latest 100 credit transactions</caption><thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Credits</th><th scope="col">Reason</th></tr></thead><tbody>{ledger.entries.map((entry) => <tr key={entry.id}><td>{new Date(entry.createdAt).toLocaleString()}</td><td>{entry.source.replaceAll('_', ' ')}</td><td>{entry.amount > 0 ? '+' : ''}{entry.amount}</td><td>{entry.reason}</td></tr>)}</tbody></table></div>}
    </section>}
  </div>;
}
