'use client';

export interface UsageMeterProps {
  label: string;
  current: number;
  max: number;
  unit?: string;
  className?: string;
}

export function UsageMeter({
  label,
  current,
  max,
  unit = '',
  className = '',
}: UsageMeterProps) {
  const percentage = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const isHigh = percentage >= 80;
  const isExceeded = percentage >= 100;

  let barColor = 'var(--ds-action-brand)';
  if (isExceeded) {
    barColor = 'var(--ds-danger)';
  } else if (isHigh) {
    barColor = 'var(--ds-warning)';
  }

  return (
    <div className={`zx-usage-meter ${className}`} style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          fontWeight: 500,
          marginBottom: '6px',
        }}
      >
        <span style={{ color: 'var(--ds-text-secondary)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
          {current} / {max >= 999999 ? '∞' : max} {unit}
        </span>
      </div>

      <div
        style={{
          height: '6px',
          width: '100%',
          backgroundColor: 'var(--ds-bg-subtle)',
          borderRadius: 'var(--ds-radius-pill)',
          overflow: 'hidden',
          border: '1px solid var(--ds-border-subtle)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: barColor,
            borderRadius: 'var(--ds-radius-pill)',
            transition: 'width 0.4s var(--ds-ease)',
          }}
        />
      </div>
    </div>
  );
}
