/**
 * Zerivex Reporting Engine
 * Generates technical JSON exports and print-optimized executive HTML/PDF security reports.
 * Completely deterministic with zero hallucinated scores or findings.
 */

import { query } from '@/core/db/database';
import { getRemediationForRule } from '@/core/remediation/remediation-catalog';
import { FindingRecord, ScanJobRecord } from '@/core/scanner/scan-runner';
import { getAgencyBranding } from '@/core/agency/agency-service';
import { AgencyBrandingRecord } from '@/core/agency/types';

export interface ScanReportData {
  scanJob: ScanJobRecord & { targetUrl: string; targetHostname: string; organizationName: string };
  findings: FindingRecord[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
}

/**
 * Fetch and aggregate scan data for reporting.
 */
export async function getScanReportData(
  scanJobId: string,
  organizationId: string
): Promise<ScanReportData> {
  const scanRes = await query<ScanJobRecord & { targetUrl: string; targetHostname: string; organizationName: string }>(
    `
    SELECT
      s.id,
      s.organization_id as "organizationId",
      s.target_id as "targetId",
      s.requester_user_id as "requesterUserId",
      s.scan_mode as "scanMode",
      s.status,
      s.score,
      s.started_at as "startedAt",
      s.completed_at as "completedAt",
      s.worker_id as "workerId",
      s.error_message as "errorMessage",
      s.created_at as "createdAt",
      t.target_url as "targetUrl",
      t.hostname as "targetHostname",
      o.name as "organizationName"
    FROM scan_jobs s
    JOIN targets t ON t.id = s.target_id
    JOIN organizations o ON o.id = s.organization_id
    WHERE s.id = $1 AND s.organization_id = $2
    `,
    [scanJobId, organizationId]
  );

  const scanJob = scanRes.rows[0];
  if (!scanJob) {
    throw new Error(`Scan "${scanJobId}" not found or unauthorized`);
  }

  const findingsRes = await query<FindingRecord>(
    `
    SELECT
      id,
      scan_id as "scanId",
      target_id as "targetId",
      organization_id as "organizationId",
      rule_id as "ruleId",
      title,
      severity,
      confidence,
      category,
      resource_endpoint as "resourceEndpoint",
      evidence_json as "evidenceJson",
      status,
      accepted_risk_reason as "acceptedRiskReason",
      cwe_id as "cweId",
      owasp_category as "owaspCategory",
      created_at as "createdAt"
    FROM findings
    WHERE scan_id = $1 AND organization_id = $2
    ORDER BY
      CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
      END ASC,
      created_at DESC
    `,
    [scanJobId, organizationId]
  );

  const findings = findingsRes.rows;

  const summary = {
    total: findings.length,
    critical: findings.filter((f) => f.severity === 'CRITICAL').length,
    high: findings.filter((f) => f.severity === 'HIGH').length,
    medium: findings.filter((f) => f.severity === 'MEDIUM').length,
    low: findings.filter((f) => f.severity === 'LOW').length,
    informational: findings.filter((f) => f.severity === 'INFORMATIONAL').length,
  };

  return {
    scanJob,
    findings,
    summary,
  };
}

/**
 * Generate a complete, machine-readable technical JSON report.
 */
export async function generateTechnicalJsonReport(
  scanJobId: string,
  organizationId: string,
  customBranding?: AgencyBrandingRecord | null
): Promise<Record<string, unknown>> {
  const { scanJob, findings, summary } = await getScanReportData(scanJobId, organizationId);
  const branding = customBranding !== undefined ? customBranding : await getAgencyBranding(organizationId);

  const enrichedFindings = findings.map((f) => {
    const remediation = getRemediationForRule(f.ruleId);
    return {
      id: f.id,
      ruleId: f.ruleId,
      title: f.title,
      severity: f.severity,
      confidence: f.confidence,
      category: f.category,
      status: f.status,
      acceptedRiskReason: f.acceptedRiskReason,
      cweId: f.cweId,
      owaspCategory: f.owaspCategory,
      resourceEndpoint: f.resourceEndpoint,
      remediation: {
        summary: remediation.summary,
        impact: remediation.impact,
        cliVerification: remediation.cliVerification,
        frameworks: remediation.frameworks,
      },
      evidence: f.evidenceJson,
      detectedAt: f.createdAt,
    };
  });

  return {
    schemaVersion: '1.0.0',
    reportType: 'ZERIVEX_TECHNICAL_SECURITY_REPORT',
    generator: branding?.companyName ? `${branding.companyName} Security Engine` : 'Zerivex Deterministic Scanner v1.0',
    generatedAt: new Date().toISOString(),
    organization: {
      id: scanJob.organizationId,
      name: scanJob.organizationName,
    },
    branding: branding
      ? {
          companyName: branding.companyName,
          logoUrl: branding.logoUrl,
          primaryColor: branding.primaryColor,
          reportFooterText: branding.reportFooterText,
          supportEmail: branding.supportEmail,
        }
      : null,
    scan: {
      id: scanJob.id,
      targetUrl: scanJob.targetUrl,
      targetHostname: scanJob.targetHostname,
      scanMode: scanJob.scanMode,
      status: scanJob.status,
      score: scanJob.score,
      startedAt: scanJob.startedAt,
      completedAt: scanJob.completedAt,
    },
    metrics: summary,
    findings: enrichedFindings,
  };
}

/**
 * Generate a print-ready Executive HTML / PDF security report.
 * Embedded styles and @media print directives allow pristine rendering and 1-click browser PDF export.
 */
export async function generateExecutiveHtmlReport(
  scanJobId: string,
  organizationId: string,
  customBranding?: AgencyBrandingRecord | null
): Promise<string> {
  const { scanJob, findings, summary } = await getScanReportData(scanJobId, organizationId);
  const branding = customBranding !== undefined ? customBranding : await getAgencyBranding(organizationId);

  const brandColor = branding?.primaryColor || '#0f172a';
  const scoreColor =
    scanJob.score === null
      ? '#64748b'
      : scanJob.score >= 85
      ? '#10b981'
      : scanJob.score >= 70
      ? '#f59e0b'
      : '#ef4444';

  const riskLevel =
    scanJob.score === null
      ? 'Pending'
      : scanJob.score >= 85
      ? 'Low Risk'
      : scanJob.score >= 70
      ? 'Moderate Risk'
      : scanJob.score >= 50
      ? 'High Risk'
      : 'Critical Risk';

  const findingsHtml = findings
    .map((f, index) => {
      const remediation = getRemediationForRule(f.ruleId);
      const sevColor =
        f.severity === 'CRITICAL'
          ? '#ef4444'
          : f.severity === 'HIGH'
          ? '#f97316'
          : f.severity === 'MEDIUM'
          ? '#f59e0b'
          : '#3b82f6';

      const diffEntries = Object.entries(remediation.frameworks || {});
      const diffsHtml = diffEntries.length
        ? diffEntries
            .map(
              ([framework, data]) => `
            <div style="margin-top: 10px;">
              <div style="font-weight: 600; font-size: 11px; text-transform: uppercase; color: #475569;">
                Framework: ${framework} (${data.filename})
              </div>
              <p style="font-size: 12px; margin: 4px 0 8px; color: #334155;">${data.explanation}</p>
              <pre style="background: #0f172a; color: #f8fafc; padding: 10px; border-radius: 4px; font-size: 11px; overflow-x: auto; margin: 0; line-height: 1.4;"><code>${escapeHtml(
                data.diff
              )}</code></pre>
            </div>
          `
            )
            .join('')
        : '<p style="font-size: 12px; color: #64748b;">Review server configuration settings to address this item.</p>';

      return `
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 18px; margin-bottom: 20px; page-break-inside: avoid; background: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span style="display: inline-block; background: ${sevColor}15; color: ${sevColor}; border: 1px solid ${sevColor}40; font-weight: 700; font-size: 10px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                ${f.severity}
              </span>
              <span style="font-family: monospace; font-size: 11px; color: #64748b; margin-left: 8px;">
                ${f.ruleId}
              </span>
              <span style="font-size: 11px; color: #64748b; margin-left: 8px;">
                Status: <strong>${f.status}</strong>
              </span>
            </div>
            <div style="font-size: 11px; color: #64748b;">
              Finding #${index + 1}
            </div>
          </div>

          <h3 style="margin: 6px 0 10px; font-size: 16px; color: #0f172a;">
            ${escapeHtml(f.title)}
          </h3>

          <div style="font-size: 12px; color: #475569; margin-bottom: 10px;">
            <strong>Target Endpoint:</strong> <code style="background: #f1f5f9; padding: 2px 5px; border-radius: 3px;">${escapeHtml(
              f.resourceEndpoint
            )}</code>
          </div>

          ${
            f.cweId || f.owaspCategory
              ? `
            <div style="display: flex; gap: 15px; font-size: 11px; color: #64748b; margin-bottom: 12px;">
              ${f.cweId ? `<div><strong>CWE:</strong> ${escapeHtml(f.cweId)}</div>` : ''}
              ${f.owaspCategory ? `<div><strong>OWASP:</strong> ${escapeHtml(f.owaspCategory)}</div>` : ''}
            </div>
          `
              : ''
          }

          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; font-size: 12px; color: #1e293b; margin-bottom: 4px;">Security Impact:</div>
            <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${escapeHtml(remediation.impact)}</p>
          </div>

          <div style="margin-bottom: 14px;">
            <div style="font-weight: 600; font-size: 12px; color: #1e293b; margin-bottom: 4px;">Remediation Guide:</div>
            <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${escapeHtml(remediation.summary)}</p>
            ${diffsHtml}
          </div>

          ${
            remediation.cliVerification
              ? `
            <div style="margin-bottom: 14px; background: #f8fafc; padding: 8px 12px; border-radius: 4px; border: 1px solid #e2e8f0;">
              <div style="font-weight: 600; font-size: 11px; color: #475569; margin-bottom: 2px;">Local CLI Verification Command:</div>
              <code style="font-size: 11px; color: #0f172a; word-break: break-all;">${escapeHtml(
                remediation.cliVerification
              )}</code>
            </div>
          `
              : ''
          }

          <details style="margin-top: 10px;">
            <summary style="font-size: 11px; color: #64748b; cursor: pointer; font-weight: 600;">
              Deterministic Evidence (Redacted per ADR-0007)
            </summary>
            <pre style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; font-size: 10px; color: #334155; border-radius: 4px; overflow-x: auto; margin-top: 6px;"><code>${escapeHtml(
              JSON.stringify(f.evidenceJson, null, 2)
            )}</code></pre>
          </details>
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${branding ? escapeHtml(branding.companyName) : 'Zerivex'} Security Assessment Report — ${escapeHtml(scanJob.targetHostname)}</title>
  <style>
    @page {
      margin: 1.5cm;
      size: A4 portrait;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.5;
      margin: 0;
      padding: 24px;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .header-bar {
      border-bottom: 2px solid ${brandColor};
      padding-bottom: 18px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .logo {
      font-weight: 800;
      font-size: 22px;
      letter-spacing: -0.02em;
      color: ${brandColor};
    }
    .tagline {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .scorecard {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 24px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 24px;
      background: #f8fafc;
      margin-bottom: 30px;
    }
    .score-circle {
      text-align: center;
      border-right: 1px solid #e2e8f0;
      padding-right: 24px;
    }
    .score-val {
      font-size: 54px;
      font-weight: 800;
      line-height: 1;
      font-family: monospace;
      color: ${scoreColor};
    }
    .metrics-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .metrics-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .metrics-table tr:last-child td {
      border-bottom: none;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Action Bar for Browsers -->
    <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: flex-end; gap: 10px;">
      <button onclick="window.print()" style="background: ${brandColor}; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">
        🖨️ Print or Save as PDF
      </button>
      <a href="?format=json" style="background: #f1f5f9; color: #0f172a; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; border: 1px solid #cbd5e1;">
        ⬇ Download Technical JSON
      </a>
    </div>

    <!-- Header -->
    <div class="header-bar">
      <div>
        ${branding?.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.companyName)}" style="max-height: 44px; max-width: 220px; object-fit: contain; margin-bottom: 8px; display: block;" />` : ''}
        <div class="logo">${escapeHtml(branding?.companyName || 'ZERIVEX')}</div>
        <div class="tagline">
          ${branding ? `Security Assessment &bull; Powered by Zerivex Engine` : 'Security for software built with AI. &bull; <em>Verify. Detect. Defend.</em>'}
          ${branding?.supportEmail ? ` &bull; Contact: <a href="mailto:${escapeHtml(branding.supportEmail)}" style="color: inherit; text-decoration: underline;">${escapeHtml(branding.supportEmail)}</a>` : ''}
        </div>
      </div>
      <div style="text-align: right; font-size: 12px; color: #64748b;">
        <div><strong>Assessment Report</strong></div>
        <div>Date: ${new Date().toLocaleDateString()}</div>
        <div style="font-family: monospace; font-size: 10px;">Scan: ${scanJob.id.substring(0, 13)}...</div>
      </div>
    </div>

    <!-- Scope & Target Meta -->
    <div style="margin-bottom: 24px;">
      <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 6px;">
        Security Audit: ${escapeHtml(scanJob.targetUrl)}
      </h1>
      <div style="font-size: 12px; color: #64748b; display: flex; gap: 20px;">
        <div>Organization: <strong>${escapeHtml(scanJob.organizationName)}</strong></div>
        <div>Scan Mode: <strong>${scanJob.scanMode}</strong></div>
        <div>Duration: <strong>${
          scanJob.completedAt && scanJob.startedAt
            ? Math.max(1, Math.round((new Date(scanJob.completedAt).getTime() - new Date(scanJob.startedAt).getTime()) / 1000)) + 's'
            : '—'
        }</strong></div>
      </div>
    </div>

    <!-- Executive Scorecard -->
    <div class="scorecard">
      <div class="score-circle">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">
          Security Score
        </div>
        <div class="score-val">${scanJob.score !== null ? scanJob.score : '—'}</div>
        <div style="font-size: 12px; font-weight: 600; color: ${scoreColor}; margin-top: 6px;">
          ${riskLevel}
        </div>
      </div>

      <div>
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">
          Verified Findings Breakdown
        </div>
        <table class="metrics-table">
          <tr>
            <td><strong style="color: #ef4444;">Critical Severity (-25 pts)</strong></td>
            <td style="text-align: right; font-weight: 700; font-family: monospace;">${summary.critical}</td>
          </tr>
          <tr>
            <td><strong style="color: #f97316;">High Severity (-15 pts)</strong></td>
            <td style="text-align: right; font-weight: 700; font-family: monospace;">${summary.high}</td>
          </tr>
          <tr>
            <td><strong style="color: #f59e0b;">Medium Severity (-5 pts)</strong></td>
            <td style="text-align: right; font-weight: 700; font-family: monospace;">${summary.medium}</td>
          </tr>
          <tr>
            <td><strong style="color: #3b82f6;">Low Severity (-2 pts)</strong></td>
            <td style="text-align: right; font-weight: 700; font-family: monospace;">${summary.low}</td>
          </tr>
          <tr>
            <td><strong>Total Confirmed Vulnerabilities</strong></td>
            <td style="text-align: right; font-weight: 800; font-family: monospace;">${summary.total}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Findings Section -->
    <h2 style="font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px;">
      Vulnerability Details & Remediation Guidance (${findings.length})
    </h2>

    ${
      findings.length === 0
        ? `
      <div style="padding: 30px; text-align: center; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
        <div style="font-size: 24px;">🛡️</div>
        <h3 style="margin: 6px 0; color: #0f172a;">No Vulnerabilities Detected</h3>
        <p style="font-size: 13px; color: #64748b; margin: 0;">
          All deterministic security checks completed cleanly. Baseline score: 100/100.
        </p>
      </div>
    `
        : findingsHtml
    }

    <!-- Footer & Governance Statement -->
    <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center;">
      ${
        branding?.reportFooterText
          ? `<div style="margin-bottom: 12px; padding: 10px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; color: #334155; font-size: 12px; font-weight: 500;">
              ${escapeHtml(branding.reportFooterText)}
            </div>`
          : ''
      }
      <p style="margin: 0 0 4px;">
        <strong>${branding ? escapeHtml(branding.companyName).toUpperCase() : 'ZERIVEX'} SECURITY GUARANTEE:</strong> Every finding documented in this report was verified through deterministic checks against live endpoint responses. No findings, scores, or evidence in this report are simulated or hallucinated.
      </p>
      <p style="margin: 0;">
        All captured evidence was scrubbed synchronously prior to persistence per ADR-0007. Report generated on ${new Date().toUTCString()}.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
