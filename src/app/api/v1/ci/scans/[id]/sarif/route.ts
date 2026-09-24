import { NextRequest, NextResponse } from 'next/server';
import { requireApiOrSessionAuth, handleAuthError } from '@/core/rbac/authorization-guard';
import { getScanJobById } from '@/core/scanner/scan-runner';
import { generateSarifReport } from '@/core/reporting/sarif-generator';
import { getTargetById } from '@/core/targets/target-service';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'scans:read');
    const { id } = await context.params;

    const { scanJob, findings } = await getScanJobById(id, auth.organizationId);
    const target = await getTargetById(scanJob.targetId, auth.organizationId);

    const sarif = generateSarifReport({
      scanJob: {
        ...scanJob,
        targetUrl: target.targetUrl,
        targetHostname: target.hostname,
      },
      findings,
    });

    return new NextResponse(JSON.stringify(sarif, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/sarif+json; charset=utf-8',
        'Content-Disposition': `attachment; filename="zerivex-${id}.sarif"`,
        'X-Zerivex-Scan-Id': id,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
