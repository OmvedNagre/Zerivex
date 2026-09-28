'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Target, VerificationMethod } from '@/core/targets/target-service';

interface Instructions {
  method: VerificationMethod;
  token: string;
  dnsHost: string;
  dnsHostShort?: string;
  dnsApexHost?: string;
  apexDomain?: string;
  dnsRecordValue: string;
  dnsRecordValuePlain?: string;
  htmlMetaTag: string;
  httpHeaderName: string;
  httpHeaderValue: string;
  fileUrl?: string;
  fileContent?: string;
}

export default function TargetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [target, setTarget] = useState<Target | null>(null);
  const [instructions, setInstructions] = useState<Instructions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestScan, setLatestScan] = useState<{ id: string; score: number | null; createdAt: string } | null>(null);
  const [scanning, setScanning] = useState(false);

  // Verification execution state
  const [selectedMethod, setSelectedMethod] = useState<VerificationMethod | 'HTTP_FILE'>('DNS_TXT');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    diagnostic: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchTargetData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/targets/${id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch target details');
      }
      setTarget(data.data.target);
      setInstructions(data.data.instructions);
      setSelectedMethod(data.data.target.verificationMethod || 'DNS_TXT');
      setError(null);

      // Fetch latest scan for this target
      try {
        const scansRes = await fetch(`/api/scans?targetId=${id}`);
        if (scansRes.ok) {
          const scansData = await scansRes.json();
          const scanList = scansData.data?.scans || [];
          if (scanList.length > 0) {
            setLatestScan(scanList[0]);
          }
        }
      } catch {
        // Silently ignore scan fetch error
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTargetData();
  }, [fetchTargetData]);

  const handleVerify = async (bypass: boolean = false) => {
    setVerifying(true);
    setVerificationResult(null);

    try {
      const payload = bypass
        ? { bypass: true, preferredMethod: 'MANUAL_BYPASS' }
        : { preferredMethod: selectedMethod === 'HTTP_FILE' ? 'HTML_META' : selectedMethod };

      const res = await fetch(`/api/targets/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setVerificationResult({
        success: data.success,
        diagnostic: data.data?.diagnostic || data.error || 'Verification check finished',
      });

      if (data.success) {
        await fetchTargetData();
      }
    } catch (err) {
      setVerificationResult({
        success: false,
        diagnostic: (err as Error).message,
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleRunScan = async () => {
    if (!target) return;
    try {
      setScanning(true);
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: target.id,
          scanMode: target.verificationStatus === 'VERIFIED' ? 'VERIFIED_ACTIVE' : 'PUBLIC_PASSIVE',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to trigger scan');
      }
      const newScanId = data.data?.scanJob?.id;
      if (newScanId) {
        router.push(`/dashboard/scans/${newScanId}`);
      } else {
        router.push('/dashboard/scans');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading target verification center...
      </div>
    );
  }

  if (error || !target || !instructions) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: 'var(--radius-md)' }}>
          {error || 'Target not found'}
        </div>
        <Link href="/dashboard/targets" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
          ← Back to Targets
        </Link>
      </div>
    );
  }

  const isVerified = target.verificationStatus === 'VERIFIED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px' }}>
      {/* Breadcrumb & Header */}
      <div>
        <Link
          href="/dashboard/targets"
          style={{
            color: 'var(--text-muted)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginBottom: '0.75rem',
          }}
        >
          ← Back to Targets
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
              {target.targetUrl}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Hostname: <code style={{ color: 'var(--accent-primary)' }}>{target.hostname}</code> • Scope: <strong>{target.verificationScope}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {latestScan && (
              <Link
                href={`/dashboard/scans/${latestScan.id}`}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>📊</span>
                <span>Latest Report ({latestScan.score !== null ? `${latestScan.score}/100` : 'Pending'})</span>
              </Link>
            )}

            <button
              onClick={handleRunScan}
              disabled={scanning}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: scanning ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="Launch instant security scan against target"
            >
              {scanning ? (
                <>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Run Security Scan</span>
                </>
              )}
            </button>

            {isVerified ? (
              <span
                style={{
                  padding: '0.4rem 0.9rem',
                  borderRadius: '9999px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                ✓ VERIFIED TARGET
              </span>
            ) : (
              <span
                style={{
                  padding: '0.4rem 0.9rem',
                  borderRadius: '9999px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                ⚠️ VERIFICATION REQUIRED
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          <span
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
            }}
          >
            Verification Center
          </span>
          <Link
            href={`/dashboard/targets/${id}/surface`}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              transition: 'color var(--transition-fast)',
            }}
          >
            Attack Surface Map ↗
          </Link>
          <Link
            href={`/dashboard/targets/${id}/monitoring`}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              transition: 'color var(--transition-fast)',
            }}
          >
            Continuous Monitoring ↗
          </Link>
          <Link
            href={`/dashboard/targets/${id}/ci-cd`}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              transition: 'color var(--transition-fast)',
            }}
          >
            CI/CD & Integrations ↗
          </Link>
        </div>
      </div>

      {/* Verification Status Banner */}
      {isVerified ? (
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <span style={{ fontSize: '1.75rem' }}>🛡️</span>
          <div>
            <div style={{ fontWeight: 600, color: '#34d399', fontSize: '0.95rem' }}>
              Domain Ownership Confirmed
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
              Verified via {target.verificationMethod} on {target.verifiedAt ? new Date(target.verifiedAt).toLocaleString() : 'recently'}. This target is fully authorized for active vulnerability assessments.
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <span style={{ fontSize: '1.75rem' }}>🔒</span>
          <div>
            <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: '0.95rem' }}>
              Scanning Authorization Locked
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
              Per Zerivex ADR-0008, active security scanning requires explicit domain ownership verification to prevent unauthorized intrusion testing.
            </div>
          </div>
        </div>
      )}

      {/* Verification Instructions Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '2rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          Domain Ownership Verification Instructions
        </h2>

        {/* Method Selector Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
          {(
            [
              { id: 'DNS_TXT', label: 'DNS TXT Record' },
              { id: 'HTML_META', label: 'HTML Meta Tag' },
              { id: 'HTTP_HEADER', label: 'HTTP Header' },
              { id: 'HTTP_FILE', label: 'File (.well-known)' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMethod(m.id)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: selectedMethod === m.id ? 'var(--accent-primary)' : 'transparent',
                color: selectedMethod === m.id ? '#fff' : 'var(--text-secondary)',
                border: selectedMethod === m.id ? 'none' : '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Instructions Body */}
        {selectedMethod === 'DNS_TXT' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Add a DNS <strong>TXT</strong> record in your domain manager (Cloudflare, Vercel, GoDaddy, Hostinger, Route 53, Namecheap, etc.):
            </p>

            {/* Provider Tip Callout */}
            <div
              style={{
                padding: '0.85rem 1rem',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                color: '#7dd3fc',
                lineHeight: 1.5,
              }}
            >
              💡 <strong>DNS Provider Tip:</strong> If your DNS is managed on Cloudflare, Vercel, GoDaddy, or Hostinger, paste <strong><code>{instructions.dnsHostShort || '_zerivex-challenge'}</code></strong> into the <strong>Name / Host</strong> field. Entering the full domain can cause your provider to create a duplicate name or reject it as an invalid host.
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  HOST / NAME (RECOMMENDED FOR CLOUDFLARE, VERCEL, GODADDY)
                </span>
                <button
                  onClick={() => copyToClipboard(instructions.dnsHostShort || '_zerivex-challenge', 'dnsHostShort')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  {copiedKey === 'dnsHostShort' ? '✓ Copied' : 'Copy Relative Host'}
                </button>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.85rem', border: '1px solid var(--border-color)' }}>
                {instructions.dnsHostShort || '_zerivex-challenge'}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  FULL FQDN (FOR ROUTE 53, NAMECHEAP, MANUAL ZONE FILES)
                </span>
                <button
                  onClick={() => copyToClipboard(instructions.dnsHost, 'dnsHost')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  {copiedKey === 'dnsHost' ? '✓ Copied' : 'Copy Full FQDN'}
                </button>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.85rem', border: '1px solid var(--border-color)' }}>
                {instructions.dnsHost}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>TXT VALUE / CONTENT</span>
                <button
                  onClick={() => copyToClipboard(instructions.dnsRecordValue, 'dnsVal')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  {copiedKey === 'dnsVal' ? '✓ Copied' : 'Copy Value'}
                </button>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.85rem', border: '1px solid var(--border-color)', wordBreak: 'break-all' }}>
                {instructions.dnsRecordValue}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>ALTERNATIVE PLAIN TOKEN (OPTIONAL FORMAT)</span>
                <button
                  onClick={() => copyToClipboard(instructions.dnsRecordValuePlain || instructions.token, 'dnsValPlain')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  {copiedKey === 'dnsValPlain' ? '✓ Copied' : 'Copy Token'}
                </button>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.85rem', border: '1px solid var(--border-color)', wordBreak: 'break-all' }}>
                {instructions.dnsRecordValuePlain || instructions.token}
              </div>
            </div>
          </div>
        )}

        {selectedMethod === 'HTML_META' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Insert the following meta tag inside the <code>&lt;head&gt;</code> element of your target homepage:
            </p>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>HTML META TAG</span>
                <button
                  onClick={() => copyToClipboard(instructions.htmlMetaTag, 'meta')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  {copiedKey === 'meta' ? '✓ Copied' : 'Copy Tag'}
                </button>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.85rem', border: '1px solid var(--border-color)', wordBreak: 'break-all' }}>
                {instructions.htmlMetaTag}
              </div>
            </div>
          </div>
        )}

        {selectedMethod === 'HTTP_HEADER' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Configure your web server (Nginx, Caddy, Cloudflare Workers, Express) to include this response header:
            </p>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>HEADER NAME & VALUE</span>
                <button
                  onClick={() => copyToClipboard(`${instructions.httpHeaderName}: ${instructions.httpHeaderValue}`, 'header')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  {copiedKey === 'header' ? '✓ Copied' : 'Copy Header'}
                </button>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.85rem', border: '1px solid var(--border-color)', wordBreak: 'break-all' }}>
                {instructions.httpHeaderName}: {instructions.httpHeaderValue}
              </div>
            </div>
          </div>
        )}

        {selectedMethod === 'HTTP_FILE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Upload a plain text file containing your verification token to your website:
            </p>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>FILE URL</span>
                <button
                  onClick={() => copyToClipboard(instructions.fileUrl || `${target.targetUrl.replace(/\/+$/, '')}/.well-known/zerivex-verification.txt`, 'fileUrl')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  {copiedKey === 'fileUrl' ? '✓ Copied' : 'Copy File URL'}
                </button>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.85rem', border: '1px solid var(--border-color)', wordBreak: 'break-all' }}>
                {instructions.fileUrl || `${target.targetUrl.replace(/\/+$/, '')}/.well-known/zerivex-verification.txt`}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>FILE CONTENT</span>
                <button
                  onClick={() => copyToClipboard(instructions.fileContent || `zerivex-verification=${instructions.token}`, 'fileContent')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  {copiedKey === 'fileContent' ? '✓ Copied' : 'Copy File Content'}
                </button>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.85rem', border: '1px solid var(--border-color)', wordBreak: 'break-all' }}>
                {instructions.fileContent || `zerivex-verification=${instructions.token}`}
              </div>
            </div>
          </div>
        )}

        {/* Verification Trigger Button & Feedback */}
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <button
              id="verify-domain-button"
              onClick={() => handleVerify(false)}
              disabled={verifying}
              style={{
                padding: '0.75rem 1.75rem',
                backgroundColor: isVerified ? 'var(--bg-secondary)' : 'var(--accent-primary)',
                color: isVerified ? 'var(--text-primary)' : '#fff',
                border: isVerified ? '1px solid var(--border-color)' : 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: verifying ? 'not-allowed' : 'pointer',
                opacity: verifying ? 0.7 : 1,
              }}
            >
              {verifying ? 'Checking Verification...' : isVerified ? 'Re-Verify Ownership' : 'Verify Ownership Now'}
            </button>

            <button
              id="instant-verify-button"
              onClick={() => handleVerify(true)}
              disabled={verifying}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: verifying ? 'not-allowed' : 'pointer',
                opacity: verifying ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all var(--transition-fast)',
              }}
              title="Instantly authorize target for development and platform administration"
            >
              ⚡ Instant Verify (Platform Owner / Sandbox Bypass)
            </button>
          </div>

          {verificationResult && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: verificationResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${verificationResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: verificationResult.success ? '#34d399' : '#f87171',
                fontSize: '0.9rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                {verificationResult.success ? '✓ Verification Successful' : '✗ Verification Failed'}
              </div>
              <div>{verificationResult.diagnostic}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
