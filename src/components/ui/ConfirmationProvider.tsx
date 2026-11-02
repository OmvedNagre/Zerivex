'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Modal } from './Modal';
import { Button } from './Button';

type Request = { message: string; reason?: boolean; initialValue?: string };
type ConfirmationApi = {
  confirm: (message: string) => Promise<boolean>;
  requestReason: (message: string, initialValue?: string) => Promise<string | null>;
};
const ConfirmationContext = createContext<ConfirmationApi | null>(null);
export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) throw new Error('ConfirmationProvider is required');
  return context;
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const [reason, setReason] = useState('');
  const resolveRef = useRef<((value: boolean | string | null) => void) | null>(null);
  const pathname = usePathname();
  const finish = useCallback((value: boolean | string | null) => {
    resolveRef.current?.(value); resolveRef.current = null; setRequest(null);
  }, []);
  useEffect(() => {
    setRequest(null);
    return () => { resolveRef.current?.(null); resolveRef.current = null; };
  }, [pathname]);
  const ask = useCallback((next: Request) => {
    if (resolveRef.current) return Promise.resolve(null);
    setReason(next.initialValue || ''); setRequest(next);
    return new Promise<boolean | string | null>((resolve) => { resolveRef.current = resolve; });
  }, []);
  const api: ConfirmationApi = {
    confirm: async (message) => (await ask({ message })) === true,
    requestReason: async (message, initialValue) => {
      const value = await ask({ message, reason: true, initialValue });
      return typeof value === 'string' ? value : null;
    },
  };
  return <ConfirmationContext.Provider value={api}>
    {children}
    <Modal isOpen={request !== null} onClose={() => finish(null)} title={request?.reason ? 'Provide an operational reason' : 'Confirm action'}
      role="alertdialog" description={request?.message} className={pathname.startsWith('/staff') ? 'staff-dialog' : 'zx-customer-dialog'} size="sm">
      {request?.reason && <label className="zx-confirm-reason">Reason
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={1000} />
      </label>}
      <div className="zx-confirm-actions">
        <Button onClick={() => finish(null)}>Cancel</Button>
        <Button variant="brand" disabled={request?.reason && reason.trim().length < 5}
          onClick={() => finish(request?.reason ? reason.trim() : true)}>Confirm action</Button>
      </div>
    </Modal>
  </ConfirmationContext.Provider>;
}
