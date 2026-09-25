import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { getAgencyPortfolioOverview } from '@/core/agency/agency-service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'agency:read');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const portfolio = await getAgencyPortfolioOverview(orgCtx.organizationId);

    return NextResponse.json({
      success: true,
      data: {
        portfolio,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
