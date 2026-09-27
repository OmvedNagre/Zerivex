import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { query } from '@/core/db/database';
import {
  registerTarget,
  listTargetsForOrg,
  VerificationMethod,
  VerificationScope,
  Target,
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
  let auth;
  let targetUrlInput = '';
  try {
    auth = await requireAuth(req);
    requirePermission(auth, 'targets:create');

    const body = await req.json();
    let rawUrl = (body.targetUrl || body.url || '').toString().trim();

    if (!rawUrl) {
      return NextResponse.json(
        { error: 'A valid targetUrl string is required (e.g. "https://app.example.com")' },
        { status: 400 }
      );
    }

    // Auto-prefix https:// if protocol was omitted
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = `https://${rawUrl}`;
    }
    targetUrlInput = rawUrl;

    const { verificationMethod, verificationScope, projectId } = body;
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
      targetUrl: targetUrlInput,
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
    // If target is already registered, return existing target gracefully
    if (message.includes('already registered') && auth) {
      try {
        const orgCtx = await getUserActiveOrganization(auth.user.id);
        const existingRes = await query<Target>(
          `
          SELECT
            id,
            project_id as "projectId",
            organization_id as "organizationId",
            target_url as "targetUrl",
            hostname,
            verification_status as "verificationStatus",
            verification_token as "verificationToken",
            verification_method as "verificationMethod",
            verification_scope as "verificationScope",
            verified_at as "verifiedAt",
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM targets
          WHERE organization_id = $1 AND (target_url = $2 OR target_url = $3 OR hostname = $4)
          LIMIT 1
          `,
          [
            orgCtx.organizationId,
            targetUrlInput,
            `${targetUrlInput}/`,
            targetUrlInput.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase(),
          ]
        );

        if (existingRes.rows[0]) {
          return NextResponse.json(
            {
              success: true,
              data: { target: existingRes.rows[0], alreadyExists: true },
            },
            { status: 200 }
          );
        }
      } catch {
        // Fall back to standard error response below
      }
    }

    if (message.includes('[ZERIVEX SSRF DEFENSE]') || message.includes('already registered')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
