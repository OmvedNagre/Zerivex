'use client';

import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ className = '', style, ...props }: AccordionPrimitive.AccordionItemProps) {
  return (
    <AccordionPrimitive.Item
      className={`zx-accordion-item ${className}`}
      style={{
        borderBottom: '1px solid var(--ds-border-subtle)',
        ...style,
      }}
      {...props}
    />
  );
}

export function AccordionTrigger({
  children,
  className = '',
  style,
  ...props
}: AccordionPrimitive.AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header style={{ margin: 0 }}>
      <AccordionPrimitive.Trigger
        className={`zx-accordion-trigger ${className}`}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0',
          backgroundColor: 'transparent',
          border: 'none',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--ds-text-primary)',
          cursor: 'pointer',
          textAlign: 'left',
          ...style,
        }}
        {...props}
      >
        {children}
        <ChevronDown size={16} className="zx-accordion-chevron" style={{ transition: 'transform 0.2s var(--ds-ease)' }} />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  children,
  className = '',
  style,
  ...props
}: AccordionPrimitive.AccordionContentProps) {
  return (
    <AccordionPrimitive.Content
      className={`zx-accordion-content ${className}`}
      style={{
        paddingBottom: '16px',
        fontSize: '14px',
        color: 'var(--ds-text-secondary)',
        lineHeight: 1.6,
        ...style,
      }}
      {...props}
    >
      {children}
    </AccordionPrimitive.Content>
  );
}
