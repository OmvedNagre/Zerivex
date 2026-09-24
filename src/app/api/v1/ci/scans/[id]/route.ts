import { NextRequest, NextResponse } from 'next/server';
import { requireApiOrSessionAuth, handleAuthError } from '@/core/rbac/authorization-guard';
import { getScanJobById } from '@/core/scanner/scan-runner';
import { getEffectiveQualityGatePolicy } from '@/core/cicd/quality-gate-repository';
import { evaluateQualityGate } from '@/core/cicd/quality-gate-engine';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'scans:read');
    const { id } = await context.params;

    const { scanJob, findings } = await getScanJobById(id, auth.organizationId);

    const policy = await getEffectiveQualityGatePolicy(
      auth.organizationId,
      scanJob.targetId
    );

    const gateResult = evaluateQualityGate(scanJob, findings, policy);

    const response = NextResponse.json({
      success: true,
      scanJob,
      findingsCount: {
        total: findings.length,
        critical: findings.filter((f) => f.severity === 'CRITICAL').length,
        high: findings.filter((f) => f.severity === 'HIGH').length,
        medium: findings.filter((f) => f.severity === 'MEDIUM').length,
        low: findings.filter((f) => f.severity === 'LOW').length,
        informational: findings.filter((f) => f.severity === 'INFORMATIONAL').length,
      },
      gate: gateResult,
      sarifUrl: `/api/v1/ci/scans/${id}/sarif`,
      summaryUrl: `/api/v1/ci/scans/${id}/summary`,
    });

    response.headers.set('X-Zerivex-Gate', gateResult.passed ? 'PASSED' : 'FAILED');
    if (scanJob.score !== null) {
      response.headers.set('X-Zerivex-Score', String(scanJob.score));
    }

    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
