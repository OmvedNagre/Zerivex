import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query } from '@/core/db/database';
import {
  getOrganizationMembers,
  inviteMember,
  getPendingInvitations,
  revokeInvitation,
  acceptInvitation,
  getInvitationByToken,
  updateMemberRole,
  removeMember,
  transferOrganizationOwnership,
  hashInvitationToken,
  INVITATION_TOKEN_PREFIX,
} from '@/core/teams/team-service';
import {
  queryAuditVault,
  exportAuditVault,
  verifyAuditVaultIntegrity,
} from '@/core/audit/audit-vault';
import {
  addFindingComment,
  getFindingComments,
  assignFinding,
} from '@/core/collaboration/comment-service';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { createTenantTarget } from '@/core/db/repositories/tenant-repository';

describe('Phase 10: Enterprise Teams, Audit Vault & Collaboration', () => {
  let userOwnerAId: string;
  let userEngineerAId: string;
  let userAuditorAId: string;
  let userOwnerBId: string;

  let orgAId: string;
  let orgBId: string;
  let projectAId: string;
  let targetAId: string;
  let scanJobAId: string;
  let findingAId: string;

  const testSuffix = Math.random().toString(36).substring(2, 8);

  beforeAll(async () => {
    // 1. Create Users
    const u1 = await query<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ($1, 'Owner A', 'USER') RETURNING id`,
      [`owner-a-${testSuffix}@zerivex.local`]
    );
    userOwnerAId = u1.rows[0]!.id;

    const u2 = await query<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ($1, 'Engineer A', 'USER') RETURNING id`,
      [`engineer-a-${testSuffix}@zerivex.local`]
    );
    userEngineerAId = u2.rows[0]!.id;

    const u3 = await query<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ($1, 'Auditor A', 'USER') RETURNING id`,
      [`auditor-a-${testSuffix}@zerivex.local`]
    );
    userAuditorAId = u3.rows[0]!.id;

    const u4 = await query<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ($1, 'Owner B', 'USER') RETURNING id`,
      [`owner-b-${testSuffix}@zerivex.local`]
    );
    userOwnerBId = u4.rows[0]!.id;

    // 2. Create Organizations
    const o1 = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, created_by_user_id) VALUES ($1, $2, $3) RETURNING id`,
      ['Acme Security Corp', `acme-sec-${testSuffix}`, userOwnerAId]
    );
    orgAId = o1.rows[0]!.id;

    const o2 = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, created_by_user_id) VALUES ($1, $2, $3) RETURNING id`,
      ['Competitor Corp', `comp-sec-${testSuffix}`, userOwnerBId]
    );
    orgBId = o2.rows[0]!.id;

    // 3. Setup Memberships
    await query(
      `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'ORG_OWNER')`,
      [orgAId, userOwnerAId]
    );
    await query(
      `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'ORG_MEMBER')`,
      [orgAId, userEngineerAId]
    );
    await query(
      `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'ORG_OWNER')`,
      [orgBId, userOwnerBId]
    );

    // 4. Create Project, Target, Scan Job, and Finding in Org A
    const p1 = await query<{ id: string }>(
      `INSERT INTO projects (organization_id, name) VALUES ($1, 'Primary Web App') RETURNING id`,
      [orgAId]
    );
    projectAId = p1.rows[0]!.id;

    const target = await createTenantTarget({
      organizationId: orgAId,
      projectId: projectAId,
      targetUrl: `https://app-${testSuffix}.acme.local`,
      actorUserId: userOwnerAId,
      verificationScope: 'EXACT_HOST',
    });
    targetAId = target.id;

    const s1 = await query<{ id: string }>(
      `INSERT INTO scan_jobs (organization_id, target_id, requester_user_id, scan_mode, status)
       VALUES ($1, $2, $3, 'PUBLIC_PASSIVE', 'COMPLETED') RETURNING id`,
      [orgAId, targetAId, userOwnerAId]
    );
    scanJobAId = s1.rows[0]!.id;

    const f1 = await query<{ id: string }>(
      `INSERT INTO findings (
         scan_id, target_id, organization_id, rule_id, title, severity, confidence, category, resource_endpoint
       ) VALUES ($1, $2, $3, 'SEC_HEADER_CSP', 'Missing Content Security Policy', 'MEDIUM', 'HIGH', 'HEADERS', '/dashboard')
       RETURNING id`,
      [scanJobAId, targetAId, orgAId]
    );
    findingAId = f1.rows[0]!.id;
  });

  afterAll(async () => {
    await query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgAId, orgBId]);
    await query('DELETE FROM users WHERE id IN ($1, $2, $3, $4)', [
      userOwnerAId,
      userEngineerAId,
      userAuditorAId,
      userOwnerBId,
    ]);
  });

  // ============================================================
  // 1. MULTI-TENANT ROSTER & SOLE OWNER PROTECTION
  // ============================================================
  describe('1. Organization Member Roster & Sole Owner Protection', () => {
    it('returns strictly tenant-isolated member lists', async () => {
      const membersA = await getOrganizationMembers(orgAId);
      const membersB = await getOrganizationMembers(orgBId);

      expect(membersA.length).toBe(2);
      expect(membersA.some((m) => m.userId === userOwnerAId)).toBe(true);
      expect(membersA.some((m) => m.userId === userEngineerAId)).toBe(true);
      expect(membersA.some((m) => m.userId === userOwnerBId)).toBe(false);

      expect(membersB.length).toBe(1);
      expect(membersB[0]!.userId).toBe(userOwnerBId);
    });

    it('blocks demoting the sole organization owner', async () => {
      // orgB has only 1 owner (userOwnerBId)
      await expect(
        updateMemberRole({
          organizationId: orgBId,
          targetUserId: userOwnerBId,
          newRole: 'ORG_ADMIN',
          actorUserId: userOwnerBId,
        })
      ).rejects.toThrow(/Cannot demote the sole organization owner/);
    });

    it('blocks removing the sole organization owner', async () => {
      await expect(
        removeMember({
          organizationId: orgBId,
          targetUserId: userOwnerBId,
          actorUserId: userOwnerBId,
        })
      ).rejects.toThrow(/Cannot remove the sole organization owner/);
    });

    it('allows demoting or removing an owner when multiple owners exist', async () => {
      // Promote userEngineerA to ORG_OWNER in orgA
      await updateMemberRole({
        organizationId: orgAId,
        targetUserId: userEngineerAId,
        newRole: 'ORG_OWNER',
        actorUserId: userOwnerAId,
      });

      // Now orgA has 2 owners: userOwnerA and userEngineerA
      // Demoting userEngineerA back to ORG_MEMBER should now succeed
      const demotedRole = await updateMemberRole({
        organizationId: orgAId,
        targetUserId: userEngineerAId,
        newRole: 'ORG_MEMBER',
        actorUserId: userOwnerAId,
      });

      expect(demotedRole).toBe('ORG_MEMBER');
    });

    it('atomically transfers ownership to an existing member', async () => {
      // Transfer orgA ownership from userOwnerA to userEngineerA
      const transferred = await transferOrganizationOwnership({
        organizationId: orgAId,
        newOwnerUserId: userEngineerAId,
        currentOwnerUserId: userOwnerAId,
      });

      expect(transferred).toBe(true);

      const members = await getOrganizationMembers(orgAId);
      const newOwner = members.find((m) => m.userId === userEngineerAId);
      const prevOwner = members.find((m) => m.userId === userOwnerAId);

      expect(newOwner?.role).toBe('ORG_OWNER');
      expect(prevOwner?.role).toBe('ORG_ADMIN');

      // Transfer back to userOwnerA
      await transferOrganizationOwnership({
        organizationId: orgAId,
        newOwnerUserId: userOwnerAId,
        currentOwnerUserId: userEngineerAId,
      });
    });
  });

  // ============================================================
  // 2. INVITATION SECURITY & CSPRNG TOKENS
  // ============================================================
  describe('2. Team Invitation Security & SHA-256 Hashed Tokens', () => {
    let rawInviteToken: string;
    let invitationId: string;

    it('generates 256-bit CSPRNG token and stores only SHA-256 hash', async () => {
      const inviteResult = await inviteMember({
        organizationId: orgAId,
        email: `new-auditor-${testSuffix}@zerivex.local`,
        role: 'ORG_AUDITOR',
        actorUserId: userOwnerAId,
      });

      rawInviteToken = inviteResult.rawToken;
      invitationId = inviteResult.invitation.id;

      expect(rawInviteToken.startsWith(INVITATION_TOKEN_PREFIX)).toBe(true);
      expect(rawInviteToken.length).toBeGreaterThan(64);

      // Verify database stores SHA-256 hash, not raw token
      const expectedHash = hashInvitationToken(rawInviteToken);
      const dbRow = await query<{ token_hash: string }>(
        'SELECT token_hash FROM organization_invitations WHERE id = $1',
        [invitationId]
      );

      expect(dbRow.rows[0]?.token_hash).toBe(expectedHash);
      expect(dbRow.rows[0]?.token_hash).not.toBe(rawInviteToken);

      const pending = await getPendingInvitations(orgAId);
      expect(pending.some((p) => p.id === invitationId)).toBe(true);
    });

    it('allows public token lookup for preview before acceptance', async () => {
      const invite = await getInvitationByToken(rawInviteToken);
      expect(invite).not.toBeNull();
      expect(invite?.organizationId).toBe(orgAId);
      expect(invite?.role).toBe('ORG_AUDITOR');
      expect(invite?.status).toBe('PENDING');
      expect(invite?.isExpired).toBe(false);
    });

    it('accepts invitation, creates membership, and marks invitation ACCEPTED', async () => {
      const acceptResult = await acceptInvitation({
        rawToken: rawInviteToken,
        userId: userAuditorAId,
      });

      expect(acceptResult.organizationId).toBe(orgAId);
      expect(acceptResult.role).toBe('ORG_AUDITOR');

      // Verify membership created in DB
      const memberRes = await query<{ role: string }>(
        'SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2',
        [orgAId, userAuditorAId]
      );
      expect(memberRes.rows[0]?.role).toBe('ORG_AUDITOR');

      // Verify invitation status in DB
      const invRes = await query<{ status: string }>(
        'SELECT status FROM organization_invitations WHERE id = $1',
        [invitationId]
      );
      expect(invRes.rows[0]?.status).toBe('ACCEPTED');
    });

    it('rejects duplicate acceptance of already-accepted invitation', async () => {
      await expect(
        acceptInvitation({
          rawToken: rawInviteToken,
          userId: userAuditorAId,
        })
      ).rejects.toThrow(/already accepted/);
    });

    it('revokes pending invitations and prevents acceptance', async () => {
      const { rawToken, invitation } = await inviteMember({
        organizationId: orgAId,
        email: `revoked-${testSuffix}@zerivex.local`,
        role: 'ORG_VIEWER',
        actorUserId: userOwnerAId,
      });

      const revoked = await revokeInvitation({
        invitationId: invitation.id,
        organizationId: orgAId,
        actorUserId: userOwnerAId,
      });
      expect(revoked).toBe(true);

      await expect(
        acceptInvitation({
          rawToken,
          userId: userAuditorAId,
        })
      ).rejects.toThrow(/already revoked/);
    });
  });

  // ============================================================
  // 3. ENTERPRISE COMPLIANCE AUDIT VAULT
  // ============================================================
  describe('3. Enterprise Compliance Audit Vault', () => {
    beforeAll(async () => {
      // Record a test audit log with sensitive data in metadata to verify redaction
      await recordAuditEvent({
        organizationId: orgAId,
        actorUserId: userOwnerAId,
        action: 'SECURITY_POLICY_CHANGED',
        resourceType: 'POLICY',
        resourceId: 'compliance-pass-fail',
        reason: 'Updated SOC2 compliance baseline password policies',
        metadata: {
          client_secret: 'super_secret_raw_key_12345',
          safe_param: 'enforce_mfa',
          api_token: 'zx_live_sensitive_token_abc',
        },
      });
    });

    it('queries audit logs with actor attribution and metadata scrubbing', async () => {
      const result = await queryAuditVault({
        organizationId: orgAId,
        limit: 10,
      });

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);

      const policyEntry = result.entries.find((e) => e.action === 'SECURITY_POLICY_CHANGED');
      expect(policyEntry).toBeDefined();
      expect(policyEntry?.actorEmail).toContain(testSuffix);

      // Sensitive fields must be redacted
      expect(String(policyEntry?.metadata.client_secret)).toContain('REDACTED');
      expect(policyEntry?.metadata.safe_param).toBe('enforce_mfa');
    });

    it('exports audit vault to RFC 4180 compliant CSV', async () => {
      const exportRes = await exportAuditVault({
        filter: { organizationId: orgAId },
        format: 'csv',
        actorUserId: userOwnerAId,
      });

      expect(exportRes.mimeType).toBe('text/csv; charset=utf-8');
      expect(exportRes.filename).toContain('.csv');
      expect(exportRes.recordCount).toBeGreaterThan(0);

      // Verify RFC 4180 format
      const lines = exportRes.data.split('\r\n');
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toBe(
        'Event ID,Timestamp (UTC),Action,Actor Email,Actor Name,Resource Type,Resource ID,IP Address,Reason,Metadata (JSON)'
      );

      // Verify that AUDIT_VAULT_EXPORTED event was recorded
      const checkAudit = await queryAuditVault({
        organizationId: orgAId,
        action: 'AUDIT_VAULT_EXPORTED',
      });
      expect(checkAudit.entries.length).toBeGreaterThan(0);
    });

    it('exports audit vault to SIEM JSON format', async () => {
      const exportRes = await exportAuditVault({
        filter: { organizationId: orgAId },
        format: 'json',
        actorUserId: userOwnerAId,
      });

      expect(exportRes.mimeType).toBe('application/json; charset=utf-8');
      const parsed = JSON.parse(exportRes.data);
      expect(parsed.exportVersion).toBe('1.0');
      expect(parsed.organizationId).toBe(orgAId);
      expect(Array.isArray(parsed.events)).toBe(true);
      expect(parsed.events.length).toBe(exportRes.recordCount);
    });

    it('verifies chronological monotonic integrity of audit vault sequence', async () => {
      const integrity = await verifyAuditVaultIntegrity(orgAId);
      expect(integrity.verified).toBe(true);
      expect(integrity.isMonotonic).toBe(true);
      expect(integrity.totalRecords).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 4. FINDING COLLABORATION & ASSIGNEE TRACKING
  // ============================================================
  describe('4. Finding Collaboration & Assignee Tracking', () => {
    it('adds and retrieves comments on vulnerability findings', async () => {
      const comment = await addFindingComment({
        findingId: findingAId,
        organizationId: orgAId,
        userId: userEngineerAId,
        content: 'Investigating CSP header directive in next.config.mjs.',
      });

      expect(comment.findingId).toBe(findingAId);
      expect(comment.content).toContain('next.config.mjs');
      expect(comment.authorEmail).toContain('engineer-a');

      // Fetch comments thread
      const comments = await getFindingComments({
        findingId: findingAId,
        organizationId: orgAId,
      });

      expect(comments.length).toBeGreaterThan(0);
      expect(comments.some((c) => c.id === comment.id)).toBe(true);
    });

    it('prevents cross-tenant commenting on findings', async () => {
      await expect(
        addFindingComment({
          findingId: findingAId,
          organizationId: orgBId, // wrong organization
          userId: userOwnerBId,
          content: 'Malicious cross-tenant note injection',
        })
      ).rejects.toThrow(/Finding not found or access denied/);
    });

    it('assigns finding to an active member and records system note & audit event', async () => {
      const assignRes = await assignFinding({
        findingId: findingAId,
        organizationId: orgAId,
        actorUserId: userOwnerAId,
        assignedUserId: userEngineerAId,
      });

      expect(assignRes.findingId).toBe(findingAId);
      expect(assignRes.assignedUserId).toBe(userEngineerAId);

      // Verify finding in database has assigned_user_id
      const fRes = await query<{ assigned_user_id: string }>(
        'SELECT assigned_user_id FROM findings WHERE id = $1',
        [findingAId]
      );
      expect(fRes.rows[0]?.assigned_user_id).toBe(userEngineerAId);

      // Verify system note in comments
      const comments = await getFindingComments({
        findingId: findingAId,
        organizationId: orgAId,
      });
      const systemNote = comments.find((c) => c.commentType === 'SYSTEM_NOTE');
      expect(systemNote).toBeDefined();
      expect(systemNote?.content).toContain('Assigned finding to');

      // Verify audit log
      const auditRes = await queryAuditVault({
        organizationId: orgAId,
        action: 'FINDING_ASSIGNED',
      });
      expect(auditRes.entries.length).toBeGreaterThan(0);
    });

    it('rejects assigning finding to a non-organization member', async () => {
      await expect(
        assignFinding({
          findingId: findingAId,
          organizationId: orgAId,
          actorUserId: userOwnerAId,
          assignedUserId: userOwnerBId, // member of Org B, not Org A
        })
      ).rejects.toThrow(/not an active member/);
    });
  });
});
