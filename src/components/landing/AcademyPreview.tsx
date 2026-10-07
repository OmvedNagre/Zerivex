'use client';

import { adaptArticlesToResources } from '@/adapters/adapters';
import { ACADEMY_ARTICLES } from '@/core/academy/academy-catalog';
import Link from 'next/link';
import { Clock, ArrowRight, GraduationCap } from 'lucide-react';

export function AcademyPreview() {
  const articles = adaptArticlesToResources(ACADEMY_ARTICLES, 6);

  const getDifficultyColor = (diff: string) => {
    if (diff === 'BEGINNER') return 'var(--ds-success)';
    if (diff === 'INTERMEDIATE') return 'var(--ds-warning)';
    return 'var(--ds-danger)';
  };

  return (
    <section
      style={{
        padding: '96px 24px',
        maxWidth: '1240px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '24px',
          marginBottom: '56px',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              borderRadius: 'var(--ds-radius-pill)',
              backgroundColor: 'var(--ds-bg-subtle)',
              border: '1px solid var(--ds-border-default)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--ds-text-primary)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            <GraduationCap size={14} />
            <span>Developer Playbooks</span>
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(30px, 4vw, 48px)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: 'var(--ds-text-primary)',
              margin: '0 0 12px',
            }}
          >
            Security Academy for AI Builders.
          </h2>

          <p
            style={{
              fontSize: '17px',
              color: 'var(--ds-text-secondary)',
              maxWidth: '600px',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Hands-on vulnerability breakdowns, code examples, interactive quizzes, and CLI verification steps for the top security risks in modern apps.
          </p>
        </div>

        <Link
          href="/academy"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: 'var(--ds-radius-md)',
            backgroundColor: 'var(--ds-bg-card)',
            border: '1px solid var(--ds-border-default)',
            color: 'var(--ds-text-primary)',
            fontSize: '14px',
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: 'var(--ds-shadow-1)',
            transition: 'background-color 0.15s ease',
          }}
        >
          <span>Explore all {ACADEMY_ARTICLES.length} guides</span>
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Grid of 6 Articles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
        }}
      >
        {articles.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '24px',
              borderRadius: 'var(--ds-radius-lg)',
              backgroundColor: 'var(--ds-bg-card)',
              border: '1px solid var(--ds-border-subtle)',
              boxShadow: 'var(--ds-shadow-1)',
              textDecoration: 'none',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--ds-shadow-sticker)';
              e.currentTarget.style.borderColor = 'var(--ds-border-strong)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'var(--ds-shadow-1)';
              e.currentTarget.style.borderColor = 'var(--ds-border-subtle)';
            }}
          >
            <div>
              {/* Category + Difficulty + CWE Chips */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '16px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '3px 8px',
                    borderRadius: 'var(--ds-radius-sm)',
                    backgroundColor: 'var(--ds-bg-subtle)',
                    color: 'var(--ds-text-primary)',
                  }}
                >
                  {item.category}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {item.cweId && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--ds-bg-subtle)',
                        color: 'var(--ds-text-muted)',
                      }}
                    >
                      {item.cweId}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: getDifficultyColor(item.difficulty),
                    }}
                  >
                    &bull; {item.difficulty}
                  </span>
                </div>
              </div>

              {/* Title */}
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  fontWeight: 700,
                  lineHeight: 1.35,
                  color: 'var(--ds-text-primary)',
                  margin: '0 0 10px',
                }}
              >
                {item.title}
              </h3>

              {/* Summary */}
              <p
                style={{
                  fontSize: '14px',
                  lineHeight: 1.55,
                  color: 'var(--ds-text-secondary)',
                  margin: '0 0 16px',
                }}
              >
                {item.summary}
              </p>
            </div>

            {/* Read Time + Link Arrow */}
            <div
              style={{
                paddingTop: '16px',
                borderTop: '1px solid var(--ds-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--ds-text-muted)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={13} />
                <span>{item.readTime}</span>
              </div>

              <span
                style={{
                  color: 'var(--ds-action-link)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>Read guide</span>
                <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default AcademyPreview;
