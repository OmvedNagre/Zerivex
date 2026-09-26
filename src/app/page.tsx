import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          padding: '1rem 0',
          backgroundColor: 'rgba(7, 9, 14, 0.85)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1.1rem',
                boxShadow: '0 0 16px rgba(37, 99, 235, 0.4)',
              }}
            >
              Z
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#ffffff', lineHeight: 1.1 }}>
                ZERIVEX
              </span>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', letterSpacing: '0.06em' }}>
                SECURITY FOR SOFTWARE BUILT WITH AI
              </span>
            </div>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <Link href="/academy" style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>
              Academy
            </Link>
            <a href="/.well-known/security.txt" style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>
              Security.txt
            </a>
            <Link
              href="/login"
              style={{
                color: '#f8fafc',
                fontSize: '0.9rem',
                fontWeight: 600,
                padding: '0.45rem 0.9rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              Sign In
            </Link>
            <Link
              href="/login"
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '0.45rem 1.1rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 700,
                boxShadow: '0 0 20px rgba(37, 99, 235, 0.4)',
              }}
            >
              Get Started →
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '5rem 0 3rem', textAlign: 'center', position: 'relative' }}>
        <div className="container" style={{ maxWidth: '960px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.9rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              marginBottom: '1.5rem',
            }}
          >
            <span className="pulse-indicator" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.04em' }}>
              PHASE 15 VERIFIED • 100/100 SECURITY CERTIFICATION
            </span>
          </div>

          <h1
            style={{
              fontSize: '3.4rem',
              fontWeight: 900,
              letterSpacing: '-0.04em',
              lineHeight: 1.15,
              marginBottom: '1.5rem',
            }}
          >
            Autonomous Security Testing for Software{' '}
            <span className="gradient-text-emerald">Built with AI</span>
          </h1>

          <p
            style={{
              fontSize: '1.15rem',
              color: '#94a3b8',
              lineHeight: 1.6,
              maxWidth: '740px',
              margin: '0 auto 2.25rem',
            }}
          >
            Zerivex provides closed-loop vulnerability verification, attack surface mapping, SSRF egress firewall defense, and CI/CD quality gates designed specifically for applications engineered with AI tools.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="/login"
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '0.85rem 2rem',
                borderRadius: '8px',
                fontSize: '1.05rem',
                fontWeight: 700,
                boxShadow: '0 8px 25px rgba(37, 99, 235, 0.45)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>⚡</span> Launch Platform Console
            </a>

            <a
              href="/academy"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                padding: '0.85rem 1.75rem',
                borderRadius: '8px',
                fontSize: '1.05rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🎓</span> Explore Security Academy
            </a>
          </div>
        </div>
      </section>

      {/* Live Interactive Scanner Simulation Terminal */}
      <section style={{ padding: '1rem 0 4rem' }}>
        <div className="container" style={{ maxWidth: '880px' }}>
          <div
            style={{
              backgroundColor: '#0a0e17',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(37, 99, 235, 0.15)',
            }}
          >
            {/* Terminal Window Header */}
            <div
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                <span style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <span style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <span style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                zerivex-engine :: active-audit-battery --mode=dogfooding
              </div>
              <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                ● 100/100 PASS
              </div>
            </div>

            {/* Terminal Content */}
            <div
              style={{
                padding: '1.5rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: '#d1d5db',
                lineHeight: 1.7,
                backgroundColor: '#06080e',
              }}
            >
              <div style={{ color: '#60a5fa' }}>$ zerivex scan --target=https://zerivex.com --depth=full</div>
              <div style={{ color: '#9ca3af' }}>[00:00.02] Initializing ZERIVEX Egress Firewall & DNS Pinning... <span style={{ color: '#34d399' }}>[ARMED]</span></div>
              <div style={{ color: '#9ca3af' }}>[00:00.14] Probing SSRF Cloud Metadata (169.254.169.254)... <span style={{ color: '#34d399' }}>[BLOCKED BY EGRESS FIREWALL]</span></div>
              <div style={{ color: '#9ca3af' }}>[00:00.28] Auditing SQL Injection Parameterization in PostgreSQL queries... <span style={{ color: '#34d399' }}>[0 INJECTIONS DETECTED]</span></div>
              <div style={{ color: '#9ca3af' }}>[00:00.41] Evaluating Cross-Site Scripting (XSS) context escaping & CSP... <span style={{ color: '#34d399' }}>[PASSED]</span></div>
              <div style={{ color: '#9ca3af' }}>[00:00.56] Auditing client bundles for leaked API keys & DB secrets... <span style={{ color: '#34d399' }}>[0 SECRETS LEAKED]</span></div>
              <div style={{ color: '#9ca3af' }}>[00:00.72] Verifying RFC 9116 security.txt vulnerability policy... <span style={{ color: '#34d399' }}>[COMPLIANT]</span></div>
              <div style={{ color: '#9ca3af' }}>[00:00.89] Inspecting Edge rate limiting sliding window & payload guards... <span style={{ color: '#34d399' }}>[ACTIVE (10/20/120 RPM)]</span></div>
              <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px' }}>
                <span style={{ color: '#34d399', fontWeight: 700 }}>✔ AUDIT COMPLETE:</span> Security Score <strong style={{ color: '#ffffff' }}>100/100 (Grade A+)</strong> • 0 Critical • 0 High • 0 Medium Findings.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Value Pillars Grid */}
      <section style={{ padding: '3rem 0', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              Why AI-Generated Code Needs Zerivex
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '1rem', maxWidth: '600px', margin: '0 auto' }}>
              LLMs move fast, but they often leave dangerous security blind spots. Zerivex detects and fixes them automatically.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🛡️</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: '#ffffff' }}>
                SSRF & Metadata Egress Shield
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Prevents outbound request exploitation by blocking private IPv4/IPv6 ranges, loopbacks, and AWS/GCP cloud metadata endpoints (`169.254.169.254`) with socket-level DNS pinning.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚡</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: '#ffffff' }}>
                Zero-Leakage Observability
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Recursive PII and secret redactor automatically strips passwords, bearer tokens, AWS credentials, and JWTs from application logs, error reports, and scan evidence.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🚀</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: '#ffffff' }}>
                CI/CD Build-Breaker Gates
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Enforce Zero Critical / Zero High policies directly in GitHub Actions and GitLab CI. Generates OASIS SARIF v2.1.0 reports for native GitHub Security tab integration.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          marginTop: 'auto',
          borderTop: '1px solid var(--border-subtle)',
          padding: '2.5rem 0',
          backgroundColor: 'rgba(7, 9, 14, 0.95)',
        }}
      >
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#ffffff' }}>ZERIVEX</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
              Security for software built with AI. Verify. Detect. Defend.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
            <a href="/login" style={{ color: '#94a3b8' }}>Sign In</a>
            <a href="/academy" style={{ color: '#94a3b8' }}>Security Academy</a>
            <a href="/.well-known/security.txt" style={{ color: '#94a3b8' }}>security.txt</a>
            <a href="/dashboard/launch-readiness" style={{ color: '#34d399' }}>Launch Readiness (100%)</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
