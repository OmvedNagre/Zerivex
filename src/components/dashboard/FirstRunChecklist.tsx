'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';

export interface ChecklistState {
  hasTarget: boolean;
  hasVerifiedTarget: boolean;
  hasCompletedScan: boolean;
  hasFixedFinding: boolean;
  hasCiGate: boolean;
}

interface FirstRunChecklistProps {
  state: ChecklistState;
}

export function FirstRunChecklist({ state }: FirstRunChecklistProps) {
  const steps = [
    {
      id: 'target',
      label: 'Register your first target',
      description: 'Add your web application origin to the perimeter scan list.',
      done: state.hasTarget,
      href: '/dashboard/targets',
      actionLabel: 'Add target',
    },
    {
      id: 'verify',
      label: 'Verify domain ownership',
      description: 'Complete DNS TXT, HTTP header, HTML meta, or file verification to enable active tests.',
      done: state.hasVerifiedTarget,
      href: '/dashboard/targets',
      actionLabel: 'Verify ownership',
    },
    {
      id: 'scan',
      label: 'Execute first perimeter scan',
      description: 'Run our 14 deterministic engines across headers, cookies, TLS, and bundles.',
      done: state.hasCompletedScan,
      href: '/dashboard/scans',
      actionLabel: 'Launch scan',
    },
    {
      id: 'fix',
      label: 'Review & verify a code fix',
      description: 'Apply an automated Next.js, Express, or Nginx code diff and run targeted re-test.',
      done: state.hasFixedFinding,
      href: '/dashboard/findings',
      actionLabel: 'Inspect findings',
    },
    {
      id: 'ci',
      label: 'Arm CI/CD quality gate',
      description: 'Add our GitHub Actions or GitLab CI breaker to prevent PR regressions.',
      done: state.hasCiGate,
      href: '/dashboard/scans',
      actionLabel: 'View CI snippet',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allCompleted = completedCount === steps.length;

  if (allCompleted) {
    return null; // As per spec: "Hide when all done. No fake progress."
  }

  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div
      style={{
        borderRadius: 'var(--ds-radius-xl)',
        backgroundColor: 'var(--ds-bg-card)',
        border: '1px solid var(--ds-border-strong)',
        boxShadow: 'var(--ds-shadow-2)',
        padding: '28px 32px',
        marginBottom: '24px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--ds-radius-md)',
              backgroundColor: 'rgba(255, 100, 45, 0.12)',
              color: 'var(--ds-action-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={17} />
          </div>
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--ds-text-primary)',
                margin: 0,
              }}
            >
              Get Started with Zerivex Security
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--ds-text-muted)', margin: 0 }}>
              Complete these steps to activate automated perimeter defense for your app.
            </p>
          </div>
        </div>

        {/* Progress bar pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '140px',
              height: '8px',
              borderRadius: 'var(--ds-radius-pill)',
              backgroundColor: 'var(--ds-bg-subtle)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: 'var(--ds-action-brand)',
                borderRadius: 'var(--ds-radius-pill)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-text-primary)', fontFamily: 'var(--font-mono)' }}>
            {completedCount}/{steps.length}
          </span>
        </div>
      </div>

      {/* Checklist items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {steps.map((step) => (
          <div
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '12px 16px',
              borderRadius: 'var(--ds-radius-md)',
              backgroundColor: step.done ? 'var(--ds-bg-subtle)' : 'transparent',
              border: '1px solid',
              borderColor: step.done ? 'transparent' : 'var(--ds-border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {step.done ? (
                <CheckCircle2 size={18} style={{ color: 'var(--ds-success)', flexShrink: 0 }} />
              ) : (
                <Circle size={18} style={{ color: 'var(--ds-text-muted)', flexShrink: 0 }} />
              )}
              <div>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: step.done ? 'var(--ds-text-muted)' : 'var(--ds-text-primary)',
                    textDecoration: step.done ? 'line-through' : 'none',
                  }}
                >
                  {step.label}
                </span>
                <p style={{ fontSize: '12px', color: 'var(--ds-text-muted)', margin: 0 }}>
                  {step.description}
                </p>
              </div>
            </div>

            {!step.done && (
              <Link
                href={step.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: 'var(--ds-radius-sm)',
                  backgroundColor: 'var(--ds-bg-card)',
                  border: '1px solid var(--ds-border-default)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ds-action-link)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span>{step.actionLabel}</span>
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default FirstRunChecklist;
