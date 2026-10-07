'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SmoothScroll from '@/components/motion/SmoothScroll';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CopyButton } from '@/components/ui/CopyButton';
import { getArticleBySlug } from '@/core/academy/academy-service';
import { SupportedFramework } from '@/core/academy/types';
import {
  Clock,
  ArrowRight,
  ArrowLeft,
  Bot,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Check,
  X,
  ListChecks,
} from 'lucide-react';

const FRAMEWORK_NAMES: Record<SupportedFramework, string> = {
  nextjs: 'Next.js (App Router)',
  express: 'Express / Node.js',
  nginx: 'Nginx Configuration',
  fastify: 'Fastify',
  general: 'General / Vanilla',
};

export default function ArticleReaderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const result = getArticleBySlug(slug);

  if (!result) {
    notFound();
  }

  const { article, relatedArticles } = result;

  const [activeFramework, setActiveFramework] = useState<SupportedFramework>(
    article.remediationSnippets[0]?.framework || 'nextjs'
  );
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const activeSnippet =
    article.remediationSnippets.find((s) => s.framework === activeFramework) ||
    article.remediationSnippets[0];

  function toggleChecklistItem(index: number) {
    setCheckedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  const quizQuestion = {
    question: `What is the primary architectural cause of ${article.title.toLowerCase()}?`,
    options: [
      'Insecure default settings and client/server boundary leakage in AI-generated snippets',
      'Flaws in browser TLS certificate validation',
      'Overclocked database query execution plans',
      'Missing package.json license fields',
    ],
    correctAnswer: 0,
    explanation:
      'AI coding assistants frequently blend client and server boundaries or omit strict transport/input policies because they prioritize immediate functional rendering.',
  };

  return (
    <SmoothScroll>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--ds-bg-page)' }}>
        <AnnouncementBar
          id="zx-article-banner"
          message={`Reading playbook: ${article.title}. Multi-framework fixes included.`}
          ctaLabel="All Playbooks"
          ctaHref="/academy"
          dismissible={true}
        />

        <Header />

        <div style={{ maxWidth: '1240px', margin: '0 auto', width: '100%', padding: '36px 24px 96px' }}>
          {/* Breadcrumb / Back Navigation */}
          <div style={{ marginBottom: '28px' }}>
            <Link
              href="/academy"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--ds-text-secondary)',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to Security Academy</span>
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '48px',
              alignItems: 'start',
            }}
          >
            {/* Left: Article Content */}
            <main style={{ maxWidth: '820px' }}>
              {/* Meta Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
                <span
                  style={{
                    backgroundColor: 'var(--ds-bg-subtle)',
                    color: 'var(--ds-text-primary)',
                    padding: '3px 10px',
                    borderRadius: 'var(--ds-radius-pill)',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {article.category.replace(/_/g, ' ')}
                </span>
                <span
                  style={{
                    backgroundColor: 'rgba(89, 221, 170, 0.15)',
                    color: 'var(--ds-success)',
                    padding: '3px 10px',
                    borderRadius: 'var(--ds-radius-pill)',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {article.difficulty}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--ds-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={13} />
                  <span>{article.estimatedReadMinutes} min read</span>
                </span>
                {article.cweId && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      backgroundColor: 'var(--ds-bg-card)',
                      border: '1px solid var(--ds-border-subtle)',
                      color: 'var(--ds-text-muted)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    {article.cweId}
                  </span>
                )}
                {article.relatedRuleIds.map((rule) => (
                  <span
                    key={rule}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      backgroundColor: 'rgba(255, 100, 45, 0.1)',
                      color: 'var(--ds-action-brand)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    {rule}
                  </span>
                ))}
              </div>

              {/* Title & Summary */}
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(32px, 4.5vw, 48px)',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  color: 'var(--ds-text-primary)',
                  margin: '0 0 16px',
                }}
              >
                {article.title}
              </h1>

              <p
                style={{
                  fontSize: '18px',
                  color: 'var(--ds-text-secondary)',
                  lineHeight: 1.6,
                  margin: '0 0 36px',
                  paddingBottom: '28px',
                  borderBottom: '1px solid var(--ds-border-subtle)',
                }}
              >
                {article.summary}
              </p>

              {/* Section 1: AI Pitfall Callout */}
              <section id="ai-pitfall" style={{ marginBottom: '40px' }}>
                <div
                  style={{
                    backgroundColor: 'var(--ds-bg-subtle)',
                    border: '1px solid var(--ds-border-default)',
                    borderRadius: 'var(--ds-radius-lg)',
                    padding: '24px',
                    boxShadow: 'var(--ds-shadow-1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Bot size={20} style={{ color: 'var(--ds-action-brand)' }} />
                    <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ds-text-primary)' }}>
                      Why AI coding tools introduce this vulnerability
                    </h2>
                  </div>
                  <p style={{ fontSize: '14.5px', color: 'var(--ds-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    {article.aiPitfallDescription}
                  </p>
                </div>
              </section>

              {/* Section 2: Technical Vulnerability Analysis */}
              <section id="technical-analysis" style={{ marginBottom: '48px' }}>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'var(--ds-text-primary)',
                    margin: '0 0 14px',
                  }}
                >
                  Technical Vulnerability Analysis
                </h2>
                <p style={{ fontSize: '15px', color: 'var(--ds-text-secondary)', lineHeight: 1.7, margin: '0 0 20px' }}>
                  {article.vulnerabilityAnalysis}
                </p>

                {/* Insecure Example Card */}
                <div
                  style={{
                    borderRadius: 'var(--ds-radius-lg)',
                    backgroundColor: '#FFF7F7',
                    border: '1px solid rgba(209, 0, 47, 0.25)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 18px',
                      backgroundColor: 'rgba(209, 0, 47, 0.06)',
                      borderBottom: '1px solid rgba(209, 0, 47, 0.15)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ds-danger)', fontWeight: 700, fontSize: '13px' }}>
                      <AlertTriangle size={16} />
                      <span>VULNERABLE IMPLEMENTATION (DO NOT USE)</span>
                    </div>
                    <CopyButton value={article.badCodeExample.code} label="Copy code" />
                  </div>
                  <div style={{ padding: '18px', overflowX: 'auto' }} data-lenis-prevent>
                    <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: 1.6, color: '#6E1B24' }}>
                      <code>{article.badCodeExample.code}</code>
                    </pre>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ds-text-muted)', fontStyle: 'italic', marginTop: '10px' }}>
                  {article.badCodeExample.explanation}
                </div>
              </section>

              {/* Section 3: Remediation Playbook (Before/After & Framework Tabs) */}
              <section id="remediation-playbook" style={{ marginBottom: '48px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
                  <h2
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '24px',
                      fontWeight: 700,
                      color: 'var(--ds-text-primary)',
                      margin: 0,
                    }}
                  >
                    Remediation Playbook &amp; Code Fixes
                  </h2>

                  {/* Framework Selector Pills */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {article.remediationSnippets.map((snippet) => (
                      <button
                        key={snippet.framework}
                        type="button"
                        onClick={() => setActiveFramework(snippet.framework)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--ds-radius-md)',
                          border: '1px solid',
                          borderColor: activeFramework === snippet.framework ? 'var(--ds-border-strong)' : 'var(--ds-border-subtle)',
                          backgroundColor: activeFramework === snippet.framework ? 'var(--ds-bg-card)' : 'transparent',
                          color: 'var(--ds-text-primary)',
                          fontSize: '12.5px',
                          fontWeight: activeFramework === snippet.framework ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {FRAMEWORK_NAMES[snippet.framework] || snippet.framework}
                      </button>
                    ))}
                  </div>
                </div>

                {activeSnippet && (
                  <div
                    style={{
                      borderRadius: 'var(--ds-radius-lg)',
                      backgroundColor: '#F5FCF8',
                      border: '1px solid rgba(0, 159, 129, 0.25)',
                      overflow: 'hidden',
                      marginBottom: '16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 18px',
                        backgroundColor: 'rgba(0, 159, 129, 0.06)',
                        borderBottom: '1px solid rgba(0, 159, 129, 0.15)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ds-success)', fontWeight: 700, fontSize: '13px' }}>
                        <CheckCircle2 size={16} />
                        <span>SECURE HARDENED PATCH ({activeSnippet.filename})</span>
                      </div>
                      <CopyButton value={activeSnippet.code} label="Copy patch" />
                    </div>
                    <div style={{ padding: '18px', overflowX: 'auto' }} data-lenis-prevent>
                      <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: 1.6, color: '#064E3B' }}>
                        <code>{activeSnippet.code}</code>
                      </pre>
                    </div>
                  </div>
                )}

                {activeSnippet && (
                  <p style={{ fontSize: '14px', color: 'var(--ds-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--ds-text-primary)' }}>Why this fix works:</strong> {activeSnippet.explanation}
                  </p>
                )}
              </section>

              {/* Section 4: CLI Diagnostic Commands */}
              {article.cliVerification.length > 0 && (
                <section id="cli-verification" style={{ marginBottom: '48px' }}>
                  <h2
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '24px',
                      fontWeight: 700,
                      color: 'var(--ds-text-primary)',
                      margin: '0 0 16px',
                    }}
                  >
                    Local CLI Verification Commands
                  </h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {article.cliVerification.map((cmd, i) => (
                      <div
                        key={i}
                        style={{
                          borderRadius: 'var(--ds-radius-lg)',
                          backgroundColor: 'var(--ds-bg-ink)',
                          color: 'var(--ds-text-on-ink)',
                          padding: '20px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-text-on-ink-dim)' }}>
                            {cmd.description}
                          </span>
                          <CopyButton value={cmd.command} label="Copy command" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '13px', marginBottom: '10px' }}>
                          <Terminal size={14} style={{ color: 'var(--ds-action-brand)' }} />
                          <span style={{ color: '#ffffff' }}>{cmd.command}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ds-text-on-ink-dim)' }}>
                          Expected result: <span style={{ color: 'var(--ds-mint)', fontFamily: 'var(--font-mono)' }}>{cmd.expectedOutput}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Section 5: Pre-Deployment Self-Audit Checklist */}
              {article.checklist.length > 0 && (
                <section id="checklist" style={{ marginBottom: '48px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <ListChecks size={20} style={{ color: 'var(--ds-action-brand)' }} />
                    <h2
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '24px',
                        fontWeight: 700,
                        color: 'var(--ds-text-primary)',
                        margin: 0,
                      }}
                    >
                      Pre-Deployment Self-Audit Checklist
                    </h2>
                  </div>

                  <div
                    style={{
                      borderRadius: 'var(--ds-radius-lg)',
                      backgroundColor: 'var(--ds-bg-card)',
                      border: '1px solid var(--ds-border-default)',
                      padding: '20px 24px',
                      boxShadow: 'var(--ds-shadow-1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {article.checklist.map((item, i) => {
                      const isChecked = !!checkedItems[i];
                      return (
                        <label
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleChecklistItem(i)}
                            style={{
                              marginTop: '3px',
                              width: '16px',
                              height: '16px',
                              accentColor: 'var(--ds-action-brand)',
                            }}
                          />
                          <span
                            style={{
                              fontSize: '14px',
                              lineHeight: 1.5,
                              color: isChecked ? 'var(--ds-text-muted)' : 'var(--ds-text-primary)',
                              textDecoration: isChecked ? 'line-through' : 'none',
                            }}
                          >
                            {item}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Section 6: Knowledge Check Quiz */}
              <section id="quiz" style={{ marginBottom: '48px' }}>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'var(--ds-text-primary)',
                    margin: '0 0 16px',
                  }}
                >
                  Knowledge Check: Verify Your Understanding
                </h2>

                <div
                  style={{
                    borderRadius: 'var(--ds-radius-lg)',
                    backgroundColor: 'var(--ds-bg-card)',
                    border: '1px solid var(--ds-border-default)',
                    padding: '28px',
                    boxShadow: 'var(--ds-shadow-1)',
                  }}
                >
                  <p style={{ fontSize: '15.5px', fontWeight: 600, color: 'var(--ds-text-primary)', margin: '0 0 20px' }}>
                    {quizQuestion.question}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    {quizQuestion.options.map((opt, oIdx) => {
                      const isSelected = selectedQuizOption === oIdx;
                      const isCorrect = oIdx === quizQuestion.correctAnswer;
                      let borderColor = 'var(--ds-border-subtle)';
                      let bg = 'var(--ds-bg-subtle)';

                      if (quizSubmitted) {
                        if (isCorrect) {
                          borderColor = 'var(--ds-success)';
                          bg = 'rgba(0, 159, 129, 0.08)';
                        } else if (isSelected) {
                          borderColor = 'var(--ds-danger)';
                          bg = 'rgba(209, 0, 47, 0.08)';
                        }
                      } else if (isSelected) {
                        borderColor = 'var(--ds-border-strong)';
                        bg = 'var(--ds-bg-card)';
                      }

                      return (
                        <button
                          key={oIdx}
                          type="button"
                          disabled={quizSubmitted}
                          onClick={() => setSelectedQuizOption(oIdx)}
                          style={{
                            padding: '14px 18px',
                            borderRadius: 'var(--ds-radius-md)',
                            border: `1px solid ${borderColor}`,
                            backgroundColor: bg,
                            color: 'var(--ds-text-primary)',
                            fontSize: '14px',
                            textAlign: 'left',
                            cursor: quizSubmitted ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>{opt}</span>
                          {quizSubmitted && isCorrect && <Check size={18} style={{ color: 'var(--ds-success)' }} />}
                          {quizSubmitted && isSelected && !isCorrect && <X size={18} style={{ color: 'var(--ds-danger)' }} />}
                        </button>
                      );
                    })}
                  </div>

                  {!quizSubmitted ? (
                    <button
                      type="button"
                      disabled={selectedQuizOption === null}
                      onClick={() => setQuizSubmitted(true)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 'var(--ds-radius-md)',
                        backgroundColor: 'var(--ds-action-brand)',
                        color: 'var(--ds-on-brand)',
                        fontWeight: 700,
                        fontSize: '14px',
                        border: 'none',
                        cursor: selectedQuizOption === null ? 'not-allowed' : 'pointer',
                        opacity: selectedQuizOption === null ? 0.6 : 1,
                      }}
                    >
                      Submit Answer
                    </button>
                  ) : (
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--ds-radius-md)',
                        backgroundColor: 'var(--ds-bg-subtle)',
                        fontSize: '13.5px',
                        lineHeight: 1.5,
                        color: 'var(--ds-text-secondary)',
                      }}
                    >
                      <strong style={{ color: 'var(--ds-text-primary)' }}>Explanation:</strong> {quizQuestion.explanation}
                    </div>
                  )}
                </div>
              </section>

              {/* Bottom CTA: Launch Scan for this vulnerability */}
              <div
                style={{
                  borderRadius: 'var(--ds-radius-xl)',
                  backgroundColor: 'var(--ds-bg-ink)',
                  color: 'var(--ds-text-on-ink)',
                  padding: '36px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '24px',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>
                    Test your website for {article.relatedRuleIds[0] || 'this finding'}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--ds-text-on-ink-dim)', margin: 0 }}>
                    Run our 14 deterministic engines to inspect your live deployment.
                  </p>
                </div>

                <Link
                  href="/login"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    borderRadius: 'var(--ds-radius-md)',
                    backgroundColor: 'var(--ds-action-brand)',
                    color: 'var(--ds-on-brand)',
                    fontWeight: 700,
                    fontSize: '14px',
                    textDecoration: 'none',
                  }}
                >
                  <span>Launch scan for this flaw</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </main>

            {/* Right: Sticky Table of Contents & Related */}
            <aside style={{ position: 'sticky', top: '100px' }}>
              <div
                style={{
                  borderRadius: 'var(--ds-radius-lg)',
                  backgroundColor: 'var(--ds-bg-card)',
                  border: '1px solid var(--ds-border-subtle)',
                  padding: '24px',
                  boxShadow: 'var(--ds-shadow-1)',
                  marginBottom: '24px',
                }}
              >
                <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ds-text-muted)', marginBottom: '14px' }}>
                  On This Page
                </h3>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <a href="#ai-pitfall" style={{ fontSize: '13px', color: 'var(--ds-text-secondary)', textDecoration: 'none' }}>
                    1. Why AI Generates This
                  </a>
                  <a href="#technical-analysis" style={{ fontSize: '13px', color: 'var(--ds-text-secondary)', textDecoration: 'none' }}>
                    2. Vulnerability Analysis
                  </a>
                  <a href="#remediation-playbook" style={{ fontSize: '13px', color: 'var(--ds-text-secondary)', textDecoration: 'none' }}>
                    3. Code Remediation
                  </a>
                  <a href="#cli-verification" style={{ fontSize: '13px', color: 'var(--ds-text-secondary)', textDecoration: 'none' }}>
                    4. CLI Commands
                  </a>
                  <a href="#checklist" style={{ fontSize: '13px', color: 'var(--ds-text-secondary)', textDecoration: 'none' }}>
                    5. Audit Checklist
                  </a>
                  <a href="#quiz" style={{ fontSize: '13px', color: 'var(--ds-text-secondary)', textDecoration: 'none' }}>
                    6. Knowledge Quiz
                  </a>
                </nav>
              </div>

              {/* Related Playbooks */}
              {relatedArticles.length > 0 && (
                <div
                  style={{
                    borderRadius: 'var(--ds-radius-lg)',
                    backgroundColor: 'var(--ds-bg-card)',
                    border: '1px solid var(--ds-border-subtle)',
                    padding: '24px',
                    boxShadow: 'var(--ds-shadow-1)',
                  }}
                >
                  <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ds-text-muted)', marginBottom: '14px' }}>
                    Related Playbooks
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {relatedArticles.map((rel) => (
                      <Link
                        key={rel.id}
                        href={`/academy/${rel.slug}`}
                        style={{
                          textDecoration: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
                          {rel.title}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>
                          {rel.estimatedReadMinutes} min read
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>

        <Footer />
      </div>
    </SmoothScroll>
  );
}
