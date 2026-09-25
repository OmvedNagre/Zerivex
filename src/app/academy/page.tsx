'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ACADEMY_ARTICLES, LEARNING_TRACKS } from '@/core/academy/academy-catalog';
import { AcademyCategory, DifficultyLevel, LearningTrackId } from '@/core/academy/types';

const CATEGORY_LABELS: Record<AcademyCategory, string> = {
  AI_CODE_SMELLS: 'AI Code Smells',
  API_SECURITY: 'API Security',
  INJECTION_DEFENSES: 'Injection Defenses',
  AUTHENTICATION_SESSION: 'Auth & Sessions',
  INFRASTRUCTURE_HEADERS: 'Security Headers',
};

const DIFFICULTY_COLORS: Record<DifficultyLevel, { bg: string; text: string; border: string }> = {
  BEGINNER: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  INTERMEDIATE: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  ADVANCED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
};

export default function AcademyPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AcademyCategory | 'ALL'>('ALL');
  const [selectedTrack, setSelectedTrack] = useState<LearningTrackId | 'ALL'>('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | 'ALL'>('ALL');

  const filteredArticles = useMemo(() => {
    return ACADEMY_ARTICLES.filter((article) => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = article.title.toLowerCase().includes(q);
        const summaryMatch = article.summary.toLowerCase().includes(q);
        const tagMatch = article.tags.some((t) => t.toLowerCase().includes(q));
        const ruleMatch = article.relatedRuleIds.some((r) => r.toLowerCase().includes(q));
        const cweMatch = article.cweId?.toLowerCase().includes(q);
        if (!titleMatch && !summaryMatch && !tagMatch && !ruleMatch && !cweMatch) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'ALL' && article.category !== selectedCategory) {
        return false;
      }

      // Track filter
      if (selectedTrack !== 'ALL' && article.trackId !== selectedTrack) {
        return false;
      }

      // Difficulty filter
      if (selectedDifficulty !== 'ALL' && article.difficulty !== selectedDifficulty) {
        return false;
      }

      return true;
    });
  }, [searchQuery, selectedCategory, selectedTrack, selectedDifficulty]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      {/* Navigation Header */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-card)',
          padding: '0.85rem 1.5rem',
        }}
      >
        <div
          className="container"
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                }}
              >
                Z
              </span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                ZERIVEX
              </span>
            </Link>
            <nav style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <Link href="/dashboard" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textDecoration: 'none' }}>
                Dashboard
              </Link>
              <Link href="/academy" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}>
                Academy
              </Link>
            </nav>
          </div>

          <div>
            <Link
              href="/dashboard"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Launch Console →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        style={{
          padding: '3.5rem 1.5rem 2.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.08) 0%, transparent 100%)',
        }}
      >
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              backgroundColor: 'rgba(37, 99, 235, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '1rem',
              letterSpacing: '0.04em',
            }}
          >
            SECURITY ACADEMY & REMEDIATION PLAYBOOKS
          </div>

          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: '0.75rem',
              color: 'var(--text-primary)',
            }}
          >
            Securing Software Built with AI
          </h1>
          <p
            style={{
              fontSize: '1.1rem',
              color: 'var(--text-secondary)',
              maxWidth: '680px',
              margin: '0 auto 2rem',
              lineHeight: 1.6,
            }}
          >
            Definitive guides, framework code patches, and CLI diagnostic tests for developers shipping with Cursor, Lovable, v0, Bolt, Claude Code, and Antigravity.
          </p>

          {/* Search Bar */}
          <div style={{ maxWidth: '640px', margin: '0 auto', position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vulnerability, rule ID (e.g. ZX-CORS-001), tag, or CWE..."
              style={{
                width: '100%',
                padding: '0.85rem 1.25rem',
                fontSize: '1rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        {/* Learning Tracks Grid */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Curated Learning Tracks
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
            }}
          >
            {LEARNING_TRACKS.map((track) => {
              const isSelected = selectedTrack === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => setSelectedTrack(isSelected ? 'ALL' : track.id)}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : 'none',
                  }}
                >
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{track.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                    {track.title}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '0.75rem' }}>
                    {track.description}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    {track.articleSlugs.length} Guides in Track &rarr;
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters Row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '2rem',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '1.25rem',
          }}
        >
          {/* Category Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              onClick={() => setSelectedCategory('ALL')}
              style={{
                backgroundColor: selectedCategory === 'ALL' ? 'var(--accent-primary)' : 'var(--bg-card)',
                color: selectedCategory === 'ALL' ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '0.4rem 0.85rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              All Guides ({ACADEMY_ARTICLES.length})
            </button>
            {(Object.keys(CATEGORY_LABELS) as AcademyCategory[]).map((cat) => {
              const count = ACADEMY_ARTICLES.filter((a) => a.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
                  style={{
                    backgroundColor: selectedCategory === cat ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {CATEGORY_LABELS[cat]} ({count})
                </button>
              );
            })}
          </div>

          {/* Difficulty Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Difficulty:</span>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value as any)}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}
            >
              <option value="ALL">All Levels</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </div>
        </div>

        {/* Results Counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Showing <strong>{filteredArticles.length}</strong> security playbooks
            {selectedCategory !== 'ALL' && ` in ${CATEGORY_LABELS[selectedCategory]}`}
            {selectedTrack !== 'ALL' && ` (filtered by Track)`}
          </div>
          {(selectedCategory !== 'ALL' || selectedTrack !== 'ALL' || selectedDifficulty !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCategory('ALL');
                setSelectedTrack('ALL');
                setSelectedDifficulty('ALL');
                setSearchQuery('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reset Filters ✕
            </button>
          )}
        </div>

        {/* Articles Grid */}
        {filteredArticles.length === 0 ? (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
              No Guides Match Your Criteria
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
              Try searching for a different keyword or resetting your category and difficulty filters.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('ALL');
                setSelectedTrack('ALL');
                setSelectedDifficulty('ALL');
                setSearchQuery('');
              }}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                padding: '0.6rem 1.2rem',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Show All Guides
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {filteredArticles.map((article) => {
              const diffStyle = DIFFICULTY_COLORS[article.difficulty];
              return (
                <div
                  key={article.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div>
                    {/* Top Badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                      <span
                        style={{
                          backgroundColor: diffStyle.bg,
                          color: diffStyle.text,
                          border: `1px solid ${diffStyle.border}`,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {article.difficulty}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        ⏱️ {article.estimatedReadMinutes} min read
                      </span>
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.6rem 0', lineHeight: 1.4 }}>
                      <Link
                        href={`/academy/${article.slug}`}
                        style={{ color: 'inherit', textDecoration: 'none' }}
                      >
                        {article.title}
                      </Link>
                    </h3>

                    {/* Summary */}
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                      {article.summary}
                    </p>

                    {/* Rules & Standards Tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
                      {article.relatedRuleIds.map((rule) => (
                        <span
                          key={rule}
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            color: '#60a5fa',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '3px',
                          }}
                        >
                          {rule}
                        </span>
                      ))}
                      {article.cweId && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            backgroundColor: 'rgba(148, 163, 184, 0.1)',
                            color: 'var(--text-secondary)',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '3px',
                          }}
                        >
                          {article.cweId}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {CATEGORY_LABELS[article.category]}
                    </span>
                    <Link
                      href={`/academy/${article.slug}`}
                      style={{
                        color: 'var(--accent-primary)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      Read Playbook &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
