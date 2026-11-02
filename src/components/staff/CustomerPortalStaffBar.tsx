'use client';

import Link from 'next/link';
import { Shield, ArrowRight } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getStaffRoleLabel } from '@/lib/labels';

/** A context indicator only; staff membership never changes customer entitlements. */
export function CustomerPortalStaffBar() {
  const { viaStaffPortal, staffRole } = useAuth();
  if (!viaStaffPortal || !staffRole) return null;
  return <div className="zx-portal-banner" style={{ background: '#5925AB', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Shield size={15} /> Internal staff workspace · {getStaffRoleLabel(staffRole)}</span>
    <Link href="/staff" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Back to staff console <ArrowRight size={14} /></Link>
  </div>;
}
