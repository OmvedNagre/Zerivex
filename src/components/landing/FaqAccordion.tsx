'use client';

import { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Is scanning safe for my production website?',
    answer:
      'Yes. Our passive scan engines only inspect publicly accessible HTTP response headers, TLS ciphers, and client-side JavaScript bundles without sending intrusive payloads. Active probes are strictly non-destructive, rate-limited, and only execute after you cryptographically prove domain ownership.',
  },
  {
    question: 'Why do I have to verify target ownership?',
    answer:
      'Responsible security testing requires proving you control the application before launching active vulnerability probes. We support 4 instant verification methods: DNS TXT record, HTTP response header, HTML meta tag, or a verification file upload.',
  },
  {
    question: 'Will active vulnerability checks break my database or service?',
    answer:
      'No. Active probes use benign syntax detection (such as harmless mathematical evaluations and ORM escaping checks) to prove vulnerability existence without altering, deleting, or corrupting database records.',
  },
  {
    question: 'What data do you store and redact?',
    answer:
      'Before storing scan evidence or findings in the tamper-evident audit vault, our redaction engine masks sensitive authorization headers, bearer tokens, API keys, passwords, cookies, and payment card numbers.',
  },
  {
    question: 'What is included in the Free Developer plan?',
    answer:
      'The Free plan includes 1 public perimeter scan per week across 14 deterministic engines, complete vulnerability explanations, and full multi-framework before/after fix diffs for Next.js, Express, and Nginx. No credit card required.',
  },
  {
    question: 'Can I cancel or switch plans at any time?',
    answer:
      'Yes. You can upgrade, downgrade, or cancel your subscription at any time directly through the Stripe billing portal in your dashboard settings. Upgrades apply immediately; downgrades keep your existing targets accessible while pausing addition of new ones.',
  },
];

export function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section
      style={{
        padding: '96px 24px',
        maxWidth: '860px',
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '56px' }}>
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
          <HelpCircle size={14} />
          <span>Frequently Asked Questions</span>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(30px, 4vw, 44px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: 'var(--ds-text-primary)',
            margin: '0 0 16px',
          }}
        >
          Clear answers about security testing.
        </h2>

        <p
          style={{
            fontSize: '16px',
            color: 'var(--ds-text-secondary)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Everything you need to know about safety, ownership verification, redaction, and plans.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              style={{
                borderRadius: 'var(--ds-radius-lg)',
                backgroundColor: 'var(--ds-bg-card)',
                border: '1px solid',
                borderColor: isOpen ? 'var(--ds-border-strong)' : 'var(--ds-border-subtle)',
                boxShadow: isOpen ? 'var(--ds-shadow-1)' : 'none',
                overflow: 'hidden',
                transition: 'border-color 0.15s ease',
              }}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                style={{
                  width: '100%',
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--ds-text-primary)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '17px',
                    fontWeight: 700,
                    lineHeight: 1.3,
                  }}
                >
                  {item.question}
                </span>
                <ChevronDown
                  size={18}
                  style={{
                    color: 'var(--ds-text-muted)',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                    flexShrink: 0,
                  }}
                />
              </button>

              {isOpen && (
                <div
                  style={{
                    padding: '0 24px 20px',
                    fontSize: '15px',
                    lineHeight: 1.6,
                    color: 'var(--ds-text-secondary)',
                  }}
                >
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default FaqAccordion;
