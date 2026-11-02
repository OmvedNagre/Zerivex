'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { getOrgRoleLabel } from '@/lib/labels';
import { CONTACT_EMAIL } from '@/lib/contact';
interface Invite { organizationName:string; email:string; role:string; status:string; expiresAt:string; isExpired:boolean; inviterName:string|null; inviterEmail:string; }
export default function InvitePage() {
  const {token}=useParams<{token:string}>(); const {user,status}=useAuth();
  const [invite,setInvite]=useState<Invite|null>(null); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  useEffect(() => { fetch(`/api/teams/invitations/${encodeURIComponent(token)}`,{cache:'no-store'}).then(async r => {const data=await r.json();if(!r.ok)throw new Error(data.error || 'Invitation unavailable');setInvite(data.data.invitation);}).catch(e=>setError(e.message)); },[token]);
  const valid=invite?.status==='PENDING' && !invite.isExpired && new Date(invite.expiresAt).getTime()>Date.now();
  const matches=user?.email.toLowerCase()===invite?.email.toLowerCase();
  async function accept() {
    setBusy(true);setError('');
    try { const res=await fetch(`/api/teams/invitations/${encodeURIComponent(token)}/accept`,{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest'}});const data=await res.json();if(!res.ok)throw new Error(data.error || 'Unable to accept invitation');window.location.assign('/onboarding/team'); }
    catch(e){setError((e as Error).message);setBusy(false);}
  }
  return <main className="zx-team-welcome"><section className="zx-team-welcome-card"><Link href="/" aria-label="Zerivex home"><BrandLogo /></Link><p className="zx-welcome-eyebrow">WORKSPACE INVITATION</p><h1>{invite ? `Join ${invite.organizationName}` : 'Your Zerivex invitation'}</h1>{error && <p role="alert">{error}</p>}{!invite && !error && <p role="status">Loading invitation…</p>}{invite && <><p>{invite.inviterName || invite.inviterEmail} invited you as <strong>{getOrgRoleLabel(invite.role)}</strong>.</p><p>Invited email: <strong>{invite.email}</strong></p>{!valid ? <p role="status">This invitation is {invite.status==='PENDING' ? 'expired' : invite.status.toLowerCase()}. Ask your workspace administrator to send a new invitation.</p> : status==='AUTH_LOADING' ? <p>Checking your sign-in…</p> : !user ? <Link className="zx-btn zx-btn--brand" href={`/login?returnTo=${encodeURIComponent(`/invite/${token}`)}`}>Sign in or create an account</Link> : !matches ? <p role="alert">You are signed in as {user.email}. <Link href={`/login?returnTo=${encodeURIComponent(`/invite/${token}`)}`}>Use {invite.email}</Link> to accept this invitation.</p> : <><p>Accepting adds you to this workspace with the role shown above. Your existing workspaces stay available.</p><button className="zx-btn zx-btn--brand" disabled={busy} onClick={accept}>{busy ? 'Joining…' : 'Accept the role'}</button></>}<p>Expires {new Date(invite.expiresAt).toLocaleDateString()}.</p></>}<p className="zx-welcome-support">Need help? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p></section></main>;
}
