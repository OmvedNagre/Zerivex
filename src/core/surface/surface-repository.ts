import { query } from '@/core/db/database';
import { DiscoveredEndpoint, TechnologyFingerprint, HttpMethod, DiscoverySource, TechCategory, ConfidenceLevel } from './types';

export interface AttackSurfaceSummary {
  totalEndpoints: number;
  totalTechnologies: number;
  methodsBreakdown: Record<string, number>;
  sourcesBreakdown: Record<string, number>;
  technologiesByCategory: Record<string, TechnologyFingerprint[]>;
}

/**
 * Upsert discovered endpoints idempotently for a target.
 */
export async function upsertDiscoveredEndpoints(
  organizationId: string,
  targetId: string,
  scanId: string | null,
  endpoints: DiscoveredEndpoint[]
): Promise<void> {
  if (endpoints.length === 0) return;

  for (const ep of endpoints) {
    await query(
      `
      INSERT INTO discovered_endpoints (
        target_id,
        organization_id,
        scan_id,
        url,
        path,
        http_method,
        parameters,
        status_code,
        content_type,
        discovery_source,
        response_time_ms
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (target_id, path, http_method)
      DO UPDATE SET
        scan_id = EXCLUDED.scan_id,
        parameters = EXCLUDED.parameters,
        status_code = COALESCE(EXCLUDED.status_code, discovered_endpoints.status_code),
        content_type = COALESCE(EXCLUDED.content_type, discovered_endpoints.content_type),
        response_time_ms = COALESCE(EXCLUDED.response_time_ms, discovered_endpoints.response_time_ms),
        updated_at = NOW()
      `,
      [
        targetId,
        organizationId,
        scanId,
        ep.url,
        ep.path,
        ep.httpMethod,
        JSON.stringify(ep.parameters || []),
        ep.statusCode ?? null,
        ep.contentType ?? null,
        ep.discoverySource,
        ep.responseTimeMs ?? null,
      ]
    );
  }
}

/**
 * Upsert detected technologies idempotently for a target.
 */
export async function upsertTechnologyFingerprints(
  organizationId: string,
  targetId: string,
  scanId: string | null,
  technologies: TechnologyFingerprint[]
): Promise<void> {
  if (technologies.length === 0) return;

  for (const tech of technologies) {
    await query(
      `
      INSERT INTO technology_fingerprints (
        target_id,
        organization_id,
        scan_id,
        category,
        name,
        version,
        confidence,
        matched_indicators
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (target_id, name)
      DO UPDATE SET
        scan_id = EXCLUDED.scan_id,
        version = COALESCE(EXCLUDED.version, technology_fingerprints.version),
        confidence = EXCLUDED.confidence,
        matched_indicators = EXCLUDED.matched_indicators,
        updated_at = NOW()
      `,
      [
        targetId,
        organizationId,
        scanId,
        tech.category,
        tech.name,
        tech.version ?? null,
        tech.confidence,
        JSON.stringify(tech.matchedIndicators || []),
      ]
    );
  }
}

/**
 * Fetch all discovered endpoints for a target with strict tenant scoping.
 */
export async function getDiscoveredEndpointsForTarget(
  organizationId: string,
  targetId: string
): Promise<DiscoveredEndpoint[]> {
  const res = await query<{
    id: string;
    target_id: string;
    organization_id: string;
    scan_id: string | null;
    url: string;
    path: string;
    http_method: string;
    parameters: any;
    status_code: number | null;
    content_type: string | null;
    discovery_source: string;
    response_time_ms: number | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    SELECT
      id,
      target_id,
      organization_id,
      scan_id,
      url,
      path,
      http_method,
      parameters,
      status_code,
      content_type,
      discovery_source,
      response_time_ms,
      created_at,
      updated_at
    FROM discovered_endpoints
    WHERE organization_id = $1 AND target_id = $2
    ORDER BY path ASC, http_method ASC
    `,
    [organizationId, targetId]
  );

  return res.rows.map((row) => ({
    id: row.id,
    targetId: row.target_id,
    organizationId: row.organization_id,
    scanId: row.scan_id,
    url: row.url,
    path: row.path,
    httpMethod: row.http_method as HttpMethod,
    parameters: Array.isArray(row.parameters) ? row.parameters : [],
    statusCode: row.status_code,
    contentType: row.content_type,
    discoverySource: row.discovery_source as DiscoverySource,
    responseTimeMs: row.response_time_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Fetch all detected technologies for a target with strict tenant scoping.
 */
export async function getTechnologyFingerprintsForTarget(
  organizationId: string,
  targetId: string
): Promise<TechnologyFingerprint[]> {
  const res = await query<{
    id: string;
    target_id: string;
    organization_id: string;
    scan_id: string | null;
    category: string;
    name: string;
    version: string | null;
    confidence: string;
    matched_indicators: any;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    SELECT
      id,
      target_id,
      organization_id,
      scan_id,
      category,
      name,
      version,
      confidence,
      matched_indicators,
      created_at,
      updated_at
    FROM technology_fingerprints
    WHERE organization_id = $1 AND target_id = $2
    ORDER BY category ASC, name ASC
    `,
    [organizationId, targetId]
  );

  return res.rows.map((row) => ({
    id: row.id,
    targetId: row.target_id,
    organizationId: row.organization_id,
    scanId: row.scan_id,
    category: row.category as TechCategory,
    name: row.name,
    version: row.version,
    confidence: row.confidence as ConfidenceLevel,
    matchedIndicators: Array.isArray(row.matched_indicators) ? row.matched_indicators : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get an attack surface summary for dashboard display.
 */
export async function getAttackSurfaceSummary(
  organizationId: string,
  targetId: string
): Promise<AttackSurfaceSummary> {
  const [endpoints, technologies] = await Promise.all([
    getDiscoveredEndpointsForTarget(organizationId, targetId),
    getTechnologyFingerprintsForTarget(organizationId, targetId),
  ]);

  const methodsBreakdown: Record<string, number> = {};
  const sourcesBreakdown: Record<string, number> = {};

  for (const ep of endpoints) {
    methodsBreakdown[ep.httpMethod] = (methodsBreakdown[ep.httpMethod] || 0) + 1;
    sourcesBreakdown[ep.discoverySource] = (sourcesBreakdown[ep.discoverySource] || 0) + 1;
  }

  const technologiesByCategory: Record<string, TechnologyFingerprint[]> = {};
  for (const tech of technologies) {
    const list = technologiesByCategory[tech.category] || [];
    list.push(tech);
    technologiesByCategory[tech.category] = list;
  }

  return {
    totalEndpoints: endpoints.length,
    totalTechnologies: technologies.length,
    methodsBreakdown,
    sourcesBreakdown,
    technologiesByCategory,
  };
}
