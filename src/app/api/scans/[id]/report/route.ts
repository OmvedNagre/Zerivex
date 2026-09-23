import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import {
  generateTechnicalJsonReport,
  generateExecutiveHtmlReport,
} from '@/core/reporting/report-generator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'scans:read');

    const { id: scanJobId } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const format = req.nextUrl.searchParams.get('format') || 'html';

    if (format === 'json') {
      const jsonReport = await generateTechnicalJsonReport(scanJobId, orgCtx.organizationId);
      return new NextResponse(JSON.stringify(jsonReport, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="zerivex-audit-${scanJobId.substring(0, 8)}.json"`,
        },
      });
    }

    const htmlReport = await generateExecutiveHtmlReport(scanJobId, orgCtx.organizationId);
    return new NextResponse(htmlReport, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
