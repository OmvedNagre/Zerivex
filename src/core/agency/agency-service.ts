import crypto from 'crypto';
import { query, withTransaction } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';
import {
  AgencyBrandingRecord,
  AgencyBrandingInput,
  AgencyClientRecord,
  CreateAgencyClientInput,
  AgencyPortfolioSummary,
  AgencyClientGrantRecord,
  ClientGrantRole,
} from './types';

/**
 * Check if an organization has agency mode enabled.
 */
export async function isAgencyOrganization(organizationId: string): Promise<boolean> {
  const res = await query<{ is_agency: boolean }>(
    'SELECT is_agency FROM organizations WHERE id = $1',
    [organizationId]
  );
  return res.rows[0]?.is_agency ?? false;
}

/**
 * Enable agency mode for an organization.
 */
export async function enableAgencyMode(agencyOrgId: string, actorUserId: string): Promise<void> {
  await query('UPDATE organizations SET is_agency = true, updated_at = NOW() WHERE id = $1', [
    agencyOrgId,
  ]);

  await recordAuditEvent({
    organizationId: agencyOrgId,
    actorUserId,
    action: 'AGENCY_MODE_ENABLED',
    resourceType: 'ORGANIZATION',
    resourceId: agencyOrgId,
    metadata: { isAgency: true },
  });
}

/**
 * Create a managed client organization under an agency.
 */
export async function createManagedClient(
  input: CreateAgencyClientInput
): Promise<AgencyClientRecord> {
  const clientSlug =
    input.clientSlug ||
    `client-${input.clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${crypto.randomBytes(3).toString('hex')}`;

  return withTransaction(async (client) => {
    // 1. Ensure parent org is flagged as agency
    await client.query('UPDATE organizations SET is_agency = true WHERE id = $1', [
      input.agencyOrganizationId,
    ]);

    // 2. Create child organization
    const orgRes = await client.query<{ id: string; name: string }>(
      `
      INSERT INTO organizations (name, slug, created_by_user_id, is_agency)
      VALUES ($1, $2, $3, false)
      RETURNING id, name
      `,
      [input.clientName, clientSlug, input.actorUserId]
    );
    const clientOrg = orgRes.rows[0]!;

    // 3. Create default project for client
    await client.query(
      `
      INSERT INTO projects (organization_id, name, description)
      VALUES ($1, 'Production Perimeter', 'Default security assessment project for client')
      `,
      [clientOrg.id]
    );

    // 4. Add actor as ORG_OWNER of child organization
    await client.query(
      `
      INSERT INTO memberships (organization_id, user_id, role)
      VALUES ($1, $2, 'ORG_OWNER')
      ON CONFLICT (organization_id, user_id) DO NOTHING
      `,
      [clientOrg.id, input.actorUserId]
    );

    // 5. Establish agency-client relationship
    const relRes = await client.query<{
      id: string;
      agency_organization_id: string;
      client_organization_id: string;
      client_name: string;
      account_manager_user_id: string | null;
      status: string;
      notes: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
      INSERT INTO agency_client_relationships (
        agency_organization_id, client_organization_id, client_name,
        account_manager_user_id, notes
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        input.agencyOrganizationId,
        clientOrg.id,
        input.clientName,
        input.accountManagerUserId || null,
        input.notes || null,
      ]
    );
    const rel = relRes.rows[0]!;

    // 6. Record audit log
    await recordAuditEvent({
      organizationId: input.agencyOrganizationId,
      actorUserId: input.actorUserId,
      action: 'AGENCY_CLIENT_CREATED',
      resourceType: 'AGENCY_CLIENT_RELATIONSHIP',
      resourceId: rel.id,
      metadata: {
        clientOrganizationId: clientOrg.id,
        clientName: input.clientName,
        accountManagerUserId: input.accountManagerUserId,
      },
    });

    return {
      id: rel.id,
      agencyOrganizationId: rel.agency_organization_id,
      clientOrganizationId: rel.client_organization_id,
      clientName: rel.client_name,
      accountManagerUserId: rel.account_manager_user_id,
      status: rel.status as AgencyClientRecord['status'],
      notes: rel.notes,
      createdAt: new Date(rel.created_at),
      updatedAt: new Date(rel.updated_at),
      targetCount: 0,
      scanCount: 0,
      latestSecurityScore: null,
      criticalFindingsCount: 0,
      highFindingsCount: 0,
    };
  });
}

/**
 * List all managed clients for an agency organization with live risk and target metrics.
 */
export async function listAgencyClients(agencyOrgId: string): Promise<AgencyClientRecord[]> {
  const res = await query<{
    id: string;
    agency_organization_id: string;
    client_organization_id: string;
    client_name: string;
    account_manager_user_id: string | null;
    account_manager_name: string | null;
    status: string;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
    target_count: string;
    scan_count: string;
    latest_score: number | null;
    critical_count: string;
    high_count: string;
  }>(
    `
    SELECT
      r.id,
      r.agency_organization_id,
      r.client_organization_id,
      r.client_name,
      r.account_manager_user_id,
      u.display_name as account_manager_name,
      r.status,
      r.notes,
      r.created_at,
      r.updated_at,
      (SELECT COUNT(*)::text FROM targets t WHERE t.organization_id = r.client_organization_id) as target_count,
      (SELECT COUNT(*)::text FROM scan_jobs s WHERE s.organization_id = r.client_organization_id) as scan_count,
      (
        SELECT s.score FROM scan_jobs s
        WHERE s.organization_id = r.client_organization_id AND s.status = 'COMPLETED' AND s.score IS NOT NULL
        ORDER BY s.completed_at DESC LIMIT 1
      ) as latest_score,
      (
        SELECT COUNT(*)::text FROM findings f
        WHERE f.organization_id = r.client_organization_id AND f.severity = 'CRITICAL' AND f.status IN ('OPEN', 'CONFIRMED', 'REOPENED')
      ) as critical_count,
      (
        SELECT COUNT(*)::text FROM findings f
        WHERE f.organization_id = r.client_organization_id AND f.severity = 'HIGH' AND f.status IN ('OPEN', 'CONFIRMED', 'REOPENED')
      ) as high_count
    FROM agency_client_relationships r
    LEFT JOIN users u ON u.id = r.account_manager_user_id
    WHERE r.agency_organization_id = $1
    ORDER BY r.created_at DESC
    `,
    [agencyOrgId]
  );

  return res.rows.map((row) => ({
    id: row.id,
    agencyOrganizationId: row.agency_organization_id,
    clientOrganizationId: row.client_organization_id,
    clientName: row.client_name,
    accountManagerUserId: row.account_manager_user_id,
    accountManagerName: row.account_manager_name,
    status: row.status as AgencyClientRecord['status'],
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    targetCount: parseInt(row.target_count || '0', 10),
    scanCount: parseInt(row.scan_count || '0', 10),
    latestSecurityScore: row.latest_score !== null ? Number(row.latest_score) : null,
    criticalFindingsCount: parseInt(row.critical_count || '0', 10),
    highFindingsCount: parseInt(row.high_count || '0', 10),
  }));
}

/**
 * Fetch the aggregated agency portfolio overview.
 */
export async function getAgencyPortfolioOverview(
  agencyOrgId: string
): Promise<AgencyPortfolioSummary> {
  const orgRes = await query<{ name: string; is_agency: boolean }>(
    'SELECT name, is_agency FROM organizations WHERE id = $1',
    [agencyOrgId]
  );

  const agencyName = orgRes.rows[0]?.name || 'Agency Workspace';
  const isAgency = orgRes.rows[0]?.is_agency ?? false;

  const clients = await listAgencyClients(agencyOrgId);
  const branding = await getAgencyBranding(agencyOrgId);

  const totalClients = clients.length;
  const totalTargets = clients.reduce((acc, c) => acc + c.targetCount, 0);
  const totalScans = clients.reduce((acc, c) => acc + c.scanCount, 0);
  const totalCriticalFindings = clients.reduce((acc, c) => acc + c.criticalFindingsCount, 0);
  const totalHighFindings = clients.reduce((acc, c) => acc + c.highFindingsCount, 0);

  const scoredClients = clients.filter((c) => c.latestSecurityScore !== null);
  const meanSecurityScore =
    scoredClients.length > 0
      ? Math.round(
          scoredClients.reduce((acc, c) => acc + (c.latestSecurityScore || 0), 0) /
            scoredClients.length
        )
      : 100;

  return {
    agencyOrganizationId: agencyOrgId,
    agencyName,
    isAgency,
    totalClients,
    totalTargets,
    totalScans,
    meanSecurityScore,
    totalCriticalFindings,
    totalHighFindings,
    clients,
    branding,
  };
}

/**
 * Upsert white-label branding configuration for an agency.
 */
export async function upsertAgencyBranding(
  agencyOrgId: string,
  branding: AgencyBrandingInput,
  actorUserId: string
): Promise<AgencyBrandingRecord> {
  const res = await query<{
    id: string;
    organization_id: string;
    company_name: string;
    logo_url: string | null;
    primary_color: string;
    report_footer_text: string | null;
    support_email: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    INSERT INTO agency_branding (
      organization_id, company_name, logo_url, primary_color, report_footer_text, support_email, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (organization_id)
    DO UPDATE SET
      company_name = EXCLUDED.company_name,
      logo_url = EXCLUDED.logo_url,
      primary_color = EXCLUDED.primary_color,
      report_footer_text = EXCLUDED.report_footer_text,
      support_email = EXCLUDED.support_email,
      updated_at = NOW()
    RETURNING *
    `,
    [
      agencyOrgId,
      branding.companyName,
      branding.logoUrl || null,
      branding.primaryColor || '#3b82f6',
      branding.reportFooterText || null,
      branding.supportEmail || null,
    ]
  );

  const row = res.rows[0]!;

  await recordAuditEvent({
    organizationId: agencyOrgId,
    actorUserId,
    action: 'AGENCY_BRANDING_UPDATED',
    resourceType: 'AGENCY_BRANDING',
    resourceId: row.id,
    metadata: {
      companyName: branding.companyName,
      logoUrl: branding.logoUrl,
      primaryColor: branding.primaryColor,
    },
  });

  return {
    id: row.id,
    organizationId: row.organization_id,
    companyName: row.company_name,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    reportFooterText: row.report_footer_text,
    supportEmail: row.support_email,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Get active branding for an organization.
 * If the organization is a managed client of an agency, inherits parent agency branding!
 */
export async function getAgencyBranding(orgId: string): Promise<AgencyBrandingRecord | null> {
  // 1. Direct check
  const directRes = await query<{
    id: string;
    organization_id: string;
    company_name: string;
    logo_url: string | null;
    primary_color: string;
    report_footer_text: string | null;
    support_email: string | null;
    created_at: Date;
    updated_at: Date;
  }>('SELECT * FROM agency_branding WHERE organization_id = $1 LIMIT 1', [orgId]);

  if (directRes.rows.length > 0) {
    const row = directRes.rows[0]!;
    return {
      id: row.id,
      organizationId: row.organization_id,
      companyName: row.company_name,
      logoUrl: row.logo_url,
      primaryColor: row.primary_color,
      reportFooterText: row.report_footer_text,
      supportEmail: row.support_email,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // 2. Check if managed client of an agency
  const parentRes = await query<{
    id: string;
    organization_id: string;
    company_name: string;
    logo_url: string | null;
    primary_color: string;
    report_footer_text: string | null;
    support_email: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    SELECT b.*
    FROM agency_client_relationships r
    JOIN agency_branding b ON b.organization_id = r.agency_organization_id
    WHERE r.client_organization_id = $1
    LIMIT 1
    `,
    [orgId]
  );

  if (parentRes.rows.length > 0) {
    const row = parentRes.rows[0]!;
    return {
      id: row.id,
      organizationId: row.organization_id,
      companyName: row.company_name,
      logoUrl: row.logo_url,
      primaryColor: row.primary_color,
      reportFooterText: row.report_footer_text,
      supportEmail: row.support_email,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  return null;
}

/**
 * Grant restricted client access to an external stakeholder.
 */
export async function grantClientAccess(params: {
  relationshipId: string;
  userEmail: string;
  role: ClientGrantRole;
  actorUserId: string;
}): Promise<AgencyClientGrantRecord> {
  return withTransaction(async (client) => {
    // 1. Find relationship
    const relRes = await client.query<{
      agency_organization_id: string;
      client_organization_id: string;
      client_name: string;
    }>('SELECT * FROM agency_client_relationships WHERE id = $1', [params.relationshipId]);

    const rel = relRes.rows[0];
    if (!rel) {
      throw new Error('Agency client relationship not found');
    }

    // 2. Find or create user by email
    let userRes = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
      params.userEmail,
    ]);

    let targetUserId: string;
    if (userRes.rows.length > 0) {
      targetUserId = userRes.rows[0]!.id;
    } else {
      const newUser = await client.query<{ id: string }>(
        "INSERT INTO users (email, display_name, role) VALUES ($1, $2, 'USER') RETURNING id",
        [params.userEmail, params.userEmail.split('@')[0] || 'Client User']
      );
      targetUserId = newUser.rows[0]!.id;
    }

    // 3. Insert or update grant
    const grantRes = await client.query<{
      id: string;
      relationship_id: string;
      user_id: string;
      role: string;
      created_at: Date;
    }>(
      `
      INSERT INTO agency_client_grants (relationship_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (relationship_id, user_id)
      DO UPDATE SET role = EXCLUDED.role
      RETURNING *
      `,
      [params.relationshipId, targetUserId, params.role]
    );

    // 4. Also grant membership to client organization as ORG_VIEWER
    await client.query(
      `
      INSERT INTO memberships (organization_id, user_id, role)
      VALUES ($1, $2, 'ORG_VIEWER')
      ON CONFLICT (organization_id, user_id) DO NOTHING
      `,
      [rel.client_organization_id, targetUserId]
    );

    const grant = grantRes.rows[0]!;

    await recordAuditEvent({
      organizationId: rel.agency_organization_id,
      actorUserId: params.actorUserId,
      action: 'AGENCY_CLIENT_ACCESS_GRANTED',
      resourceType: 'AGENCY_CLIENT_GRANT',
      resourceId: grant.id,
      metadata: {
        relationshipId: params.relationshipId,
        userEmail: params.userEmail,
        role: params.role,
        clientOrganizationId: rel.client_organization_id,
      },
    });

    return {
      id: grant.id,
      relationshipId: grant.relationship_id,
      userId: grant.user_id,
      userEmail: params.userEmail,
      role: grant.role as ClientGrantRole,
      createdAt: new Date(grant.created_at),
    };
  });
}

/**
 * Revoke client access for an external stakeholder.
 */
export async function revokeClientAccess(params: {
  relationshipId: string;
  userId: string;
  actorUserId: string;
}): Promise<void> {
  const relRes = await query<{
    agency_organization_id: string;
    client_organization_id: string;
  }>('SELECT * FROM agency_client_relationships WHERE id = $1', [params.relationshipId]);

  const rel = relRes.rows[0];
  if (!rel) {
    throw new Error('Agency client relationship not found');
  }

  await withTransaction(async (client) => {
    await client.query(
      'DELETE FROM agency_client_grants WHERE relationship_id = $1 AND user_id = $2',
      [params.relationshipId, params.userId]
    );

    await client.query(
      'DELETE FROM memberships WHERE organization_id = $1 AND user_id = $2 AND role = $3',
      [rel.client_organization_id, params.userId, 'ORG_VIEWER']
    );

    await recordAuditEvent({
      organizationId: rel.agency_organization_id,
      actorUserId: params.actorUserId,
      action: 'AGENCY_CLIENT_ACCESS_REVOKED',
      resourceType: 'AGENCY_CLIENT_GRANT',
      resourceId: `${params.relationshipId}:${params.userId}`,
      metadata: {
        relationshipId: params.relationshipId,
        revokedUserId: params.userId,
      },
    });
  });
}
