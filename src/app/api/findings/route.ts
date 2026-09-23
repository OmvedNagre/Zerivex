import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { query } from '@/core/db/database';
import { FindingRecord } from '@/core/scanner/scan-runner';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'findings:read');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const searchParams = req.nextUrl.searchParams;

    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const targetId = searchParams.get('targetId');

    let sql = `
      SELECT
        f.id,
        f.scan_id as "scanId",
        f.target_id as "targetId",
        f.organization_id as "organizationId",
        f.rule_id as "ruleId",
        f.title,
        f.severity,
        f.confidence,
        f.category,
        f.resource_endpoint as "resourceEndpoint",
        f.evidence_json as "evidenceJson",
        f.status,
        f.accepted_risk_reason as "acceptedRiskReason",
        f.cwe_id as "cweId",
        f.owasp_category as "owaspCategory",
        f.created_at as "createdAt",
        t.target_url as "targetUrl"
      FROM findings f
      JOIN targets t ON t.id = f.target_id
      WHERE f.organization_id = $1
    `;

    const params: unknown[] = [orgCtx.organizationId];

    if (severity) {
      params.push(severity);
      sql += ` AND f.severity = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND f.status = $${params.length}`;
    }

    if (targetId) {
      params.push(targetId);
      sql += ` AND f.target_id = $${params.length}`;
    }

    sql += `
      ORDER BY
        CASE f.severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END ASC,
        f.created_at DESC
      LIMIT 100
    `;

    const res = await query<FindingRecord & { targetUrl: string }>(sql, params);

    return NextResponse.json({
      success: true,
      data: {
        findings: res.rows,
        total: res.rows.length,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
