'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Search,
  Crosshair,
  Zap,
  Shield,
  FileText,
  Users,
  Settings,
  CreditCard,
  Building2,
  GraduationCap,
} from 'lucide-react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (action: () => void) => {
    setOpen(false);
    action();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(20, 22, 28, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 600,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: '90vw',
          maxWidth: '540px',
          backgroundColor: 'var(--ds-bg-card)',
          borderRadius: 'var(--ds-radius-lg)',
          border: '1px solid var(--ds-border-default)',
          boxShadow: 'var(--ds-shadow-3)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Global Command Menu">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderBottom: '1px solid var(--ds-border-subtle)',
            }}
          >
            <Search size={16} color="var(--ds-text-secondary)" />
            <Command.Input
              placeholder="Search targets, scans, pages or settings... (⌘K)"
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'var(--ds-text-primary)',
              }}
            />
          </div>

          <Command.List
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '8px',
            }}
          >
            <Command.Empty style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--ds-text-muted)' }}>
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" style={{ fontSize: '11px', color: 'var(--ds-text-muted)', padding: '6px 8px', fontWeight: 600 }}>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/dashboard'))}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: 'var(--ds-radius-sm)', cursor: 'pointer', fontSize: '13px', color: 'var(--ds-text-primary)' }}
              >
                <Zap size={14} /> Overview Console
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/dashboard/targets'))}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: 'var(--ds-radius-sm)', cursor: 'pointer', fontSize: '13px', color: 'var(--ds-text-primary)' }}
              >
                <Crosshair size={14} /> Target Inventory
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/dashboard/scans'))}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: 'var(--ds-radius-sm)', cursor: 'pointer', fontSize: '13px', color: 'var(--ds-text-primary)' }}
              >
                <Zap size={14} /> Scan Fleet
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/dashboard/findings'))}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: 'var(--ds-radius-sm)', cursor: 'pointer', fontSize: '13px', color: 'var(--ds-text-primary)' }}
              >
                <Shield size={14} /> Vulnerability Findings
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/dashboard/audit-vault'))}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: 'var(--ds-radius-sm)', cursor: 'pointer', fontSize: '13px', color: 'var(--ds-text-primary)' }}
              >
                <FileText size={14} /> Compliance Audit Vault
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/dashboard/team'))}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: 'var(--ds-radius-sm)', cursor: 'pointer', fontSize: '13px', color: 'var(--ds-text-primary)' }}
              >
                <Users size={14} /> Team Roster & Roles
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/dashboard/agency'))}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: 'var(--ds-radius-sm)', cursor: 'pointer', fontSize: '13px', color: 'var(--ds-text-primary)' }}
              >
                <Building2 size={14} /> Agency Multi-Client Hub
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/academy'))}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: 'var(--ds-radius-sm)', cursor: 'pointer', fontSize: '13px', color: 'var(--ds-text-primary)' }}
              >
                <GraduationCap size={14} /> Security Academy
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/dashboard/billing'))}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: 'var(--ds-radius-sm)', cursor: 'pointer', fontSize: '13px', color: 'var(--ds-text-primary)' }}
              >
                <CreditCard size={14} /> Billing & Plan Tiers
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/dashboard/settings/api-keys'))}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: 'var(--ds-radius-sm)', cursor: 'pointer', fontSize: '13px', color: 'var(--ds-text-primary)' }}
              >
                <Settings size={14} /> API Keys & CI/CD Tokens
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
