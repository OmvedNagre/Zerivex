import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginForm } from '@/components/auth/LoginForm';

// Mock next/navigation
let mockError: string | null = null;
let mockReturnTo: string | null = null;

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'error') return mockError;
      if (key === 'returnTo') return mockReturnTo;
      return null;
    },
  }),
}));

describe('Component 12 — Login Form, OAuth Buttons & Developer Access', () => {
  it('1. Renders LoginForm with brand identity and title', () => {
    mockError = null;
    mockReturnTo = null;

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain('zal-card');
    expect(html).toContain('zal-logo');
    expect(html).toContain('Sign in to Zerivex');
    expect(html).toContain('Security for software built with AI.');
  });

  it('2. Renders Google OAuth button with official brand icon and accessible label', () => {
    mockError = null;
    mockReturnTo = null;

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain('zal-btn-google');
    expect(html).toContain('href="/api/auth/login/google"');
    expect(html).toContain('Continue with Google');
    expect(html).toContain('aria-label="Continue with Google authentication"');
    // Four-color Google G SVG check
    expect(html).toContain('#4285F4');
    expect(html).toContain('#34A853');
    expect(html).toContain('#FBBC05');
    expect(html).toContain('#EA4335');
  });

  it('3. Renders GitHub OAuth button with official Octocat icon and accessible label', () => {
    mockError = null;
    mockReturnTo = null;

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain('zal-btn-github');
    expect(html).toContain('href="/api/auth/login/github"');
    expect(html).toContain('Continue with GitHub');
    expect(html).toContain('aria-label="Continue with GitHub authentication"');
  });

  it('4. Renders Localhost Developer button as clearly scoped development access', () => {
    mockError = null;
    mockReturnTo = null;

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain('zal-btn-dev');
    expect(html).toContain('href="/api/auth/login/mock"');
    expect(html).toContain('Localhost Developer');
    expect(html).toContain('Development environment only (Owner / Admin)');
    expect(html).toContain('or development access');
  });

  it('5. Correctly forwards returnTo query parameter to OAuth and Developer URLs', () => {
    mockError = null;
    mockReturnTo = '/dashboard/scans/scan-123';

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain('href="/api/auth/login/google?returnTo=%2Fdashboard%2Fscans%2Fscan-123"');
    expect(html).toContain('href="/api/auth/login/github?returnTo=%2Fdashboard%2Fscans%2Fscan-123"');
    expect(html).toContain('href="/api/auth/login/mock?returnTo=%2Fdashboard%2Fscans%2Fscan-123"');
  });

  it('6. Displays structured diagnostic error banner when invalid_state occurs', () => {
    mockError = 'invalid_state';
    mockReturnTo = null;

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain('zal-error-box');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Authentication Error');
    expect(html).toContain('Security verification failed (invalid CSRF state). Please retry authentication.');
    expect(html).toContain('Please retry or select an alternative sign-in method.');
  });

  it('7. Displays structured diagnostic error banner when oauth_denied occurs', () => {
    mockError = 'oauth_denied';
    mockReturnTo = null;

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain('Access was denied by the authentication provider.');
  });

  it('8. Displays structured diagnostic error banner when auth_failed occurs', () => {
    mockError = 'auth_failed';
    mockReturnTo = null;

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain('Authentication failed. Please verify your credentials and retry.');
  });

  it('9. Enforces Zero AI-Slop: No emojis (⚡, 🛡️, 🚀) in rendered output', () => {
    mockError = null;
    mockReturnTo = null;

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).not.toContain('⚡');
    expect(html).not.toContain('🛡️');
    expect(html).not.toContain('🚀');
    expect(html).not.toContain('🔐');
  });

  it('10. Renders security & acceptable use policy trust footnote', () => {
    mockError = null;
    mockReturnTo = null;

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain('zal-footer');
    expect(html).toContain('Protected by Zerivex autonomous security protocols.');
    expect(html).toContain('By continuing, you agree to our Security &amp; Acceptable Use Policy.');
  });
});
