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

export default function DashboardAcademyPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AcademyCategory | 'ALL'>('ALL');
  const [selectedTrack, setSelectedTrack] = useState<LearningTrackId | 'ALL'>('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | 'ALL'>('ALL');

  const filteredArticles = useMemo(() => {
    return ACADEMY_ARTICLES.filter((article) => {
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

      if (selectedCategory !== 'ALL' && article.category !== selectedCategory) {
        return false;
      }

      if (selectedTrack !== 'ALL' && article.trackId !== selectedTrack) {
        return false;
      }

      if (selectedDifficulty !== 'ALL' && article.difficulty !== selectedDifficulty) {
        return false;
      }

      return true;
    });
  }, [searchQuery, selectedCategory, selectedTrack, selectedDifficulty]);

  return (
    <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Security Academy & Playbooks
          </h1>
          <span
            style={{
              backgroundColor: 'rgba(37, 99, 235, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            AI Code Security
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
          Practical remediation recipes, framework code patches, and local verification tests mapped directly to your scan findings.
        </p>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by vulnerability, rule ID (e.g. ZX-CORS-001), tag, or CWE..."
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '0.95rem',
          }}
        />
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <button
          onClick={() => setSelectedCategory('ALL')}
          style={{
            backgroundColor: selectedCategory === 'ALL' ? 'var(--accent-primary)' : 'var(--bg-card)',
            color: selectedCategory === 'ALL' ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            padding: '0.35rem 0.75rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          All ({ACADEMY_ARTICLES.length})
        </button>
        {(Object.keys(CATEGORY_LABELS) as AcademyCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
            style={{
              backgroundColor: selectedCategory === cat ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Secondary Filters: Track & Difficulty */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.75rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1rem',
        }}
      >
        {/* Track filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Track:</span>
          <button
            onClick={() => setSelectedTrack('ALL')}
            style={{
              backgroundColor: selectedTrack === 'ALL' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: selectedTrack === 'ALL' ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              padding: '0.25rem 0.6rem',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            All Tracks
          </button>
          {LEARNING_TRACKS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTrack(selectedTrack === t.id ? 'ALL' : t.id)}
              style={{
                backgroundColor: selectedTrack === t.id ? 'var(--accent-primary)' : 'var(--bg-card)',
                color: selectedTrack === t.id ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '0.25rem 0.6rem',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t.icon} {t.title}
            </button>
          ))}
        </div>

        {/* Difficulty filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="diff-filter" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Difficulty:
          </label>
          <select
            id="diff-filter"
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value as DifficultyLevel | 'ALL')}
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              padding: '0.3rem 0.6rem',
              fontSize: '0.8rem',
            }}
          >
            <option value="ALL">All Levels</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>
      </div>

      {/* Articles Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1.25rem',
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
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span
                    style={{
                      backgroundColor: diffStyle.bg,
                      color: diffStyle.text,
                      border: `1px solid ${diffStyle.border}`,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    {article.difficulty}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    ⏱️ {article.estimatedReadMinutes} min
                  </span>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>
                  <Link href={`/academy/${article.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {article.title}
                  </Link>
                </h3>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                  {article.summary}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
                  {article.relatedRuleIds.map((rule) => (
                    <span
                      key={rule}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.7rem',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        color: '#60a5fa',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                      }}
                    >
                      {rule}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {CATEGORY_LABELS[article.category]}
                </span>
                <Link
                  href={`/academy/${article.slug}`}
                  style={{
                    color: 'var(--accent-primary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    textDecoration: 'none',
                  }}
                >
                  Read Playbook &rarr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
