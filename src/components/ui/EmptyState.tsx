'use client';

import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        backgroundColor: 'var(--ds-bg-card)',
        border: '1px dashed var(--ds-border-default)',
        borderRadius: 'var(--ds-radius-lg)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--ds-radius-md)',
          backgroundColor: 'var(--ds-bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ds-text-secondary)',
          marginBottom: 16,
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '17px',
          fontWeight: 700,
          color: 'var(--ds-text-primary)',
          margin: '0 0 6px',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: '14px',
          color: 'var(--ds-text-secondary)',
          margin: '0 0 20px',
          maxWidth: '400px',
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      {actionLabel && (
        <Button
          variant="secondary"
          size="sm"
          href={actionHref}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
