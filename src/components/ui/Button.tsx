'use client';

import React from 'react';
import Link from 'next/link';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'brand' | 'secondary' | 'ghost' | 'inverse';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      href,
      icon,
      loading = false,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const classNames = `zx-btn zx-btn--${variant} zx-btn--${size} ${className}`;

    if (href) {
      return (
        <Link href={href} className={classNames} style={props.style}>
          {icon && <span aria-hidden="true">{icon}</span>}
          {children}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={classNames}
        {...props}
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
