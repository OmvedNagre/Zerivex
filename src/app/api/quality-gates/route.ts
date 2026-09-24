import { NextRequest, NextResponse } from 'next/server';
import { requireApiOrSessionAuth, handleAuthError } from '@/core/rbac/authorization-guard';
import {
  getEffectiveQualityGatePolicy,
  upsertQualityGatePolicy,
} from '@/core/cicd/quality-gate-repository';
import { QualityGatePolicy } from '@/core/cicd/quality-gate-engine';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'scans:read');
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('targetId');

    const policy = await getEffectiveQualityGatePolicy(
      auth.organizationId,
      targetId
    );

    return NextResponse.json({
      success: true,
      data: { policy },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'qualitygate:manage');
    const body = await req.json();

    const {
      targetId,
      name = 'Security Quality Gate',
      minSecurityScore = 80,
      failOnCritical = true,
      maxHighFindings = 0,
      maxMediumFindings = 5,
      failOnNewFindings = false,
      isDefault = false,
    } = body as Partial<QualityGatePolicy>;

    const updated = await upsertQualityGatePolicy({
      organizationId: auth.organizationId,
      targetId: targetId ?? null,
      name,
      minSecurityScore,
      failOnCritical,
      maxHighFindings,
      maxMediumFindings,
      failOnNewFindings,
      isDefault,
    });

    return NextResponse.json({
      success: true,
      data: { policy: updated },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
