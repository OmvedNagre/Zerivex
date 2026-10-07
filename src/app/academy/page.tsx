'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import SmoothScroll from '@/components/motion/SmoothScroll';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ACADEMY_ARTICLES, LEARNING_TRACKS } from '@/core/academy/academy-catalog';
import { AcademyCategory, DifficultyLevel, LearningTrackId } from '@/core/academy/types';
import {
  Search,
  Clock,
  ArrowRight,
  GraduationCap,
  X,
  Compass,
} from 'lucide-react';

const CATEGORY_LABELS: Record<AcademyCategory, string> = {
  AI_CODE_SMELLS: 'AI Code Smells',
  API_SECURITY: 'API Security',
  INJECTION_DEFENSES: 'Injection Defenses',
  AUTHENTICATION_SESSION: 'Auth & Sessions',
  INFRASTRUCTURE_HEADERS: 'Security Headers',
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

  const getDifficultyColor = (diff: DifficultyLevel) => {
    if (diff === 'BEGINNER') return 'var(--ds-success)';
    if (diff === 'INTERMEDIATE') return 'var(--ds-warning)';
    return 'var(--ds-danger)';
  };

  return (
    <SmoothScroll>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--ds-bg-page)' }}>
        <AnnouncementBar
          id="zx-academy-banner"
          message="Security Academy: 10 interactive playbooks engineered for software built with AI tools."
          ctaLabel="Explore All Tracks"
          ctaHref="#tracks-strip"
          dismissible={true}
        />

        <Header />

        <main style={{ flex: 1, padding: '48px 24px 96px', maxWidth: '1240px', margin: '0 auto', width: '100%' }}>
          {/* Hero Header */}
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
              <GraduationCap size={14} style={{ color: 'var(--ds-action-brand)' }} />
              <span>Interactive Developer Academy</span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(34px, 5vw, 56px)',
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                color: 'var(--ds-text-primary)',
                margin: '0 0 16px',
              }}
            >
              Security playbooks for AI builders.
            </h1>

            <p
              style={{
                fontSize: '18px',
                color: 'var(--ds-text-secondary)',
                maxWidth: '680px',
                margin: '0 auto 32px',
                lineHeight: 1.55,
              }}
            >
              Master vulnerability remediation, understand real-world exploits, and test fixes with deterministic CLI commands across Next.js, Express, and Nginx.
            </p>

            {/* Search Input Bar */}
            <div
              style={{
                maxWidth: '600px',
                margin: '0 auto',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '16px',
                  color: 'var(--ds-text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by vulnerability, CWE ID, framework, or keyword..."
                aria-label="Search security playbooks"
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 46px',
                  borderRadius: 'var(--ds-radius-lg)',
                  border: '1px solid var(--ds-border-strong)',
                  backgroundColor: 'var(--ds-bg-card)',
                  color: 'var(--ds-text-primary)',
                  fontSize: '15px',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: 'var(--ds-shadow-1)',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--ds-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Choose-Your-Path Track Strip */}
          <div id="tracks-strip" style={{ marginBottom: '56px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Compass size={16} style={{ color: 'var(--ds-action-brand)' }} />
              <h2
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ds-text-muted)',
                  margin: 0,
                }}
              >
                Choose Your Learning Track
              </h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
              }}
            >
              {LEARNING_TRACKS.map((track) => {
                const count = ACADEMY_ARTICLES.filter((a) => a.trackId === track.id).length;
                const isSelected = selectedTrack === track.id;

                return (
                  <div
                    key={track.id}
                    onClick={() => setSelectedTrack(isSelected ? 'ALL' : track.id)}
                    style={{
                      padding: '20px',
                      borderRadius: 'var(--ds-radius-lg)',
                      backgroundColor: isSelected ? 'var(--ds-bg-card)' : 'var(--ds-bg-subtle)',
                      border: isSelected ? '2px solid var(--ds-action-brand)' : '1px solid var(--ds-border-subtle)',
                      boxShadow: isSelected ? 'var(--ds-shadow-sticker)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ds-action-brand)', fontFamily: 'var(--font-mono)' }}>
                          TRACK
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--ds-radius-pill)',
                            backgroundColor: 'var(--ds-bg-card)',
                            border: '1px solid var(--ds-border-subtle)',
                            color: 'var(--ds-text-secondary)',
                          }}
                        >
                          {count} {count === 1 ? 'Guide' : 'Guides'}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px', color: 'var(--ds-text-primary)' }}>
                        {track.title}
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--ds-text-secondary)', margin: 0, lineHeight: 1.45 }}>
                        {track.description}
                      </p>
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--ds-action-link)' }}>
                      <span>{isSelected ? 'Track Selected' : 'Filter by track'}</span>
                      <ArrowRight size={13} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter Pills Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              marginBottom: '24px',
              padding: '16px 20px',
              backgroundColor: 'var(--ds-bg-card)',
              borderRadius: 'var(--ds-radius-lg)',
              border: '1px solid var(--ds-border-subtle)',
              boxShadow: 'var(--ds-shadow-1)',
            }}
          >
            {/* Category Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--ds-radius-pill)',
                  border: '1px solid',
                  borderColor: selectedCategory === 'ALL' ? 'var(--ds-border-strong)' : 'var(--ds-border-subtle)',
                  backgroundColor: selectedCategory === 'ALL' ? 'var(--ds-bg-ink)' : 'transparent',
                  color: selectedCategory === 'ALL' ? '#ffffff' : 'var(--ds-text-primary)',
                  fontSize: '13px',
                  fontWeight: selectedCategory === 'ALL' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                All ({ACADEMY_ARTICLES.length})
              </button>

              {(Object.keys(CATEGORY_LABELS) as AcademyCategory[]).map((cat) => {
                const count = ACADEMY_ARTICLES.filter((a) => a.category === cat).length;
                const isSelected = selectedCategory === cat;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(isSelected ? 'ALL' : cat)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--ds-radius-pill)',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--ds-border-strong)' : 'var(--ds-border-subtle)',
                      backgroundColor: isSelected ? 'var(--ds-bg-ink)' : 'transparent',
                      color: isSelected ? '#ffffff' : 'var(--ds-text-primary)',
                      fontSize: '13px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {CATEGORY_LABELS[cat]} ({count})
                  </button>
                );
              })}
            </div>

            {/* Difficulty Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--ds-text-muted)' }}>Difficulty:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as any)}
                aria-label="Filter playbooks by difficulty"
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--ds-radius-md)',
                  border: '1px solid var(--ds-border-default)',
                  backgroundColor: 'var(--ds-bg-subtle)',
                  color: 'var(--ds-text-primary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Levels</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>
          </div>

          {/* Result Count and Active Filters Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '28px',
              fontSize: '13.5px',
              color: 'var(--ds-text-secondary)',
            }}
          >
            <div>
              Showing <strong>{filteredArticles.length}</strong> of {ACADEMY_ARTICLES.length} security playbooks
              {selectedTrack !== 'ALL' && ' (Filtered by Track)'}
            </div>

            {(selectedCategory !== 'ALL' || selectedTrack !== 'ALL' || selectedDifficulty !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSelectedTrack('ALL');
                  setSelectedDifficulty('ALL');
                  setSearchQuery('');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--ds-action-link)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
                <span>Reset all filters</span>
              </button>
            )}
          </div>

          {/* Articles Grid */}
          {filteredArticles.length === 0 ? (
            <div
              style={{
                padding: '64px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--ds-bg-card)',
                borderRadius: 'var(--ds-radius-xl)',
                border: '1px solid var(--ds-border-subtle)',
              }}
            >
              <GraduationCap size={40} style={{ color: 'var(--ds-text-muted)', marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: 'var(--ds-text-primary)' }}>
                No matching security playbooks found
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--ds-text-secondary)', margin: '0 0 20px' }}>
                Try adjusting your search terms or clearing selected category and track filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSelectedTrack('ALL');
                  setSelectedDifficulty('ALL');
                  setSearchQuery('');
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--ds-radius-md)',
                  backgroundColor: 'var(--ds-bg-subtle)',
                  border: '1px solid var(--ds-border-default)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '24px',
              }}
            >
              {filteredArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/academy/${article.slug}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '28px',
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
                    {/* Header Chips */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
                        {CATEGORY_LABELS[article.category]}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {article.cweId && (
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
                            {article.cweId}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: getDifficultyColor(article.difficulty),
                          }}
                        >
                          &bull; {article.difficulty}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '19px',
                        fontWeight: 700,
                        lineHeight: 1.35,
                        color: 'var(--ds-text-primary)',
                        margin: '0 0 10px',
                      }}
                    >
                      {article.title}
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
                      {article.summary}
                    </p>

                    {/* Tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                      {article.tags.slice(0, 3).map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          style={{
                            fontSize: '11px',
                            color: 'var(--ds-text-muted)',
                            backgroundColor: 'var(--ds-bg-subtle)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer Meta */}
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
                      <span>{article.estimatedReadMinutes} min read</span>
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
                      <span>Read playbook</span>
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </SmoothScroll>
  );
}
