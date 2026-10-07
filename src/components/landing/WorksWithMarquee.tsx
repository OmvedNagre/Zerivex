'use client';

const FRAMEWORKS = [
  'Next.js',
  'React',
  'Express.js',
  'Nginx',
  'Node.js',
  'Fastify',
  'Hono',
  'TypeScript',
  'PostgreSQL',
  'Docker',
];

export function WorksWithMarquee() {
  return (
    <section
      style={{
        padding: '48px 0',
        backgroundColor: 'var(--ds-bg-subtle)',
        borderTop: '1px solid var(--ds-border-subtle)',
        borderBottom: '1px solid var(--ds-border-subtle)',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px', marginBottom: '24px', textAlign: 'center' }}>
        <p
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--ds-text-muted)',
            margin: 0,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Built with Cursor, Lovable, v0, Bolt or Claude Code? Protect your deployment.
        </p>
      </div>

      {/* Marquee row */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '16px',
            animation: 'marqueeScroll 28s linear infinite',
          }}
        >
          {[...FRAMEWORKS, ...FRAMEWORKS, ...FRAMEWORKS].map((fw, idx) => (
            <div
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 20px',
                borderRadius: 'var(--ds-radius-pill)',
                backgroundColor: 'var(--ds-bg-card)',
                border: '1px solid var(--ds-border-default)',
                color: 'var(--ds-text-primary)',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                boxShadow: 'var(--ds-shadow-1)',
              }}
            >
              {fw}
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes marqueeScroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          div {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}

export default WorksWithMarquee;
