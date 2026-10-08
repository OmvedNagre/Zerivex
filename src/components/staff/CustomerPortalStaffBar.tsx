'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Eye, ArrowRight } from 'lucide-react';

interface StaffBarContext {
  isStaff: boolean;
  role: string | null;
  previewPlanId: string | null;
}

export function CustomerPortalStaffBar() {
  const [context, setContext] = useState<StaffBarContext | null>(null);
  const [updatingPlan, setUpdatingPlan] = useState(false);

  useEffect(() => {
    // Check if current user is operating via staff portal
    async function checkStaffContext() {
      try {
        const res = await fetch('/api/staff/me');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.user) {
            setContext({
              isStaff: true,
              role: data.data.user.role,
              previewPlanId: null,
            });
          }
        }
      } catch {
        // Not staff
      }
    }
    checkStaffContext();
  }, []);

  if (!context?.isStaff) {
    return null;
  }

  const handlePlanChange = async (planId: string | null) => {
    try {
      setUpdatingPlan(true);
      const res = await fetch('/api/staff/portal/preview-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zerivex-Staff': 'true',
        },
        body: JSON.stringify({ planId }),
      });

      if (res.ok) {
        setContext((prev) => (prev ? { ...prev, previewPlanId: planId } : null));
        // Refresh customer view to re-evaluate entitlements
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update plan preview');
      }
    } catch {
      alert('Error updating preview plan');
    } finally {
      setUpdatingPlan(false);
    }
  };

  const isSupport = context.role === 'STAFF_SUPPORT';

  return (
    <div
      style={{
        backgroundColor: '#5925AB',
        color: '#FFFFFF',
        padding: '5px 16px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 9999,
        position: 'relative',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Shield size={13} color="#FFFFFF" />
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            STAFF MODE · Zerivex Internal · {context.role}
          </span>
        </div>

        {/* Phase D: Plan Preview Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(0,0,0,0.25)',
            padding: '2px 8px',
            borderRadius: '4px',
          }}
        >
          <Eye size={11} color="#AB6CFE" />
          <span style={{ color: '#E9EAF0', fontSize: '10.5px' }}>
            Previewing Plan:
          </span>
          <select
            disabled={updatingPlan}
            value={context.previewPlanId || 'INTERNAL_DEFAULT'}
            onChange={(e) => {
              const val = e.target.value === 'INTERNAL_DEFAULT' ? null : e.target.value;
              handlePlanChange(val);
            }}
            style={{
              backgroundColor: '#1E1735',
              color: '#FFFFFF',
              border: '1px solid #7839EE',
              borderRadius: '3px',
              fontSize: '10px',
              padding: '1px 4px',
              cursor: 'pointer',
            }}
          >
            <option value="INTERNAL_DEFAULT">Full Staff Access (Default)</option>
            <option value="FREE_DEVELOPER">Free Developer</option>
            <option value="TEAM_PRO">Team Pro</option>
            {!isSupport && <option value="ENTERPRISE">Enterprise</option>}
          </select>
        </div>
      </div>

      <div>
        <Link
          href="/staff"
          style={{
            color: '#FFFFFF',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          <span>Back to Console</span>
          <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
