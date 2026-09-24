import { NextRequest, NextResponse } from 'next/server';
import { requireApiOrSessionAuth, handleAuthError } from '@/core/rbac/authorization-guard';
import { createScanJob, runScanJob } from '@/core/scanner/scan-runner';
import { getEffectiveQualityGatePolicy } from '@/core/cicd/quality-gate-repository';
import { evaluateQualityGate, QualityGatePolicy } from '@/core/cicd/quality-gate-engine';
import { dispatchWebhookEvent } from '@/core/webhooks/webhook-dispatcher';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { ScanMode } from '@/core/scanner/checks/types';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'scans:create');
    const body = await req.json();

    const {
      targetId,
      scanMode = 'PUBLIC_PASSIVE',
      wait = true,
      gatePolicy: customGatePolicy,
    } = body as {
      targetId: string;
      scanMode?: ScanMode;
      wait?: boolean;
      gatePolicy?: Partial<QualityGatePolicy>;
    };

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'targetId is required' },
        { status: 400 }
      );
    }

    // 1. Create scan job (validates ADR-0008 target verification)
    const scanJob = await createScanJob({
      organizationId: auth.organizationId,
      targetId,
      requesterUserId: auth.userId,
      scanMode,
    });

    await recordAuditEvent({
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action: 'CI_SCAN_TRIGGERED',
      resourceType: 'scan_job',
      resourceId: scanJob.id,
      metadata: {
        authType: auth.authType,
        targetId,
        scanMode,
        wait,
      },
    });

    // If async polling requested, return immediately
    if (!wait) {
      return NextResponse.json({
        success: true,
        scanId: scanJob.id,
        status: scanJob.status,
        pollUrl: `/api/v1/ci/scans/${scanJob.id}`,
      });
    }

    // 2. Synchronous execution for CI pipeline
    const { scanJob: completedJob, findings } = await runScanJob(scanJob.id);

    // 3. Resolve Quality Gate Policy
    const basePolicy = await getEffectiveQualityGatePolicy(auth.organizationId, targetId);
    const effectivePolicy: QualityGatePolicy = {
      ...basePolicy,
      ...customGatePolicy,
      organizationId: auth.organizationId,
      targetId,
    };

    // 4. Evaluate Quality Gate
    const gateResult = evaluateQualityGate(completedJob, findings, effectivePolicy);

    await recordAuditEvent({
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action: 'CI_GATE_EVALUATED',
      resourceType: 'scan_job',
      resourceId: completedJob.id,
      metadata: {
        passed: gateResult.passed,
        score: gateResult.score,
        minSecurityScore: gateResult.minSecurityScore,
        reasons: gateResult.reasons,
      },
    });

    // 5. Fire Gate Webhook
    try {
      await dispatchWebhookEvent({
        organizationId: auth.organizationId,
        eventType: gateResult.passed ? 'gate.passed' : 'gate.failed',
        data: {
          scanId: completedJob.id,
          targetId,
          score: completedJob.score,
          gatePassed: gateResult.passed,
          reasons: gateResult.reasons,
          summary: gateResult.summaryText,
        },
      });
    } catch {}

    const response = NextResponse.json({
      success: true,
      scanId: completedJob.id,
      status: completedJob.status,
      score: completedJob.score,
      gate: gateResult,
      sarifUrl: `/api/v1/ci/scans/${completedJob.id}/sarif`,
      summaryUrl: `/api/v1/ci/scans/${completedJob.id}/summary`,
    });

    // Provide pipeline headers for CLI/Action inspection
    response.headers.set('X-Zerivex-Gate', gateResult.passed ? 'PASSED' : 'FAILED');
    response.headers.set('X-Zerivex-Score', String(completedJob.score ?? 0));

    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
