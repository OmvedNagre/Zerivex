'use client';

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | 'INFORMATIONAL';

interface SeverityBadgeProps {
  severity: FindingSeverity | string;
  className?: string;
  showIcon?: boolean;
}

export function SeverityBadge({ severity, className = '', showIcon = true }: SeverityBadgeProps) {
  const normalized = (severity || '').toUpperCase().trim();
  
  let label = 'INFO';
  let sevKey = 'info';
  let icon = (
    <svg className="zfc-sev-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 7v4M8 5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  switch (normalized) {
    case 'CRITICAL':
      label = 'CRITICAL';
      sevKey = 'critical';
      icon = (
        <svg className="zfc-sev-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1.5l6.5 12h-13L8 1.5z" />
          <path d="M8 6v3M8 11h.01" stroke="var(--bg-primary)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
      break;

    case 'HIGH':
      label = 'HIGH';
      sevKey = 'high';
      icon = (
        <svg className="zfc-sev-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <rect x="2" y="2" width="12" height="12" rx="2" transform="rotate(45 8 8)" />
        </svg>
      );
      break;

    case 'MEDIUM':
      label = 'MEDIUM';
      sevKey = 'medium';
      icon = (
        <svg className="zfc-sev-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <rect x="3" y="3" width="10" height="10" rx="1.5" />
        </svg>
      );
      break;

    case 'LOW':
      label = 'LOW';
      sevKey = 'low';
      icon = (
        <svg className="zfc-sev-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
      break;

    case 'INFORMATIONAL':
    case 'INFO':
    default:
      label = 'INFO';
      sevKey = 'info';
      break;
  }

  return (
    <span
      className={`zfc-sev-badge zfc-sev-${sevKey} ${className}`}
      data-severity={sevKey}
      role="status"
      aria-label={`Severity: ${label}`}
    >
      {showIcon && icon}
      <span>{label}</span>
    </span>
  );
}
