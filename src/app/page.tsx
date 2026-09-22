export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          padding: '1.25rem 0',
          backgroundColor: 'rgba(10, 13, 18, 0.8)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          className="container"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                letterSpacing: '0.05em',
              }}
            >
              Z
            </span>
            <span style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
              ZERIVEX
            </span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <a href="/login" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Sign In
            </a>
            <a
              href="/login"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.9rem',
                fontWeight: 500,
              }}
            >
              Get Started
            </a>
          </nav>
        </div>
      </header>

      <section style={{ padding: '6rem 0 4rem', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              backgroundColor: 'var(--accent-subtle)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              color: '#60a5fa',
              fontSize: '0.85rem',
              fontWeight: 500,
              marginBottom: '1.5rem',
            }}
          >
            Verify. Detect. Defend.
          </div>

          <h1
            style={{
              fontSize: '3.25rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              marginBottom: '1.5rem',
            }}
          >
            Security for software built with AI.
          </h1>

          <p
            style={{
              fontSize: '1.25rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: '2.5rem',
            }}
          >
            Independently scan, verify, and continuously monitor your web applications, APIs, and AI-powered
            deployments with deterministic evidence and zero fake findings.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <a
              href="/login"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                padding: '0.85rem 1.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              Scan Your Web Application or API
            </a>
            <a
              href="/resources"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                padding: '0.85rem 1.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '1rem',
                fontWeight: 500,
              }}
            >
              Explore Security Academy
            </a>
          </div>
        </div>
      </section>

      <section style={{ padding: '4rem 0 6rem', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.75rem',
              }}
            >
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                Web Security
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Deterministic analysis of TLS configurations, CSP headers, cookies, CORS policies, and exposed
                source maps.
              </p>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.75rem',
              }}
            >
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                Target Verification
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                DNS TXT and HTML token verification ensuring assessments are executed exclusively against
                authorized attack surfaces.
              </p>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.75rem',
              }}
            >
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                Fix Verification
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Close the loop from detection to remediation. Rescan specific checks to confirm vulnerability
                resolution with empirical evidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer
        style={{
          marginTop: 'auto',
          borderTop: '1px solid var(--border-subtle)',
          padding: '2rem 0',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          textAlign: 'center',
        }}
      >
        <div className="container">
          <p>© {new Date().getFullYear()} ZERIVEX. Security for software built with AI.</p>
        </div>
      </footer>
    </main>
  );
}
