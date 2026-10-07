'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className = '', style, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={`zx-tabs-list ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: 'var(--ds-bg-subtle)',
        padding: '4px',
        borderRadius: 'var(--ds-radius-pill)',
        border: '1px solid var(--ds-border-subtle)',
        ...style,
      }}
      {...props}
    />
  );
}

export function TabsTrigger({ className = '', style, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={`zx-tabs-trigger ${className}`}
      style={{
        padding: '6px 14px',
        fontSize: '13px',
        fontWeight: 600,
        borderRadius: 'var(--ds-radius-pill)',
        border: 'none',
        backgroundColor: 'transparent',
        color: 'var(--ds-text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s var(--ds-ease)',
        ...style,
      }}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;
