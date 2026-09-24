import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import {
  registerTarget,
  listTargetsForOrg,
  VerificationMethod,
  VerificationScope,
} from '@/core/targets/target-service';
import { checkTargetQuota } from '@/core/billing/entitlement-service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'targets:read');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const targets = await listTargetsForOrg(orgCtx.organizationId);

    return NextResponse.json({
      success: true,
      data: {
        targets,
        organization: {
          id: orgCtx.organizationId,
          name: orgCtx.organizationName,
        },
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'targets:create');

    const body = await req.json();
    const { targetUrl, verificationMethod, verificationScope, projectId } = body;

    if (!targetUrl || typeof targetUrl !== 'string') {
      return NextResponse.json(
        { error: 'A valid targetUrl string is required (e.g. "https://app.example.com")' },
        { status: 400 }
      );
    }

    const orgCtx = await getUserActiveOrganization(auth.user.id);

    // Enforce billing target quota
    const quota = await checkTargetQuota(orgCtx.organizationId, auth.user.role);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: quota.reason,
          quota: {
            current: quota.current,
            max: quota.max,
            planId: quota.planId,
          },
        },
        { status: 403 }
      );
    }

    const target = await registerTarget({
      organizationId: orgCtx.organizationId,
      projectId: projectId || orgCtx.defaultProjectId,
      targetUrl,
      verificationMethod: verificationMethod as VerificationMethod,
      verificationScope: verificationScope as VerificationScope,
      actorUserId: auth.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: { target },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('[ZERIVEX SSRF DEFENSE]') || message.includes('already registered')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
