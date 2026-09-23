import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { getTargetById } from '@/core/targets/target-service';
import {
  getAttackSurfaceSummary,
  getDiscoveredEndpointsForTarget,
  getTechnologyFingerprintsForTarget,
  upsertDiscoveredEndpoints,
  upsertTechnologyFingerprints,
} from '@/core/surface/surface-repository';
import { crawlAttackSurface } from '@/core/surface/crawler';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'targets:read');

    const { id } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);

    // Verify target ownership under tenant
    const target = await getTargetById(id, orgCtx.organizationId);

    const [summary, endpoints, technologies] = await Promise.all([
      getAttackSurfaceSummary(orgCtx.organizationId, target.id),
      getDiscoveredEndpointsForTarget(orgCtx.organizationId, target.id),
      getTechnologyFingerprintsForTarget(orgCtx.organizationId, target.id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        target,
        summary,
        endpoints,
        technologies,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'targets:update');

    const { id } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);

    // Verify target ownership under tenant
    const target = await getTargetById(id, orgCtx.organizationId);

    // Execute on-demand crawl
    const result = await crawlAttackSurface(target.targetUrl, {
      maxDepth: 2,
      maxPages: 25,
    });

    if (result.endpoints.length > 0) {
      await upsertDiscoveredEndpoints(orgCtx.organizationId, target.id, null, result.endpoints);
    }

    if (result.technologies.length > 0) {
      await upsertTechnologyFingerprints(orgCtx.organizationId, target.id, null, result.technologies);
    }

    const summary = await getAttackSurfaceSummary(orgCtx.organizationId, target.id);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        crawlDurationMs: result.crawlDurationMs,
        totalPagesScanned: result.totalPagesScanned,
        discoveredEndpointsCount: result.endpoints.length,
        technologiesCount: result.technologies.length,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
