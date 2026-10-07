'use client';

import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  width = '100%',
  height = '20px',
  style,
  className = '',
  ...props
}: SkeletonProps) {
  return (
    <div
      className={`zx-skeleton ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}
