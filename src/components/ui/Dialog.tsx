'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({ className = '', ...props }: DialogPrimitive.DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      className={`zx-dialog-overlay ${className}`}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(20, 22, 28, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 500,
      }}
      {...props}
    />
  );
}

export function DialogContent({
  children,
  title,
  description,
  className = '',
  ...props
}: DialogPrimitive.DialogContentProps & { title?: string; description?: string }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={`zx-dialog-content ${className}`}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--ds-bg-card)',
          borderRadius: 'var(--ds-radius-lg)',
          border: '1px solid var(--ds-border-default)',
          boxShadow: 'var(--ds-shadow-3)',
          width: '90vw',
          maxWidth: '560px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '24px',
          zIndex: 510,
        }}
        {...props}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            {title && (
              <DialogPrimitive.Title
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--ds-text-primary)',
                  margin: 0,
                }}
              >
                {title}
              </DialogPrimitive.Title>
            )}
            {description && (
              <DialogPrimitive.Description
                style={{
                  fontSize: '14px',
                  color: 'var(--ds-text-secondary)',
                  marginTop: 4,
                }}
              >
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogClose asChild>
            <button
              type="button"
              className="zx-btn zx-btn--ghost"
              style={{ width: 32, height: 32, padding: 0, borderRadius: 'var(--ds-radius-sm)' }}
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </DialogClose>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
