import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import {
  getAgencyBranding,
  upsertAgencyBranding,
  enableAgencyMode,
} from '@/core/agency/agency-service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'agency:read');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const branding = await getAgencyBranding(orgCtx.organizationId);

    return NextResponse.json({
      success: true,
      data: {
        branding,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'agency:branding_manage');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const body = await req.json();

    const { companyName, logoUrl, primaryColor, reportFooterText, supportEmail } = body;

    if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
      return NextResponse.json(
        { error: 'A valid companyName string is required' },
        { status: 400 }
      );
    }

    // Auto-flag org as agency
    await enableAgencyMode(orgCtx.organizationId, auth.user.id);

    const branding = await upsertAgencyBranding(
      orgCtx.organizationId,
      {
        companyName: companyName.trim(),
        logoUrl: logoUrl?.trim() || null,
        primaryColor: primaryColor?.trim() || '#3b82f6',
        reportFooterText: reportFooterText?.trim() || null,
        supportEmail: supportEmail?.trim() || null,
      },
      auth.user.id
    );

    return NextResponse.json({
      success: true,
      data: {
        branding,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
