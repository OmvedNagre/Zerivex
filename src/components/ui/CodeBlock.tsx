'use client';

import React from 'react';
import { CopyButton } from './CopyButton';

export interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CodeBlock({
  code,
  language = 'bash',
  filename,
  className = '',
  style,
}: CodeBlockProps) {
  return (
    <div className={`zx-code-block ${className}`} style={style}>
      <div className="zx-code-block__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
          </div>
          <span style={{ fontSize: '12px', color: 'var(--ds-text-on-ink-dim)', marginLeft: 4 }}>
            {filename || language}
          </span>
        </div>
        <CopyButton value={code} style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'transparent' }} />
      </div>
      <pre className="zx-code-block__content">
        <code>{code}</code>
      </pre>
    </div>
  );
}
