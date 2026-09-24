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

    const gate = evaluateQualityGate(scanJob, findings, policy);

    return new NextResponse(gate.markdownSummary, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'X-Zerivex-Gate': gate.passed ? 'PASSED' : 'FAILED',
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
