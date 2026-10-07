'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';

export function Switch({
  className = '',
  style,
  ...props
}: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={`zx-switch ${className}`}
      style={{
        width: 42,
        height: 24,
        backgroundColor: 'var(--ds-bg-subtle)',
        borderRadius: 'var(--ds-radius-pill)',
        border: '1px solid var(--ds-border-default)',
        position: 'relative',
        cursor: 'pointer',
        outline: 'none',
        ...style,
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb
        style={{
          display: 'block',
          width: 18,
          height: 18,
          backgroundColor: '#FFFFFF',
          borderRadius: '50%',
          boxShadow: 'var(--ds-shadow-1)',
          transition: 'transform 0.15s var(--ds-ease)',
          transform: props.checked ? 'translateX(20px)' : 'translateX(2px)',
        }}
      />
    </SwitchPrimitive.Root>
  );
}
