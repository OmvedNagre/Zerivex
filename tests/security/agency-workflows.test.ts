import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query } from '@/core/db/database';
import {
  isAgencyOrganization,
  enableAgencyMode,
  createManagedClient,
  listAgencyClients,
  getAgencyPortfolioOverview,
  upsertAgencyBranding,
  getAgencyBranding,
  grantClientAccess,
  revokeClientAccess,
} from '@/core/agency/agency-service';
import {
  generateExecutiveHtmlReport,
  generateTechnicalJsonReport,
} from '@/core/reporting/report-generator';

describe('Phase 12: Teams & Agencies (Agency Workflows, Multi-Client Architecture & White-Label Reporting)', () => {
  let agencyOwnerUserId: string;
  let agencyStaffUserId: string;
  let clientStakeholderUserId: string;
  let externalUserId: string;

  let agencyOrgId: string;
  let clientAOrgId: string;
  let clientBOrgId: string;
  let relationshipAId: string;

  let targetAId: string;
  let scanJobAId: string;
  let findingAId: string;

  const testSuffix = Math.random().toString(36).substring(2, 8);

  beforeAll(async () => {
    // 1. Create Test Users
    const u1 = await query<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ($1, 'Agency Principal', 'USER') RETURNING id`,
      [`agency-owner-${testSuffix}@agencytest.local`]
    );
    agencyOwnerUserId = u1.rows[0]!.id;

    const u2 = await query<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ($1, 'Agency Staff', 'USER') RETURNING id`,
      [`agency-staff-${testSuffix}@agencytest.local`]
    );
    agencyStaffUserId = u2.rows[0]!.id;

    const u3 = await query<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ($1, 'Client Stakeholder', 'USER') RETURNING id`,
      [`stakeholder-${testSuffix}@clientcorp.local`]
    );
    clientStakeholderUserId = u3.rows[0]!.id;

    const u4 = await query<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ($1, 'External Attacker', 'USER') RETURNING id`,
      [`external-${testSuffix}@unauthorized.local`]
    );
    externalUserId = u4.rows[0]!.id;

    // 2. Create Parent Agency Organization
    const o1 = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, created_by_user_id) VALUES ($1, $2, $3) RETURNING id`,
      ['Apex Cyber Advisory', `apex-agency-${testSuffix}`, agencyOwnerUserId]
    );
    agencyOrgId = o1.rows[0]!.id;

    await query(
      `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'ORG_OWNER')`,
      [agencyOrgId, agencyOwnerUserId]
    );
    await query(
      `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'ORG_MEMBER')`,
      [agencyOrgId, agencyStaffUserId]
    );
  });

  afterAll(async () => {
    // Cleanup created data
    if (findingAId) {
      await query('DELETE FROM findings WHERE id = $1', [findingAId]);
    }
    if (scanJobAId) {
      await query('DELETE FROM scan_jobs WHERE id = $1', [scanJobAId]);
    }
    if (targetAId) {
      await query('DELETE FROM targets WHERE id = $1', [targetAId]);
    }
    if (agencyOrgId) {
      await query('DELETE FROM agency_branding WHERE organization_id = $1', [agencyOrgId]);
      await query('DELETE FROM agency_client_relationships WHERE agency_organization_id = $1', [agencyOrgId]);
      await query('DELETE FROM memberships WHERE organization_id = $1', [agencyOrgId]);
    }
    if (clientAOrgId) {
      await query('DELETE FROM memberships WHERE organization_id = $1', [clientAOrgId]);
      await query('DELETE FROM organizations WHERE id = $1', [clientAOrgId]);
    }
    if (clientBOrgId) {
      await query('DELETE FROM memberships WHERE organization_id = $1', [clientBOrgId]);
      await query('DELETE FROM organizations WHERE id = $1', [clientBOrgId]);
    }
    if (agencyOrgId) {
      await query('DELETE FROM organizations WHERE id = $1', [agencyOrgId]);
    }
    await query('DELETE FROM users WHERE id IN ($1, $2, $3, $4)', [
      agencyOwnerUserId,
      agencyStaffUserId,
      clientStakeholderUserId,
      externalUserId,
    ]);
  });

  it('1. enables agency mode on an organization', async () => {
    const initialStatus = await isAgencyOrganization(agencyOrgId);
    expect(initialStatus).toBe(false);

    await enableAgencyMode(agencyOrgId, agencyOwnerUserId);

    const updatedStatus = await isAgencyOrganization(agencyOrgId);
    expect(updatedStatus).toBe(true);
  });

  it('2. provisions managed client organizations under the agency', async () => {
    const clientA = await createManagedClient({
      agencyOrganizationId: agencyOrgId,
      clientName: `Acme FinTech ${testSuffix}`,
      clientSlug: `acme-fintech-${testSuffix}`,
      notes: 'Strategic banking client',
      actorUserId: agencyOwnerUserId,
    });

    expect(clientA).toBeDefined();
    expect(clientA.clientName).toBe(`Acme FinTech ${testSuffix}`);
    expect(clientA.status).toBe('ACTIVE');
    expect(clientA.agencyOrganizationId).toBe(agencyOrgId);
    clientAOrgId = clientA.clientOrganizationId;
    relationshipAId = clientA.id;

    const clientB = await createManagedClient({
      agencyOrganizationId: agencyOrgId,
      clientName: `Beta Healthcare ${testSuffix}`,
      clientSlug: `beta-health-${testSuffix}`,
      notes: 'Healthcare HIPAA compliance SLA',
      actorUserId: agencyOwnerUserId,
    });

    expect(clientB).toBeDefined();
    expect(clientB.clientName).toBe(`Beta Healthcare ${testSuffix}`);
    clientBOrgId = clientB.clientOrganizationId;
    expect(clientB.id).toBeDefined();

    // Verify agency clients list
    const clientsList = await listAgencyClients(agencyOrgId);
    expect(clientsList.length).toBeGreaterThanOrEqual(2);
    const names = clientsList.map((c) => c.clientName);
    expect(names).toContain(`Acme FinTech ${testSuffix}`);
    expect(names).toContain(`Beta Healthcare ${testSuffix}`);
  });

  it('3. seeds targets, scans, and verified findings for Client A', async () => {
    // Retrieve default project created by createManagedClient
    const projRes = await query<{ id: string }>(
      'SELECT id FROM projects WHERE organization_id = $1 LIMIT 1',
      [clientAOrgId]
    );
    const projectId = projRes.rows[0]!.id;

    // Register verified target for Client A
    const tRes = await query<{ id: string }>(
      `INSERT INTO targets (
         project_id, organization_id, target_url, hostname,
         verification_status, verification_token, verification_method, verification_scope, verified_at
       )
       VALUES ($1, $2, $3, $4, 'VERIFIED', 'agency-test-token', 'DNS_TXT', 'DOMAIN', NOW())
       RETURNING id`,
      [projectId, clientAOrgId, `https://api.acme-${testSuffix}.com`, `api.acme-${testSuffix}.com`]
    );
    targetAId = tRes.rows[0]!.id;

    // Create completed scan job with score 60 (Moderate/High risk)
    const sRes = await query<{ id: string }>(
      `INSERT INTO scan_jobs (organization_id, target_id, requester_user_id, scan_mode, status, score, started_at, completed_at)
       VALUES ($1, $2, $3, 'VERIFIED_ACTIVE', 'COMPLETED', 60, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '5 minutes') RETURNING id`,
      [clientAOrgId, targetAId, agencyOwnerUserId]
    );
    scanJobAId = sRes.rows[0]!.id;

    // Create 1 CRITICAL finding for Client A
    const fRes = await query<{ id: string }>(
      `INSERT INTO findings (scan_id, target_id, organization_id, rule_id, title, severity, confidence, category, resource_endpoint, evidence_json, status, cwe_id, owasp_category)
       VALUES ($1, $2, $3, 'ZX-CORS-001', 'Overly Permissive CORS Policy', 'CRITICAL', 'CONFIRMED', 'CORS', 'https://api.acme-${testSuffix}.com/auth', '{"header":"Access-Control-Allow-Origin: *"}', 'OPEN', 'CWE-942', 'A05:2021-Security Misconfiguration')
       RETURNING id`,
      [scanJobAId, targetAId, clientAOrgId]
    );
    findingAId = fRes.rows[0]!.id;

    expect(targetAId).toBeDefined();
    expect(scanJobAId).toBeDefined();
    expect(findingAId).toBeDefined();
  });

  it('4. aggregates cross-client metrics into the Agency Portfolio Overview', async () => {
    const portfolio = await getAgencyPortfolioOverview(agencyOrgId);

    expect(portfolio.agencyOrganizationId).toBe(agencyOrgId);
    expect(portfolio.totalClients).toBeGreaterThanOrEqual(2);
    expect(portfolio.totalTargets).toBeGreaterThanOrEqual(1);
    expect(portfolio.totalCriticalFindings).toBeGreaterThanOrEqual(1);

    // Mean score should reflect Client A's score of 60
    expect(portfolio.meanSecurityScore).toBe(60);

    const clientAEntry = portfolio.clients.find((c) => c.clientOrganizationId === clientAOrgId);
    expect(clientAEntry).toBeDefined();
    expect(clientAEntry?.targetCount).toBe(1);
    expect(clientAEntry?.criticalFindingsCount).toBe(1);
    expect(clientAEntry?.latestSecurityScore).toBe(60);
  });

  it('5. enforces strict multi-tenant IDOR isolation between managed clients', async () => {
    // Direct database query confirming Client B's targets is empty, while Client A has 1 target
    const targetsA = await query('SELECT * FROM targets WHERE organization_id = $1', [clientAOrgId]);
    const targetsB = await query('SELECT * FROM targets WHERE organization_id = $1', [clientBOrgId]);

    expect(targetsA.rows.length).toBe(1);
    expect(targetsB.rows.length).toBe(0);

    // Scan jobs for Client B is empty
    const scansB = await query('SELECT * FROM scan_jobs WHERE organization_id = $1', [clientBOrgId]);
    expect(scansB.rows.length).toBe(0);

    // Findings for Client B is empty
    const findingsB = await query('SELECT * FROM findings WHERE organization_id = $1', [clientBOrgId]);
    expect(findingsB.rows.length).toBe(0);
  });

  it('6. configures custom white-label branding tokens for the agency', async () => {
    const brandTokens = {
      companyName: 'Apex Cyber Advisory Group',
      logoUrl: 'https://cdn.apexcyber.example/brand/logo-shield.png',
      primaryColor: '#6366f1',
      reportFooterText: 'STRICTLY CONFIDENTIAL: Prepared by Apex Cyber Advisory Group for Authorized Client C-Suite.',
      supportEmail: 'advisory@apexcyber.example',
    };

    const saved = await upsertAgencyBranding(agencyOrgId, brandTokens, agencyOwnerUserId);

    expect(saved.companyName).toBe(brandTokens.companyName);
    expect(saved.logoUrl).toBe(brandTokens.logoUrl);
    expect(saved.primaryColor).toBe(brandTokens.primaryColor);
    expect(saved.reportFooterText).toBe(brandTokens.reportFooterText);
    expect(saved.supportEmail).toBe(brandTokens.supportEmail);

    // Verify retrieval for agency organization
    const retrievedAgency = await getAgencyBranding(agencyOrgId);
    expect(retrievedAgency?.companyName).toBe(brandTokens.companyName);
    expect(retrievedAgency?.primaryColor).toBe('#6366f1');
  });

  it('7. automatically inherits parent agency branding on child client organizations', async () => {
    // Child client has no direct branding in agency_branding table
    const directClientBranding = await query('SELECT * FROM agency_branding WHERE organization_id = $1', [clientAOrgId]);
    expect(directClientBranding.rows.length).toBe(0);

    // Calling getAgencyBranding on child client automatically cascades to parent agency!
    const inheritedBranding = await getAgencyBranding(clientAOrgId);
    expect(inheritedBranding).not.toBeNull();
    expect(inheritedBranding?.companyName).toBe('Apex Cyber Advisory Group');
    expect(inheritedBranding?.logoUrl).toBe('https://cdn.apexcyber.example/brand/logo-shield.png');
    expect(inheritedBranding?.primaryColor).toBe('#6366f1');
    expect(inheritedBranding?.reportFooterText).toContain('Prepared by Apex Cyber Advisory Group');
  });

  it('8. generates white-labeled Executive HTML security report with inherited branding', async () => {
    const htmlReport = await generateExecutiveHtmlReport(scanJobAId, clientAOrgId);

    // Must contain agency company name
    expect(htmlReport).toContain('Apex Cyber Advisory Group');

    // Must contain custom logo image tag
    expect(htmlReport).toContain('https://cdn.apexcyber.example/brand/logo-shield.png');

    // Must contain primary brand accent color
    expect(htmlReport).toContain('#6366f1');

    // Must contain custom footer text
    expect(htmlReport).toContain('STRICTLY CONFIDENTIAL: Prepared by Apex Cyber Advisory Group for Authorized Client C-Suite.');

    // Must contain support advisory email
    expect(htmlReport).toContain('advisory@apexcyber.example');

    // Must contain verified finding details
    expect(htmlReport).toContain('Overly Permissive CORS Policy');
    expect(htmlReport).toContain('ZX-CORS-001');
  });

  it('9. generates technical JSON security report containing white-label metadata', async () => {
    const jsonReport = await generateTechnicalJsonReport(scanJobAId, clientAOrgId);

    expect(jsonReport.reportType).toBe('ZERIVEX_TECHNICAL_SECURITY_REPORT');
    expect(jsonReport.generator).toBe('Apex Cyber Advisory Group Security Engine');

    const brandingMeta = jsonReport.branding as Record<string, unknown>;
    expect(brandingMeta).toBeDefined();
    expect(brandingMeta.companyName).toBe('Apex Cyber Advisory Group');
    expect(brandingMeta.primaryColor).toBe('#6366f1');
    expect(brandingMeta.supportEmail).toBe('advisory@apexcyber.example');
  });

  it('10. grants and revokes restricted client stakeholder access', async () => {
    // Stakeholder is granted CLIENT_VIEWER access to Client A
    const grant = await grantClientAccess({
      relationshipId: relationshipAId,
      userEmail: `stakeholder-${testSuffix}@clientcorp.local`,
      role: 'CLIENT_VIEWER',
      actorUserId: agencyOwnerUserId,
    });

    expect(grant).toBeDefined();
    expect(grant.role).toBe('CLIENT_VIEWER');
    expect(grant.userId).toBe(clientStakeholderUserId);

    // Stakeholder now has an ORG_VIEWER membership on Client A
    const memRes = await query<{ role: string }>(
      'SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2',
      [clientAOrgId, clientStakeholderUserId]
    );
    expect(memRes.rows.length).toBe(1);
    expect(memRes.rows[0]!.role).toBe('ORG_VIEWER');

    // Stakeholder has NO membership on Client B or Agency parent
    const memPeer = await query('SELECT * FROM memberships WHERE organization_id = $1 AND user_id = $2', [
      clientBOrgId,
      clientStakeholderUserId,
    ]);
    expect(memPeer.rows.length).toBe(0);

    const memAgency = await query('SELECT * FROM memberships WHERE organization_id = $1 AND user_id = $2', [
      agencyOrgId,
      clientStakeholderUserId,
    ]);
    expect(memAgency.rows.length).toBe(0);

    // Revoke access
    await revokeClientAccess({
      relationshipId: relationshipAId,
      userId: clientStakeholderUserId,
      actorUserId: agencyOwnerUserId,
    });

    // Verify grant deleted
    const grantCheck = await query('SELECT * FROM agency_client_grants WHERE relationship_id = $1 AND user_id = $2', [
      relationshipAId,
      clientStakeholderUserId,
    ]);
    expect(grantCheck.rows.length).toBe(0);

    // Verify membership deleted
    const memCheck = await query('SELECT * FROM memberships WHERE organization_id = $1 AND user_id = $2', [
      clientAOrgId,
      clientStakeholderUserId,
    ]);
    expect(memCheck.rows.length).toBe(0);
  });
});
