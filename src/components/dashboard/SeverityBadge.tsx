'use client';

import { OctagonAlert, TriangleAlert, CircleAlert, Info } from 'lucide-react';

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | 'INFORMATIONAL';

export interface SeverityBadgeProps {
  severity: FindingSeverity | string;
  className?: string;
  showIcon?: boolean;
}

export function SeverityBadge({ severity, className = '', showIcon = true }: SeverityBadgeProps) {
  const normalized = (severity || '').toUpperCase().trim();

  let label = 'INFO';
  let sevKey = 'info';
  let IconComponent = Info;

  switch (normalized) {
    case 'CRITICAL':
      label = 'CRITICAL';
      sevKey = 'critical';
      IconComponent = OctagonAlert;
      break;

    case 'HIGH':
      label = 'HIGH';
      sevKey = 'high';
      IconComponent = TriangleAlert;
      break;

    case 'MEDIUM':
      label = 'MEDIUM';
      sevKey = 'medium';
      IconComponent = CircleAlert;
      break;

    case 'LOW':
      label = 'LOW';
      sevKey = 'low';
      IconComponent = Info;
      break;

    case 'INFORMATIONAL':
    case 'INFO':
    default:
      label = 'INFO';
      sevKey = 'info';
      IconComponent = Info;
      break;
  }

  return (
    <span
      className={`zfc-sev-badge zfc-sev-${sevKey} ${className}`}
      data-severity={sevKey}
      role="status"
      aria-label={`Severity: ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: 'var(--ds-radius-sm)',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        backgroundColor: `var(--sev-${sevKey}-bg, var(--ds-bg-subtle))`,
        color: `var(--sev-${sevKey}, var(--ds-text-primary))`,
        border: `1px solid var(--sev-${sevKey}-border, var(--ds-border-subtle))`,
      }}
    >
      {showIcon && <IconComponent size={12} strokeWidth={2} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}
