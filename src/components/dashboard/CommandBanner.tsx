'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import {
  Rocket,
  Crosshair,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react';
import { StaggeredText } from '@/components/ui/StaggeredText';

export interface DashboardStats {
  score: number;
  grade: string;
  targetsCount: number;
  scansCount: number;
  findingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  launchReadinessScore: number;
  subsystemsCount: number;
}

export interface CommandBannerProps {
  user?: {
    displayName?: string | null;
    email?: string | null;
  } | null;
  stats: DashboardStats;
  loading?: boolean;
}

export function CommandBanner({ user, stats, loading = false }: CommandBannerProps) {
  const scoreNumberRef = useRef<HTMLSpanElement>(null);
  const meterFillRef = useRef<HTMLDivElement>(null);
  const scoreValRef = useRef({ val: 0 });
  const hasAnimated = useRef(false);

  // Dynamic values
  const userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'Operator';
  const targetCount = stats?.targetsCount || 0;
  const targetCountLabel =
    targetCount === 1 ? '1 verified target' : `${targetCount} verified targets`;

  const crit = stats?.findingsCount?.critical || 0;
  const high = stats?.findingsCount?.high || 0;
  const med = stats?.findingsCount?.medium || 0;
  const low = stats?.findingsCount?.low || 0;
  const totalOpenFindings = crit + high + med + low;
  const critHigh = crit + high;

  const score = typeof stats?.score === 'number' ? stats.score : 100;
  const grade = stats?.grade || (score === 100 ? 'A+' : score >= 90 ? 'A' : score >= 70 ? 'B' : 'C');
  const readinessScore = typeof stats?.launchReadinessScore === 'number' ? stats.launchReadinessScore : 100;

  // Semantic posture tone
  const postureToneClass =
    score >= 90 ? 'tone-emerald' : score >= 70 ? 'tone-warning' : 'tone-danger';

  // GSAP score counter tween with prefers-reduced-motion check
  useEffect(() => {
    if (!scoreNumberRef.current) return;

    const mm = gsap.matchMedia();
    mm.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        allowMotion: '(prefers-reduced-motion: no-preference)',
      },
      (context) => {
        const { reduceMotion } = context.conditions as { reduceMotion?: boolean };

        const targetScale = Math.min(Math.max(score, 0), 100) / 100;

        if (reduceMotion) {
          // Immediate presentation with zero counter animation
          if (scoreNumberRef.current) scoreNumberRef.current.textContent = String(score);
          if (meterFillRef.current) {
            meterFillRef.current.style.transform = `scaleX(${targetScale})`;
          }
          return;
        }

        // Entrance animation on initial mount
        if (!hasAnimated.current) {
          hasAnimated.current = true;
          scoreValRef.current.val = 0;

          gsap.to(scoreValRef.current, {
            val: score,
            duration: 0.85,
            ease: 'power2.out',
            onUpdate: () => {
              if (scoreNumberRef.current) {
                scoreNumberRef.current.textContent = Math.round(scoreValRef.current.val).toString();
              }
            },
          });

          if (meterFillRef.current) {
            gsap.fromTo(
              meterFillRef.current,
              { scaleX: 0 },
              {
                scaleX: targetScale,
                duration: 0.85,
                ease: 'power2.out',
              }
            );
          }
        } else {
          // Soft transition if score changes dynamically
          gsap.to(scoreValRef.current, {
            val: score,
            duration: 0.45,
            ease: 'power1.out',
            onUpdate: () => {
              if (scoreNumberRef.current) {
                scoreNumberRef.current.textContent = Math.round(scoreValRef.current.val).toString();
              }
            },
          });

          if (meterFillRef.current) {
            gsap.to(meterFillRef.current, {
              scaleX: targetScale,
              duration: 0.45,
              ease: 'power1.out',
            });
          }
        }
      }
    );

    return () => mm.revert();
  }, [score]);

  return (
    <section
      className="zb-command-banner"
      aria-label="Security Posture Command Center"
      data-loading={loading ? 'true' : 'false'}
    >
      {/* Primary Command Briefing & Actions */}
      <div className="zb-command-content">
        <div className="zb-status-badge" role="status" aria-live="polite">
          <span className="zb-status-dot" aria-hidden="true" />
          <span className="zb-status-text">AUTONOMOUS CONTINUOUS DEFENSE</span>
          <span className="zb-status-divider" aria-hidden="true">
            •
          </span>
          <span className="zb-status-sub">ACTIVE PROTECTION</span>
        </div>

        <h1 className="zb-title">
          <StaggeredText
            text="Security Posture Command Center"
            staggerDuration={0.02}
            initialDelay={0.05}
          />
        </h1>

        <p className="zb-subtitle">
          Welcome back, <strong className="zb-username">{userDisplayName}</strong>. Workspace
          currently protected across{' '}
          <span className="zb-mono-stat">{targetCountLabel}</span>. Real-time deterministic
          vulnerability verification and SSRF egress enforcement.
        </p>

        <div className="zb-actions" role="group" aria-label="Primary Security Actions">
          <a
            href="/dashboard/launch-readiness"
            className="zb-btn zb-btn-primary"
            id="cta-launch-readiness"
          >
            <Rocket size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>Launch Readiness Cockpit</span>
            <span className="zb-btn-badge">{readinessScore}%</span>
          </a>

          <a
            href="/dashboard/targets"
            className="zb-btn zb-btn-secondary"
            id="cta-manage-targets"
          >
            <Crosshair size={15} strokeWidth={2} aria-hidden="true" />
            <span>Manage Targets</span>
          </a>

          <a
            href="/academy"
            className="zb-btn zb-btn-ghost"
            id="cta-security-academy"
          >
            <BookOpen size={15} strokeWidth={2} aria-hidden="true" />
            <span>Security Academy</span>
          </a>
        </div>
      </div>

      {/* Empirical Posture Score Summary Card */}
      <aside className="zb-score-card" aria-label="Empirical Security Posture Summary">
        <div className="zb-score-header">
          <span className="zb-score-kicker">EMPIRICAL POSTURE</span>
          <span className={`zb-posture-pill ${postureToneClass}`}>
            <ShieldCheck size={12} strokeWidth={2.2} aria-hidden="true" />
            GRADE {grade}
          </span>
        </div>

        <div className="zb-score-row">
          <span
            ref={scoreNumberRef}
            className={`zb-score-number ${postureToneClass}`}
            aria-label={`Security score: ${score} out of 100`}
          >
            {score}
          </span>
          <span className="zb-score-denom" aria-hidden="true">
            /100
          </span>
        </div>

        <div
          className="zb-score-meter"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Empirical Security Posture Progress"
        >
          <div
            ref={meterFillRef}
            className={`zb-meter-fill ${postureToneClass}`}
            style={{ transform: `scaleX(${Math.min(Math.max(score, 0), 100) / 100})` }}
          />
        </div>

        <div className="zb-score-footer">
          {totalOpenFindings === 0 ? (
            <span className="zb-defect-clean">
              <CheckCircle2 size={13} strokeWidth={2.2} aria-hidden="true" />
              ZERO ACTIVE DEFECTS
            </span>
          ) : critHigh > 0 ? (
            <span className="zb-defect-critical">
              <AlertOctagon size={13} strokeWidth={2.2} aria-hidden="true" />
              {critHigh} CRIT/HIGH DEFECTS
            </span>
          ) : (
            <span className="zb-defect-active">
              <AlertTriangle size={13} strokeWidth={2.2} aria-hidden="true" />
              {totalOpenFindings} ACTIVE FINDINGS
            </span>
          )}
          <span className="zb-score-timestamp">VERIFIED AUDIT</span>
        </div>
      </aside>
    </section>
  );
}
