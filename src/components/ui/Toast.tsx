'use client';

import { Toaster as SonnerToaster, toast } from 'sonner';

export { toast };

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--ds-bg-card)',
          color: 'var(--ds-text-primary)',
          border: '1px solid var(--ds-border-default)',
          boxShadow: 'var(--ds-shadow-2)',
          fontFamily: 'var(--font-sans)',
          borderRadius: 'var(--ds-radius-md)',
        },
      }}
    />
  );
}
