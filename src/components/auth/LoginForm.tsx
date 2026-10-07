'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { StaggeredText } from '@/components/ui/StaggeredText';
import { AlertTriangle, Terminal } from 'lucide-react';

export interface LoginFormProps {
  className?: string;
}

export function LoginForm({ className = '' }: LoginFormProps) {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const returnTo = searchParams.get('returnTo');

  const cardRef = useRef<HTMLDivElement>(null);
  const providersRef = useRef<HTMLDivElement>(null);

  // Scoped GSAP entrance animation respecting reduced motion
  useGSAP(
    () => {
      const card = cardRef.current;
      const buttons = providersRef.current?.querySelectorAll('a');
      if (!card) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
        );

        if (buttons && buttons.length > 0) {
          gsap.fromTo(
            buttons,
            { opacity: 0, y: 6 },
            { opacity: 1, y: 0, duration: 0.25, stagger: 0.04, delay: 0.1, ease: 'power2.out' }
          );
        }
      });

      return () => mm.revert();
    },
    { scope: cardRef }
  );

  const getLoginUrl = (provider: string) => {
    const base = `/api/auth/login/${provider}`;
    return returnTo ? `${base}?returnTo=${encodeURIComponent(returnTo)}` : base;
  };

  const errorMessageMap: Record<string, string> = {
    invalid_state: 'Security verification failed (invalid CSRF state). Please retry authentication.',
    oauth_denied: 'Access was denied by the authentication provider.',
    missing_code_or_state: 'Authentication response was incomplete or timed out.',
    auth_failed: 'Authentication failed. Please verify your credentials and retry.',
    unsupported_provider: 'Authentication provider is not supported in this environment.',
  };

  return (
    <div className={`zal-card ${className}`} ref={cardRef}>
      {/* Brand Header */}
      <div className="zal-brand">
        <Link href="/" aria-label="Back to Zerivex home" style={{ textDecoration: 'none', display: 'inline-block' }}>
          <div className="zal-logo" aria-hidden="true">Z</div>
        </Link>
        <h1 className="zal-title">
          <StaggeredText text="Sign in to Zerivex" respectReducedMotion={true} />
        </h1>
        <p className="zal-subtitle">Security for software built with AI.</p>
      </div>

      {/* Error Presentation */}
      {error && (
        <div className="zal-error-box" role="alert" aria-live="polite">
          <AlertTriangle size={18} className="zal-error-icon" aria-hidden="true" />
          <div className="zal-error-content">
            <div className="zal-error-title">Authentication Error</div>
            <div className="zal-error-msg">
              {errorMessageMap[error] || 'An unexpected error occurred during authentication.'}
            </div>
            <div className="zal-error-hint">Please retry or select an alternative sign-in method.</div>
          </div>
        </div>
      )}

      {/* OAuth Providers & Development Access */}
      <div className="zal-providers" ref={providersRef}>
        {/* Google OAuth Button */}
        <a
          href={getLoginUrl('google')}
          className="zal-btn-oauth zal-btn-google"
          aria-label="Continue with Google authentication"
        >
          <span className="zal-provider-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
          </span>
          <span>Continue with Google</span>
        </a>

        {/* GitHub OAuth Button */}
        <a
          href={getLoginUrl('github')}
          className="zal-btn-oauth zal-btn-github"
          aria-label="Continue with GitHub authentication"
        >
          <span className="zal-provider-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </span>
          <span>Continue with GitHub</span>
        </a>

        {/* Divider: OR DEVELOPMENT ACCESS */}
        <div className="zal-divider" role="separator" aria-label="Development access options">
          <div className="zal-divider-line" />
          <span className="zal-divider-text">or development access</span>
          <div className="zal-divider-line" />
        </div>

        {/* Localhost Developer Access (Owner/Admin Sandbox) */}
        <a
          href={getLoginUrl('mock')}
          className="zal-btn-dev"
          aria-label="Localhost Developer sign-in, development environment only"
        >
          <div className="zal-dev-main">
            <Terminal size={15} aria-hidden="true" />
            <span>Localhost Developer</span>
          </div>
          <span className="zal-dev-sub">Development environment only (Owner / Admin)</span>
        </a>
      </div>

      {/* Trust & Legal Footer */}
      <div className="zal-footer">
        Protected by Zerivex autonomous security protocols.
        <br />
        By continuing, you agree to our Security &amp; Acceptable Use Policy.
      </div>
    </div>
  );
}
