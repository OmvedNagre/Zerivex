'use client';

import { useState } from 'react';
import { ShieldCheck, UserRound, Loader2 } from 'lucide-react';

interface PortalSwitcherProps {
  currentPortal: 'staff' | 'customer';
  isCollapsed?: boolean;
}

export function PortalSwitcher({ currentPortal, isCollapsed = false }: PortalSwitcherProps) {
  const [switching, setSwitching] = useState(false);

  const handleSwitch = async (destination: 'CUSTOMER_PORTAL' | 'STAFF_CONSOLE') => {
    if (switching) return;
    try {
      setSwitching(true);
      const res = await fetch('/api/staff/portal/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zerivex-Staff': 'true',
        },
        body: JSON.stringify({ destination }),
      });

      if (res.ok) {
        if (destination === 'CUSTOMER_PORTAL') {
          window.location.href = '/dashboard';
        } else {
          window.location.href = '/staff';
        }
      } else {
        alert('Failed to switch portal. Session may require re-authentication.');
        setSwitching(false);
      }
    } catch {
      setSwitching(false);
    }
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        disabled={switching}
        onClick={() =>
          handleSwitch(
            currentPortal === 'staff' ? 'CUSTOMER_PORTAL' : 'STAFF_CONSOLE'
          )
        }
        title={
          currentPortal === 'staff'
            ? 'Switch to Customer Portal'
            : 'Switch to Staff Console'
        }
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(171, 108, 254, 0.15)',
          border: '1px solid rgba(171, 108, 254, 0.3)',
          color: '#AB6CFE',
          cursor: 'pointer',
          margin: '0 auto',
        }}
      >
        {switching ? (
          <Loader2 size={16} className="animate-spin" />
        ) : currentPortal === 'staff' ? (
          <UserRound size={16} />
        ) : (
          <ShieldCheck size={16} />
        )}
      </button>
    );
  }

  return (
    <div
      style={{
        padding: '8px',
        backgroundColor: '#191C26',
        borderRadius: '8px',
        border: '1px solid #262A36',
        margin: '12px 12px 16px',
        display: 'flex',
        gap: '4px',
      }}
    >
      <button
        type="button"
        disabled={switching || currentPortal === 'staff'}
        onClick={() => handleSwitch('STAFF_CONSOLE')}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '6px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 700,
          border: 'none',
          cursor: currentPortal === 'staff' ? 'default' : 'pointer',
          backgroundColor:
            currentPortal === 'staff' ? '#5925AB' : 'transparent',
          color: currentPortal === 'staff' ? '#FFFFFF' : '#9FA4B8',
          transition: 'all 0.15s ease',
        }}
      >
        <ShieldCheck size={13} />
        <span>Staff</span>
      </button>

      <button
        type="button"
        disabled={switching || currentPortal === 'customer'}
        onClick={() => handleSwitch('CUSTOMER_PORTAL')}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '6px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 700,
          border: 'none',
          cursor: currentPortal === 'customer' ? 'default' : 'pointer',
          backgroundColor:
            currentPortal === 'customer' ? 'var(--brand, #f97316)' : 'transparent',
          color: currentPortal === 'customer' ? '#FFFFFF' : '#9FA4B8',
          transition: 'all 0.15s ease',
        }}
      >
        <UserRound size={13} />
        <span>Portal</span>
      </button>
    </div>
  );
}
