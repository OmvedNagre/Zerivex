'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CopyButton({
  value,
  label,
  className = '',
  style,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback if clipboard API is blocked
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`zx-btn zx-btn--secondary zx-btn--sm ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '28px',
        padding: '0 10px',
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
        ...style,
      }}
      aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
    >
      {copied ? (
        <>
          <Check size={13} style={{ color: 'var(--ds-success)' }} />
          <span>{label ? 'Copied!' : 'Copied'}</span>
        </>
      ) : (
        <>
          <Copy size={13} />
          <span>{label || 'Copy'}</span>
        </>
      )}
    </button>
  );
}
