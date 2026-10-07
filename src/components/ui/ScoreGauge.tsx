'use client';

import { useEffect, useRef } from 'react';
import { animateGauge } from '@/lib/gsap';

export interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export function ScoreGauge({
  score,
  size = 72,
  strokeWidth = 6,
  showLabel = true,
}: ScoreGaugeProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const clampedScore = Math.max(0, Math.min(100, score));

  // Determine grade and color
  let grade = 'F';
  let color = 'var(--ds-danger)';
  if (clampedScore >= 90) {
    grade = 'A+';
    color = 'var(--ds-success)';
  } else if (clampedScore >= 80) {
    grade = 'A';
    color = 'var(--ds-info)';
  } else if (clampedScore >= 70) {
    grade = 'B';
    color = 'var(--ds-warning)';
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (circleRef.current) {
      animateGauge(circleRef.current, clampedScore);
    }
  }, [clampedScore]);

  return (
    <div
      className="zx-score-gauge"
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Security score: ${clampedScore} out of 100, Grade ${grade}`}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ds-border-subtle)"
          strokeWidth={strokeWidth}
        />
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clampedScore / 100)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s var(--ds-ease)' }}
        />
      </svg>
      {showLabel && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: size > 60 ? '16px' : '12px',
              fontWeight: 700,
              lineHeight: 1,
              color: 'var(--ds-text-primary)',
            }}
          >
            {clampedScore}
          </span>
          <span
            style={{
              fontSize: size > 60 ? '10px' : '9px',
              fontWeight: 600,
              color,
              marginTop: 2,
            }}
          >
            {grade}
          </span>
        </div>
      )}
    </div>
  );
}
