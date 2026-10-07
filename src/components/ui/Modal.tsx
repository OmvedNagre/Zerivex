'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import gsap from 'gsap';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: ModalSize;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  closeButtonLabel?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  className?: string;
  overlayClassName?: string;
  preventScroll?: boolean;
  footer?: React.ReactNode;
  role?: 'dialog' | 'alertdialog';
}

/* ==========================================================================
   GLOBAL SCROLL-LOCK REFERENCE COUNTER
   ========================================================================== */
let modalLockCount = 0;
let originalOverflow = '';
let originalPaddingRight = '';

function lockBodyScroll() {
  if (typeof window === 'undefined') return;
  if (modalLockCount === 0) {
    originalOverflow = document.body.style.overflow;
    originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  modalLockCount++;
}

function unlockBodyScroll() {
  if (typeof window === 'undefined') return;
  modalLockCount--;
  if (modalLockCount <= 0) {
    modalLockCount = 0;
    document.body.style.overflow = originalOverflow;
    document.body.style.paddingRight = originalPaddingRight;
  }
}

/* ==========================================================================
   MODAL CONTEXT FOR COMPOUND COMPONENTS
   ========================================================================== */
interface ModalContextValue {
  onClose: () => void;
  titleId: string;
  descriptionId: string;
  showCloseButton: boolean;
  closeButtonLabel: string;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModalContext() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('Modal compound components must be rendered within a <Modal>');
  }
  return context;
}

/* ==========================================================================
   FOCUS TRAPPING UTILITY
   ========================================================================== */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/* ==========================================================================
   MAIN MODAL PRIMITIVE
   ========================================================================== */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  closeOnEscape = true,
  closeOnOverlayClick = true,
  showCloseButton = true,
  closeButtonLabel = 'Close dialog',
  initialFocusRef,
  returnFocusRef,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  className = '',
  overlayClassName = '',
  preventScroll = true,
  footer,
  role = 'dialog',
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Generate stable accessible IDs
  const generatedId = useId();
  const titleId = ariaLabelledBy || `modal-title-${generatedId}`;
  const descriptionId = ariaDescribedBy || `modal-desc-${generatedId}`;

  // Track hydration for SSR safety
  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll locking with reference counting
  useEffect(() => {
    if (!isOpen || !preventScroll) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isOpen, preventScroll]);

  // Focus management: capture previous focus, set initial focus, restore on close
  useEffect(() => {
    if (!isOpen) return;

    // Capture currently focused element before modal activates
    if (typeof document !== 'undefined') {
      previousFocusRef.current = (document.activeElement as HTMLElement) || null;
    }

    // Set initial focus after render
    const timer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (dialogRef.current) {
        // Look for the first interactive element that isn't the close button if inputs exist
        const focusableElements = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);

        // Prefer first form input if available
        const firstInput = focusableElements.find((el) =>
          ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
        );

        if (firstInput) {
          firstInput.focus();
        } else {
          const firstEl = focusableElements[0];
          if (firstEl) {
            firstEl.focus();
          } else {
            dialogRef.current?.focus();
          }
        }
      }
    }, 20);

    return () => {
      clearTimeout(timer);
      // Restore focus to returnFocusRef or previously focused trigger
      const elementToFocus = returnFocusRef?.current || previousFocusRef.current;
      if (elementToFocus && typeof elementToFocus.focus === 'function') {
        try {
          elementToFocus.focus();
        } catch {
          // Element may have been unmounted or detached; fail safely
        }
      }
    };
  }, [isOpen, initialFocusRef, returnFocusRef]);

  // Keyboard navigation: Escape key listener and Tab focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Escape dismissal
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation();
        onClose();
        return;
      }

      // 2. Tab focus trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null && !el.hasAttribute('disabled'));

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!firstElement || !lastElement) return;

        if (e.shiftKey) {
          // Shift + Tab: if on first element, wrap around to last
          if (document.activeElement === firstElement || document.activeElement === dialogRef.current) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, wrap around to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeOnEscape, onClose]);

  // GSAP entrance animation with reduced-motion support
  useEffect(() => {
    if (!isOpen || !overlayRef.current || !dialogRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.18, ease: 'power2.out' }
      );
      gsap.fromTo(
        dialogRef.current,
        { opacity: 0, y: 10, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power2.out' }
      );
    }
  }, [isOpen]);

  // Handle overlay backdrop click safely
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnOverlayClick && e.target === overlayRef.current) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  if (!isOpen) return null;

  // Determine accessibility label association
  const hasTitle = Boolean(title);
  const hasDesc = Boolean(description);
  const effectiveAriaLabelledBy = ariaLabelledBy || (hasTitle ? titleId : undefined);
  const effectiveAriaDescribedBy = ariaDescribedBy || (hasDesc ? descriptionId : undefined);

  const contextValue: ModalContextValue = {
    onClose,
    titleId,
    descriptionId,
    showCloseButton,
    closeButtonLabel,
  };

  const modalMarkup = (
    <ModalContext.Provider value={contextValue}>
      <div
        ref={overlayRef}
        className={`zmd-overlay ${overlayClassName}`}
        onClick={handleOverlayClick}
        role="presentation"
      >
        <div
          ref={dialogRef}
          role={role}
          aria-modal="true"
          aria-labelledby={effectiveAriaLabelledBy}
          aria-describedby={effectiveAriaDescribedBy}
          aria-label={!effectiveAriaLabelledBy ? ariaLabel : undefined}
          tabIndex={-1}
          className={`zmd-dialog zmd-size-${size} ${className}`}
        >
          {/* Default Header when title prop is provided */}
          {hasTitle && (
            <ModalHeader>
              <div className="zmd-header-content">
                <ModalTitle id={titleId}>{title}</ModalTitle>
                {hasDesc && (
                  <ModalDescription id={descriptionId}>
                    {description}
                  </ModalDescription>
                )}
              </div>
              {showCloseButton && (
                <ModalCloseButton label={closeButtonLabel} />
              )}
            </ModalHeader>
          )}

          {/* Children / Body content */}
          {hasTitle ? <ModalBody>{children}</ModalBody> : children}

          {/* Optional Footer */}
          {footer && <ModalFooter>{footer}</ModalFooter>}
        </div>
      </div>
    </ModalContext.Provider>
  );

  // During SSR or static markup generation (Vitest renderToStaticMarkup), render directly
  if (!mounted || typeof document === 'undefined') {
    return modalMarkup;
  }

  // On client, render into document.body portal
  return createPortal(modalMarkup, document.body);
}

/* ==========================================================================
   COMPOUND SUBCOMPONENTS
   ========================================================================== */

export interface ModalHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalHeader({ children, className = '' }: ModalHeaderProps) {
  return <header className={`zmd-header ${className}`}>{children}</header>;
}

export interface ModalTitleProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export function ModalTitle({ children, id, className = '' }: ModalTitleProps) {
  const context = useContext(ModalContext);
  const effectiveId = id || context?.titleId;

  return (
    <h2 id={effectiveId} className={`zmd-title ${className}`}>
      {children}
    </h2>
  );
}

export interface ModalDescriptionProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export function ModalDescription({
  children,
  id,
  className = '',
}: ModalDescriptionProps) {
  const context = useContext(ModalContext);
  const effectiveId = id || context?.descriptionId;

  return (
    <p id={effectiveId} className={`zmd-description ${className}`}>
      {children}
    </p>
  );
}

export interface ModalCloseButtonProps {
  onClick?: () => void;
  label?: string;
  className?: string;
}

export function ModalCloseButton({
  onClick,
  label,
  className = '',
}: ModalCloseButtonProps) {
  const context = useContext(ModalContext);
  const handleClick = onClick || context?.onClose;
  const effectiveLabel = label || context?.closeButtonLabel || 'Close dialog';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`zmd-close-btn ${className}`}
      aria-label={effectiveLabel}
      title={`${effectiveLabel} (Escape)`}
    >
      <X size={18} aria-hidden="true" />
    </button>
  );
}

export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className = '' }: ModalBodyProps) {
  return <div className={`zmd-body ${className}`}>{children}</div>;
}

export interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return <footer className={`zmd-footer ${className}`}>{children}</footer>;
}

// Attach subcomponents for compound usage: <Modal.Header>, <Modal.Body>, etc.
Modal.Header = ModalHeader;
Modal.Title = ModalTitle;
Modal.Description = ModalDescription;
Modal.CloseButton = ModalCloseButton;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export default Modal;
