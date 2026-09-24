'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { DiscoveredEndpoint, TechnologyFingerprint } from '@/core/surface/types';
import { Target } from '@/core/targets/target-service';

export default function TargetAttackSurfacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [target, setTarget] = useState<Target | null>(null);
  const [endpoints, setEndpoints] = useState<DiscoveredEndpoint[]>([]);
  const [technologies, setTechnologies] = useState<TechnologyFingerprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');

  const fetchSurfaceData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/targets/${id}/surface`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load attack surface data');
      }

      setTarget(data.data.target);
      setEndpoints(data.data.endpoints || []);
      setTechnologies(data.data.technologies || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSurfaceData();
  }, [fetchSurfaceData]);

  const handleTriggerCrawl = async () => {
    try {
      setCrawling(true);
      setCrawlMessage(null);
      setError(null);

      const res = await fetch(`/api/targets/${id}/surface`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Crawl request failed');
      }

      setCrawlMessage(
        `Discovered ${data.data.discoveredEndpointsCount} endpoints and ${data.data.technologiesCount} stack signatures in ${data.data.crawlDurationMs}ms.`
      );
      await fetchSurfaceData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCrawling(false);
    }
  };

  // Filter endpoints
  const filteredEndpoints = endpoints.filter((ep) => {
    if (selectedMethod !== 'ALL' && ep.httpMethod !== selectedMethod) return false;
    if (selectedSource !== 'ALL' && ep.discoverySource !== selectedSource) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        ep.path.toLowerCase().includes(q) ||
        ep.url.toLowerCase().includes(q) ||
        ep.parameters.some((p) => p.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getMethodBadgeStyle = (method: string) => {
    switch (method) {
      case 'GET':
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' };
      case 'POST':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
      case 'PUT':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
      case 'DELETE':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' };
    }
  };

  const getSourceBadgeStyle = (source: string) => {
    switch (source) {
      case 'ROBOTS_TXT':
        return { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308' };
      case 'SITEMAP':
        return { bg: 'rgba(14, 165, 233, 0.1)', color: '#38bdf8' };
      case 'API_DISCOVERY':
        return { bg: 'rgba(236, 72, 153, 0.1)', color: '#f472b6' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' };
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading target attack surface...
      </div>
    );
  }

  if (error && !target) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: 'var(--radius-md)' }}>
          {error}
        </div>
        <Link href="/dashboard/targets" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
          ← Back to Targets
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1100px' }}>
      {/* Header & Breadcrumb */}
      <div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <Link
            href="/dashboard/targets"
            style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}
          >
            ← Targets
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <Link
            href={`/dashboard/targets/${id}`}
            style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}
          >
            {target?.hostname}
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600 }}>
            Attack Surface Map
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
              Attack Surface Explorer
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Mapped endpoints, route hierarchy, input parameters, and technology stack fingerprinting for{' '}
              <code style={{ color: 'var(--accent-primary)' }}>{target?.targetUrl}</code>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link
              href={`/dashboard/targets/${id}`}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: '1px solid var(--border-color)',
              }}
            >
              Verification Center
            </Link>

            <Link
              href={`/dashboard/targets/${id}/monitoring`}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: '1px solid var(--border-color)',
              }}
            >
              Continuous Monitoring ↗
            </Link>

            <Link
              href={`/dashboard/targets/${id}/ci-cd`}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: '1px solid var(--border-color)',
              }}
            >
              CI/CD & Integrations ↗
            </Link>

            <button
              onClick={handleTriggerCrawl}
              disabled={crawling}
              style={{
                padding: '0.6rem 1.25rem',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: crawling ? 'not-allowed' : 'pointer',
                opacity: crawling ? 0.7 : 1,
              }}
            >
              {crawling ? 'Crawling Attack Surface...' : '⚡ Run Discovery Crawl'}
            </button>
          </div>
        </div>
      </div>

      {/* Crawl Feedback / Errors */}
      {crawlMessage && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#34d399',
            fontSize: '0.9rem',
          }}
        >
          ✓ {crawlMessage}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
            DISCOVERED ENDPOINTS
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {endpoints.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Mapped routes across application
          </div>
        </div>

        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
            TECHNOLOGIES DETECTED
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {technologies.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Fingerprinted frameworks & runtimes
          </div>
        </div>

        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
            INPUT PARAMETERS
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#34d399' }}>
            {endpoints.reduce((sum, ep) => sum + (ep.parameters?.length || 0), 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Query & form inputs identified
          </div>
        </div>

        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
            VERIFICATION SCOPE
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {target?.verificationScope || 'EXACT_HOST'}
          </div>
          <div style={{ fontSize: '0.75rem', color: target?.verificationStatus === 'VERIFIED' ? '#34d399' : '#fbbf24', marginTop: '0.25rem' }}>
            {target?.verificationStatus === 'VERIFIED' ? '✓ Ownership Confirmed' : '⚠ Unverified Target'}
          </div>
        </div>
      </div>

      {/* Technology Fingerprints Matrix */}
      <div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', letterSpacing: '-0.01em' }}>
          Technology Stack Fingerprints ({technologies.length})
        </h2>

        {technologies.length === 0 ? (
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px dashed var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              textAlign: 'center',
            }}
          >
            No technologies fingerprinted yet. Run a Discovery Crawl or Scan to inspect stack signatures.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1rem',
            }}
          >
            {technologies.map((tech, idx) => (
              <div
                key={idx}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {tech.category}
                    </span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {tech.name} {tech.version ? <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>v{tech.version}</span> : null}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: tech.confidence === 'HIGH' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: tech.confidence === 'HIGH' ? '#34d399' : '#fbbf24',
                    }}
                  >
                    {tech.confidence} CONFIDENCE
                  </span>
                </div>

                {tech.matchedIndicators && tech.matchedIndicators.length > 0 && (
                  <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {tech.matchedIndicators.map((ind, indIdx) => (
                      <span
                        key={indIdx}
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          fontFamily: 'monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        • {ind}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discovered Endpoints Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Discovered Application Endpoints ({filteredEndpoints.length} of {endpoints.length})
          </h2>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Filter by path, URL, or parameter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                width: '260px',
              }}
            />

            {/* Method Filter */}
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="ALL">All Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>

            {/* Source Filter */}
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="ALL">All Sources</option>
              <option value="CRAWLER">Crawler</option>
              <option value="ROBOTS_TXT">Robots.txt</option>
              <option value="SITEMAP">Sitemap</option>
              <option value="API_DISCOVERY">API Discovery</option>
            </select>
          </div>
        </div>

        {filteredEndpoints.length === 0 ? (
          <div
            style={{
              padding: '3rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px dashed var(--border-color)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            {endpoints.length === 0 ? (
              <div>
                <p style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                  No endpoints mapped yet for this target.
                </p>
                <button
                  onClick={handleTriggerCrawl}
                  disabled={crawling}
                  style={{
                    padding: '0.6rem 1.25rem',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Start Initial Attack Surface Crawl
                </button>
              </div>
            ) : (
              <p>No endpoints match the current filter criteria.</p>
            )}
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>METHOD</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>PATH / ENDPOINT</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>PARAMETERS</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>SOURCE</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>RESPONSE</th>
                </tr>
              </thead>
              <tbody>
                {filteredEndpoints.map((ep, idx) => {
                  const mBadge = getMethodBadgeStyle(ep.httpMethod);
                  const sBadge = getSourceBadgeStyle(ep.discoverySource);
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: idx === filteredEndpoints.length - 1 ? 'none' : '1px solid var(--border-color)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Method */}
                      <td style={{ padding: '0.75rem 1rem', width: '80px' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: mBadge.bg,
                            color: mBadge.color,
                            border: `1px solid ${mBadge.border}`,
                          }}
                        >
                          {ep.httpMethod}
                        </span>
                      </td>

                      {/* Path */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {ep.path}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '450px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ep.url}
                        </div>
                      </td>

                      {/* Parameters */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {ep.parameters && ep.parameters.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {ep.parameters.slice(0, 3).map((p, pIdx) => (
                              <span
                                key={pIdx}
                                style={{
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '3px',
                                  fontSize: '0.7rem',
                                  fontFamily: 'monospace',
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {p.name} ({p.in})
                              </span>
                            ))}
                            {ep.parameters.length > 3 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                +{ep.parameters.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>

                      {/* Status Code */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {ep.statusCode ? (
                          <span
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              color:
                                ep.statusCode >= 200 && ep.statusCode < 300
                                  ? '#34d399'
                                  : ep.statusCode >= 300 && ep.statusCode < 400
                                  ? '#60a5fa'
                                  : ep.statusCode >= 400 && ep.statusCode < 500
                                  ? '#fbbf24'
                                  : '#f87171',
                            }}
                          >
                            {ep.statusCode}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Source */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            fontWeight: 600,
                            backgroundColor: sBadge.bg,
                            color: sBadge.color,
                          }}
                        >
                          {ep.discoverySource}
                        </span>
                      </td>

                      {/* Response Time */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {ep.responseTimeMs ? `${ep.responseTimeMs}ms` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
