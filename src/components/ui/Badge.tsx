'use client';

import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'mint' | 'butter' | 'lilac' | 'danger';
  icon?: React.ReactNode;
}

export function Badge({
  children,
  variant = 'default',
  icon,
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span className={`zx-badge zx-badge--${variant} ${className}`} {...props}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
