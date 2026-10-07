'use client';

import Link from 'next/link';
import { Lock, ArrowRight, TriangleAlert } from 'lucide-react';

export interface UpgradeNudgeProps {
  attempted: string;
  reason: string;
  requiredPlanId: string;
  benefit: string;
  secondaryHref?: string;
  severity?: 'soft' | 'blocked';
  className?: string;
}

export function UpgradeNudge({
  attempted,
  reason,
  requiredPlanId,
  benefit,
  secondaryHref,
  severity = 'soft',
  className = '',
}: UpgradeNudgeProps) {
  const isBlocked = severity === 'blocked';

  return (
    <div
      className={`zx-upgrade-nudge zx-upgrade-nudge--${severity} ${className}`}
      role="alert"
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--ds-radius-sm)',
          backgroundColor: isBlocked ? 'rgba(209, 0, 47, 0.15)' : 'rgba(216, 121, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isBlocked ? 'var(--ds-danger)' : 'var(--ds-warning)',
          flexShrink: 0,
        }}
      >
        {isBlocked ? <Lock size={16} /> : <TriangleAlert size={16} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h4
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 700,
            margin: '0 0 4px',
            color: 'var(--ds-text-primary)',
          }}
        >
          {attempted}
        </h4>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--ds-text-secondary)',
            margin: '0 0 8px',
            lineHeight: 1.45,
          }}
        >
          {reason}
        </p>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--ds-text-muted)',
            margin: '0 0 12px',
            fontWeight: 500,
          }}
        >
          <strong>Benefit:</strong> {benefit}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Link
            href={`/pricing?upgrade=${encodeURIComponent(requiredPlanId)}`}
            className="zx-btn zx-btn--brand zx-btn--sm"
          >
            <span>Upgrade to {requiredPlanId.replace(/_/g, ' ')}</span>
            <ArrowRight size={13} />
          </Link>
          {secondaryHref && (
            <Link
              href={secondaryHref}
              className="zx-btn zx-btn--ghost zx-btn--sm"
            >
              Learn more
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
