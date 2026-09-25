'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticleBySlug } from '@/core/academy/academy-service';
import { SupportedFramework } from '@/core/academy/types';

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
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCli, setCopiedCli] = useState<number | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const activeSnippet =
    article.remediationSnippets.find((s) => s.framework === activeFramework) ||
    article.remediationSnippets[0];

  function handleCopySnippet(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function handleCopyCli(cmd: string, index: number) {
    navigator.clipboard.writeText(cmd);
    setCopiedCli(index);
    setTimeout(() => setCopiedCli(null), 2000);
  }

  function toggleChecklistItem(index: number) {
    setCheckedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      {/* Top Header */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-card)',
          padding: '0.85rem 1.5rem',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          className="container"
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link href="/academy" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              &larr; Back to Academy
            </Link>
            <span style={{ color: 'var(--border-subtle)' }}>|</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {article.category.replace(/_/g, ' ')}
            </span>
          </div>

          <div>
            <Link
              href="/dashboard"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Scan Your Target &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Article Body */}
      <main className="container" style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
        {/* Meta badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span
            style={{
              backgroundColor: 'rgba(37, 99, 235, 0.15)',
              color: '#60a5fa',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {article.difficulty}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            ⏱️ {article.estimatedReadMinutes} min read
          </span>
          {article.relatedRuleIds.map((rule) => (
            <span
              key={rule}
              style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              {rule}
            </span>
          ))}
          {article.cweId && (
            <span
              style={{
                fontSize: '0.75rem',
                backgroundColor: 'rgba(148, 163, 184, 0.15)',
                color: 'var(--text-secondary)',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
              }}
            >
              {article.cweId}
            </span>
          )}
          {article.owaspCategory && (
            <span
              style={{
                fontSize: '0.75rem',
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
              }}
            >
              {article.owaspCategory}
            </span>
          )}
        </div>

        {/* Title & Summary */}
        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
            color: 'var(--text-primary)',
            margin: '0 0 1rem 0',
          }}
        >
          {article.title}
        </h1>
        <p
          style={{
            fontSize: '1.15rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            margin: '0 0 2rem 0',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '1.75rem',
          }}
        >
          {article.summary}
        </p>

        {/* Callout: Why AI Generates This */}
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🤖</span>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f87171', margin: 0 }}>
              Why AI Coding Assistants Introduce This Flaw
            </h3>
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
            {article.aiPitfallDescription}
          </p>
        </div>

        {/* Section: Technical Vulnerability Analysis */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Technical Vulnerability Analysis
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 1.5rem 0' }}>
            {article.vulnerabilityAnalysis}
          </p>

          {/* Bad Code Example */}
          <div
            style={{
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              overflow: 'hidden',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                padding: '0.6rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>✕</span> VULNERABLE IMPLEMENTATION (DO NOT USE)
            </div>
            <pre
              style={{
                margin: 0,
                padding: '1.25rem',
                color: '#f8fafc',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                overflowX: 'auto',
                fontFamily: 'monospace',
              }}
            >
              <code>{article.badCodeExample.code}</code>
            </pre>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            {article.badCodeExample.explanation}
          </div>
        </section>

        {/* Section: Framework Remediation Playbooks */}
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Remediation Playbook & Code Fixes
            </h2>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {article.remediationSnippets.map((snippet) => (
                <button
                  key={snippet.framework}
                  onClick={() => setActiveFramework(snippet.framework)}
                  style={{
                    backgroundColor: activeFramework === snippet.framework ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: activeFramework === snippet.framework ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
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
                backgroundColor: '#0f172a',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                overflow: 'hidden',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  padding: '0.6rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontSize: '0.8rem', fontWeight: 700 }}>
                  <span>✓</span> SECURE PATCH ({activeSnippet.filename})
                </div>
                <button
                  onClick={() => handleCopySnippet(activeSnippet.code)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: '#fff',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {copiedCode ? '✓ Copied!' : 'Copy Code'}
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '1.25rem',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  overflowX: 'auto',
                  fontFamily: 'monospace',
                }}
              >
                <code>{activeSnippet.code}</code>
              </pre>
            </div>
          )}

          {activeSnippet && (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              <strong>Why this works:</strong> {activeSnippet.explanation}
            </p>
          )}
        </section>

        {/* Section: CLI Diagnostic Commands */}
        {article.cliVerification.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Local CLI Verification Commands
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {article.cliVerification.map((cmd, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {cmd.description}
                    </div>
                    <button
                      onClick={() => handleCopyCli(cmd.command, i)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedCli === i ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre
                    style={{
                      backgroundColor: '#0f172a',
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      color: '#60a5fa',
                      fontSize: '0.85rem',
                      margin: '0 0 0.5rem 0',
                      overflowX: 'auto',
                      fontFamily: 'monospace',
                    }}
                  >
                    <code>{cmd.command}</code>
                  </pre>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <strong>Expected Output:</strong> <code>{cmd.expectedOutput}</code>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section: Pre-Deployment Self-Audit Checklist */}
        {article.checklist.length > 0 && (
          <section style={{ marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Pre-Deployment Self-Audit Checklist
            </h2>
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {article.checklist.map((item, i) => {
                  const isChecked = !!checkedItems[i];
                  return (
                    <label
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleChecklistItem(i)}
                        style={{ marginTop: '0.25rem', width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span
                        style={{
                          fontSize: '0.95rem',
                          color: isChecked ? 'var(--text-secondary)' : 'var(--text-primary)',
                          textDecoration: isChecked ? 'line-through' : 'none',
                          lineHeight: 1.5,
                        }}
                      >
                        {item}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Related Playbooks */}
        {relatedArticles.length > 0 && (
          <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '2.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
              Related Security Playbooks
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1rem',
              }}
            >
              {relatedArticles.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/academy/${rel.slug}`}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      {rel.difficulty}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                      {rel.title}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    ⏱️ {rel.estimatedReadMinutes} min read &rarr;
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
