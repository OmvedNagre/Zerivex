'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  variant?: 'default' | 'ink';
}

export function Card({
  children,
  interactive = false,
  variant = 'default',
  className = '',
  ...props
}: CardProps) {
  const classNames = `zx-card ${interactive ? 'zx-card--interactive' : ''} ${variant === 'ink' ? 'zx-card--ink' : ''} ${className}`;
  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
}
