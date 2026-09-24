'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Target } from '@/core/targets/target-service';
import { QualityGatePolicy } from '@/core/cicd/quality-gate-engine';

export default function TargetCiCdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [target, setTarget] = useState<Target | null>(null);
  const [policy, setPolicy] = useState<QualityGatePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Snippet format selector
  const [activeSnippetTab, setActiveSnippetTab] = useState<'github' | 'gitlab' | 'curl'>('github');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Policy Form state
  const [minSecurityScore, setMinSecurityScore] = useState(80);
  const [failOnCritical, setFailOnCritical] = useState(true);
  const [maxHighFindings, setMaxHighFindings] = useState(0);
  const [maxMediumFindings, setMaxMediumFindings] = useState(5);
  const [failOnNewFindings, setFailOnNewFindings] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch target details
      const targetRes = await fetch(`/api/targets/${id}`);
      const targetData = await targetRes.json();
      if (!targetRes.ok) throw new Error(targetData.error || 'Failed to fetch target');
      setTarget(targetData.data.target);

      // Fetch quality gate policy
      const gateRes = await fetch(`/api/quality-gates?targetId=${id}`);
      const gateData = await gateRes.json();
      if (gateRes.ok && gateData.data?.policy) {
        const p: QualityGatePolicy = gateData.data.policy;
        setPolicy(p);
        setMinSecurityScore(p.minSecurityScore);
        setFailOnCritical(p.failOnCritical);
        setMaxHighFindings(p.maxHighFindings);
        setMaxMediumFindings(p.maxMediumFindings);
        setFailOnNewFindings(p.failOnNewFindings);
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPolicy(true);
      setSaveSuccess(false);

      const res = await fetch('/api/quality-gates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: id,
          minSecurityScore,
          failOnCritical,
          maxHighFindings,
          maxMediumFindings,
          failOnNewFindings,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save quality gate policy');

      setPolicy(data.data.policy);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(`Error saving policy: ${(err as Error).message}`);
    } finally {
      setSavingPolicy(false);
    }
  };

  const copySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  // Generate GitHub Actions workflow
  const githubActionsYaml = `name: Zerivex Security Gate & Code Scanning

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  zerivex-scan:
    name: Zerivex Security Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source
        uses: actions/checkout@v4

      - name: Execute Zerivex Pipeline Assessment
        id: zerivex
        run: |
          echo "Initiating automated security scan for target ${target?.hostname || 'app'}..."
          RESPONSE=$(curl -s -X POST "https://zerivex.com/api/v1/ci/scan" \\
            -H "Authorization: Bearer \${{ secrets.ZERIVEX_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "targetId": "${id}",
              "scanMode": "${target?.verificationStatus === 'VERIFIED' ? 'VERIFIED_ACTIVE' : 'PUBLIC_PASSIVE'}",
              "wait": true
            }')
          
          echo "$RESPONSE" > zerivex-output.json
          cat zerivex-output.json
          
          SCAN_ID=$(jq -r '.scanId' zerivex-output.json)
          GATE_PASSED=$(jq -r '.gate.passed' zerivex-output.json)
          SCORE=$(jq -r '.score' zerivex-output.json)
          
          # Fetch OASIS SARIF v2.1.0 for GitHub Code Scanning
          curl -s -H "Authorization: Bearer \${{ secrets.ZERIVEX_API_KEY }}" \\
            "https://zerivex.com/api/v1/ci/scans/$SCAN_ID/sarif" > zerivex-results.sarif

          echo "score=$SCORE" >> $GITHUB_OUTPUT
          echo "gate_passed=$GATE_PASSED" >> $GITHUB_OUTPUT

          if [ "$GATE_PASSED" != "true" ]; then
            echo "❌ Zerivex Quality Gate FAILED (Score: $SCORE)"
            exit 1
          fi

      - name: Upload SARIF to GitHub Code Scanning
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: zerivex-results.sarif
`;

  // Generate GitLab CI snippet
  const gitlabCiYaml = `zerivex_security_gate:
  stage: test
  image: alpine:latest
  before_script:
    - apk add --no-cache curl jq
  script:
    - |
      RESPONSE=$(curl -s -X POST "https://zerivex.com/api/v1/ci/scan" \\
        -H "Authorization: Bearer $ZERIVEX_API_KEY" \\
        -H "Content-Type: application/json" \\
        -d '{"targetId": "${id}", "wait": true}')
      SCAN_ID=$(echo "$RESPONSE" | jq -r '.scanId')
      GATE_PASSED=$(echo "$RESPONSE" | jq -r '.gate.passed')
      curl -s -H "Authorization: Bearer $ZERIVEX_API_KEY" \\
        "https://zerivex.com/api/v1/ci/scans/$SCAN_ID/sarif" > zerivex-results.sarif
      if [ "$GATE_PASSED" != "true" ]; then
        echo "❌ Zerivex Security Quality Gate Failed!"
        exit 1
      fi
  artifacts:
    reports:
      sast: zerivex-results.sarif
`;

  // Generate cURL / CLI snippet
  const curlCliScript = `#!/usr/bin/env bash
# Zerivex Pipeline Security Assessment
export ZERIVEX_API_KEY="\${ZERIVEX_API_KEY:-your_api_key_here}"
TARGET_ID="${id}"

echo "Starting Zerivex scan for $TARGET_ID..."
RESPONSE=$(curl -s -X POST "https://zerivex.com/api/v1/ci/scan" \\
  -H "Authorization: Bearer $ZERIVEX_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"targetId": "'$TARGET_ID'", "wait": true}')

GATE_PASSED=$(echo "$RESPONSE" | jq -r '.gate.passed')
SCORE=$(echo "$RESPONSE" | jq -r '.score')
echo "Security Score: $SCORE/100 | Gate Status: $GATE_PASSED"

if [ "$GATE_PASSED" != "true" ]; then
  echo "❌ Quality Gate Failed: $(echo "$RESPONSE" | jq -r '.gate.summaryText')"
  exit 1
fi

echo "✅ Quality Gate Passed!"
exit 0
`;

  const currentSnippet =
    activeSnippetTab === 'github'
      ? githubActionsYaml
      : activeSnippetTab === 'gitlab'
      ? gitlabCiYaml
      : curlCliScript;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link
            href={`/dashboard/targets/${id}`}
            style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}
          >
            ← Target Details
          </Link>
          <span style={{ color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>CI/CD & Integrations</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
              CI/CD Pipeline Integration Hub
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.4rem' }}>
              Target: <strong style={{ color: 'var(--text-primary)' }}>{target?.hostname || 'Loading...'}</strong> ({target?.targetUrl})
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link
              href="/dashboard/settings/api-keys"
              style={{
                padding: '0.55rem 1rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                textDecoration: 'none',
              }}
            >
              Manage API Keys ↗
            </Link>
          </div>
        </div>
      </div>

      {/* Target Subsystem Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
        <Link
          href={`/dashboard/targets/${id}`}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
        >
          Overview
        </Link>
        <Link
          href={`/dashboard/targets/${id}/surface`}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
        >
          Attack Surface Map
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
          }}
        >
          Continuous Monitoring
        </Link>
        <Link
          href={`/dashboard/targets/${id}/ci-cd`}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            fontWeight: 600,
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            textDecoration: 'none',
          }}
        >
          ⚙️ CI/CD & Integrations
        </Link>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading CI/CD configuration...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '2rem' }}>
          {/* Left Column: Quality Gate Configuration */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--card-bg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🛡️</span>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>
                  {policy?.name || 'Security Quality Gate Policy'}
                </h2>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.4rem 0 0 0' }}>
                Define the security rules that block PR merges or fail CI/CD build pipelines for this target.
              </p>
            </div>

            {saveSuccess && (
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: 'var(--radius-md)', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
                ✓ Quality Gate Policy successfully updated.
              </div>
            )}

            <form onSubmit={handleSavePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Minimum Security Score</label>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: minSecurityScore >= 80 ? '#10b981' : '#f59e0b' }}>
                    {minSecurityScore} / 100
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={minSecurityScore}
                  onChange={(e) => setMinSecurityScore(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  Pipelines will fail if the target security score drops below this threshold.
                </span>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Fail on Any Critical Finding</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Immediately break build on SQLi, RCE, or exposed secret findings</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={failOnCritical}
                    onChange={(e) => setFailOnCritical(e.target.checked)}
                    style={{ width: '1.1rem', height: '1.1rem' }}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Max Allowed High Findings</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fail pipeline if High count exceeds limit</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={maxHighFindings}
                    onChange={(e) => setMaxHighFindings(Number(e.target.value))}
                    style={{
                      width: '60px',
                      padding: '0.35rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Max Allowed Medium Findings</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fail pipeline if Medium count exceeds limit</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={maxMediumFindings}
                    onChange={(e) => setMaxMediumFindings(Number(e.target.value))}
                    style={{
                      width: '60px',
                      padding: '0.35rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                    }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Fail on New Regressions</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Block build if any new vulnerability is introduced compared to previous baseline</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={failOnNewFindings}
                    onChange={(e) => setFailOnNewFindings(e.target.checked)}
                    style={{ width: '1.1rem', height: '1.1rem' }}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={savingPolicy}
                style={{
                  padding: '0.65rem 1rem',
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  marginTop: '0.5rem',
                }}
              >
                {savingPolicy ? 'Saving Policy...' : 'Save Quality Gate Settings'}
              </button>
            </form>
          </div>

          {/* Right Column: Code Snippet Generator */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--card-bg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Automated Pipeline Config</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Copy-pasteable configurations for your CI/CD runner.
                </p>
              </div>

              <button
                onClick={() => copySnippet(currentSnippet)}
                style={{
                  padding: '0.4rem 0.85rem',
                  backgroundColor: copiedSnippet ? '#10b981' : 'var(--bg-secondary)',
                  color: copiedSnippet ? '#fff' : 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copiedSnippet ? '✓ Copied!' : 'Copy Snippet'}
              </button>
            </div>

            {/* Snippet Format Selector */}
            <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              {[
                { id: 'github', label: 'GitHub Actions' },
                { id: 'gitlab', label: 'GitLab CI' },
                { id: 'curl', label: 'cURL / Shell' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSnippetTab(tab.id as 'github' | 'gitlab' | 'curl')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: activeSnippetTab === tab.id ? 'var(--primary)' : 'transparent',
                    color: activeSnippetTab === tab.id ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Code Block */}
            <pre
              style={{
                margin: 0,
                padding: '1rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'monospace',
                fontSize: '0.78rem',
                lineHeight: 1.45,
                overflowX: 'auto',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                maxHeight: '420px',
              }}
            >
              {currentSnippet}
            </pre>

            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--primary)' }}>
              💡 <strong>GitHub Code Scanning:</strong> Uploading the SARIF artifact embeds inline vulnerability alerts directly inside GitHub pull request diffs and the repository Security tab.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
