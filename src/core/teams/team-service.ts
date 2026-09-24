/**
 * Zerivex Enterprise Teams & Organization Membership Service
 * Implements team invitations, role hierarchies, and Sole Owner Protection guards.
 */

import crypto from 'crypto';
import { query, withTransaction } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { OrganizationRole } from '@/core/rbac/permissions';

export interface OrganizationMember {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: OrganizationRole;
  joinedAt: Date;
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  inviterEmail?: string;
  inviterName?: string;
  organizationName?: string;
}

export const INVITATION_TOKEN_PREFIX = 'inv_';
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hash raw invitation token with SHA-256 for persistent database storage.
 */
export function hashInvitationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Fetch all members of an organization with profile metadata.
 */
export async function getOrganizationMembers(
  organizationId: string
): Promise<OrganizationMember[]> {
  const res = await query<{
    userId: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: OrganizationRole;
    joinedAt: Date;
  }>(
    `
    SELECT
      u.id as "userId",
      u.email,
      u.display_name as "displayName",
      u.avatar_url as "avatarUrl",
      m.role,
      m.created_at as "joinedAt"
    FROM memberships m
    JOIN users u ON u.id = m.user_id
    WHERE m.organization_id = $1
    ORDER BY
      CASE m.role
        WHEN 'ORG_OWNER' THEN 1
        WHEN 'ORG_ADMIN' THEN 2
        WHEN 'ORG_MEMBER' THEN 3
        WHEN 'ORG_VIEWER' THEN 4
        ELSE 5
      END ASC,
      m.created_at ASC
    `,
    [organizationId]
  );

  return res.rows;
}

/**
 * Invite a new member to an organization.
 * Generates a 256-bit CSPRNG token and stores only the SHA-256 hash.
 */
export async function inviteMember(params: {
  organizationId: string;
  email: string;
  role: OrganizationRole;
  actorUserId: string;
}): Promise<{ invitation: OrganizationInvitation; rawToken: string; inviteUrl: string }> {
  const { organizationId, email, role, actorUserId } = params;
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Valid email address is required');
  }

  // 1. Check if user is already an active member
  const existingMemberRes = await query<{ id: string }>(
    `
    SELECT m.id
    FROM memberships m
    JOIN users u ON u.id = m.user_id
    WHERE m.organization_id = $1 AND LOWER(u.email) = $2
    LIMIT 1
    `,
    [organizationId, normalizedEmail]
  );

  if (existingMemberRes.rows.length > 0) {
    throw new Error(`User with email "${normalizedEmail}" is already a member of this organization`);
  }

  // 2. Revoke any existing pending invitations for this email in this org
  await query(
    `
    UPDATE organization_invitations
    SET status = 'REVOKED', updated_at = NOW()
    WHERE organization_id = $1 AND LOWER(email) = $2 AND status = 'PENDING'
    `,
    [organizationId, normalizedEmail]
  );

  // 3. Generate 256-bit CSPRNG token
  const randomEntropy = crypto.randomBytes(32).toString('hex');
  const rawToken = `${INVITATION_TOKEN_PREFIX}${randomEntropy}`;
  const tokenHash = hashInvitationToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const res = await query<{
    id: string;
    organization_id: string;
    email: string;
    role: OrganizationRole;
    status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
    expires_at: Date;
    accepted_at: Date | null;
    created_at: Date;
  }>(
    `
    INSERT INTO organization_invitations (
      organization_id,
      email,
      role,
      token_hash,
      invited_by_user_id,
      status,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
    RETURNING *
    `,
    [organizationId, normalizedEmail, role, tokenHash, actorUserId, expiresAt]
  );

  const row = res.rows[0]!;

  await recordAuditEvent({
    organizationId,
    actorUserId,
    action: 'ORGANIZATION_INVITATION_CREATED',
    resourceType: 'invitation',
    resourceId: row.id,
    metadata: {
      email: normalizedEmail,
      role,
      expiresAt: row.expires_at,
    },
  });

  return {
    invitation: {
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      role: row.role,
      status: row.status,
      expiresAt: row.expires_at,
      acceptedAt: row.accepted_at,
      createdAt: row.created_at,
    },
    rawToken,
    inviteUrl: `/invite/${rawToken}`,
  };
}

/**
 * List all pending non-expired invitations for an organization.
 */
export async function getPendingInvitations(
  organizationId: string
): Promise<OrganizationInvitation[]> {
  const res = await query<{
    id: string;
    organization_id: string;
    email: string;
    role: OrganizationRole;
    status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
    expires_at: Date;
    accepted_at: Date | null;
    created_at: Date;
    inviterEmail: string;
    inviterName: string | null;
    organizationName: string;
  }>(
    `
    SELECT
      i.id,
      i.organization_id,
      i.email,
      i.role,
      i.status,
      i.expires_at,
      i.accepted_at,
      i.created_at,
      u.email as "inviterEmail",
      u.display_name as "inviterName",
      o.name as "organizationName"
    FROM organization_invitations i
    JOIN users u ON u.id = i.invited_by_user_id
    JOIN organizations o ON o.id = i.organization_id
    WHERE i.organization_id = $1
      AND i.status = 'PENDING'
      AND i.expires_at > NOW()
    ORDER BY i.created_at DESC
    `,
    [organizationId]
  );

  return res.rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    email: r.email,
    role: r.role,
    status: r.status,
    expiresAt: r.expires_at,
    acceptedAt: r.accepted_at,
    createdAt: r.created_at,
    inviterEmail: r.inviterEmail,
    inviterName: r.inviterName ?? undefined,
    organizationName: r.organizationName,
  }));
}

/**
 * Revoke a pending invitation.
 */
export async function revokeInvitation(params: {
  invitationId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<boolean> {
  const { invitationId, organizationId, actorUserId } = params;

  const res = await query<{ id: string; email: string }>(
    `
    UPDATE organization_invitations
    SET status = 'REVOKED', updated_at = NOW()
    WHERE id = $1 AND organization_id = $2 AND status = 'PENDING'
    RETURNING id, email
    `,
    [invitationId, organizationId]
  );

  const row = res.rows[0];
  if (!row) return false;

  await recordAuditEvent({
    organizationId,
    actorUserId,
    action: 'ORGANIZATION_INVITATION_REVOKED',
    resourceType: 'invitation',
    resourceId: row.id,
    metadata: { email: row.email },
  });

  return true;
}

/**
 * Accept a team invitation via raw token.
 */
export async function acceptInvitation(params: {
  rawToken: string;
  userId: string;
}): Promise<{ organizationId: string; role: OrganizationRole }> {
  const { rawToken, userId } = params;

  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Valid invitation token is required');
  }

  const tokenHash = hashInvitationToken(rawToken);

  return withTransaction(async (client) => {
    // 1. Fetch invitation
    const invRes = await client.query<{
      id: string;
      organization_id: string;
      email: string;
      role: OrganizationRole;
      status: string;
      expires_at: Date;
    }>(
      `
      SELECT id, organization_id, email, role, status, expires_at
      FROM organization_invitations
      WHERE token_hash = $1
      FOR UPDATE
      `,
      [tokenHash]
    );

    const invite = invRes.rows[0];
    if (!invite) {
      throw new Error('Invalid invitation token');
    }

    if (invite.status !== 'PENDING') {
      throw new Error(`Invitation is already ${invite.status.toLowerCase()}`);
    }

    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      await client.query(
        "UPDATE organization_invitations SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1",
        [invite.id]
      );
      throw new Error('Invitation token has expired');
    }

    // 2. Add or update organization membership
    await client.query(
      `
      INSERT INTO memberships (organization_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role = EXCLUDED.role
      `,
      [invite.organization_id, userId, invite.role]
    );

    // 3. Mark invitation as accepted
    await client.query(
      `
      UPDATE organization_invitations
      SET status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW()
      WHERE id = $1
      `,
      [invite.id]
    );

    await recordAuditEvent({
      organizationId: invite.organization_id,
      actorUserId: userId,
      action: 'ORGANIZATION_INVITATION_ACCEPTED',
      resourceType: 'invitation',
      resourceId: invite.id,
      metadata: { role: invite.role, email: invite.email },
    });

    return {
      organizationId: invite.organization_id,
      role: invite.role,
    };
  });
}

/**
 * Update member role with Sole Owner Protection guard.
 */
export async function updateMemberRole(params: {
  organizationId: string;
  targetUserId: string;
  newRole: OrganizationRole;
  actorUserId: string;
}): Promise<OrganizationRole> {
  const { organizationId, targetUserId, newRole, actorUserId } = params;

  return withTransaction(async (client) => {
    // 1. Fetch current role
    const currentRes = await client.query<{ role: OrganizationRole }>(
      'SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2 FOR UPDATE',
      [organizationId, targetUserId]
    );

    const currentRole = currentRes.rows[0]?.role;
    if (!currentRole) {
      throw new Error('Target user is not a member of this organization');
    }

    // 2. Sole Owner Protection Guard: Cannot demote the last ORG_OWNER
    if (currentRole === 'ORG_OWNER' && newRole !== 'ORG_OWNER') {
      const ownerCountRes = await client.query<{ count: string }>(
        "SELECT count(*)::text as count FROM memberships WHERE organization_id = $1 AND role = 'ORG_OWNER'",
        [organizationId]
      );
      const ownerCount = parseInt(ownerCountRes.rows[0]?.count ?? '0', 10);
      if (ownerCount <= 1) {
        throw new Error(
          'Cannot demote the sole organization owner. Transfer ownership to another member before changing role.'
        );
      }
    }

    // 3. Update role
    await client.query(
      'UPDATE memberships SET role = $1 WHERE organization_id = $2 AND user_id = $3',
      [newRole, organizationId, targetUserId]
    );

    await recordAuditEvent({
      organizationId,
      actorUserId,
      action: 'ORGANIZATION_MEMBER_ROLE_CHANGED',
      resourceType: 'membership',
      resourceId: targetUserId,
      metadata: { previousRole: currentRole, newRole },
    });

    return newRole;
  });
}

/**
 * Remove member from organization with Sole Owner Protection guard.
 */
export async function removeMember(params: {
  organizationId: string;
  targetUserId: string;
  actorUserId: string;
}): Promise<boolean> {
  const { organizationId, targetUserId, actorUserId } = params;

  return withTransaction(async (client) => {
    // 1. Check current role
    const currentRes = await client.query<{ role: OrganizationRole }>(
      'SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2 FOR UPDATE',
      [organizationId, targetUserId]
    );

    const currentRole = currentRes.rows[0]?.role;
    if (!currentRole) {
      return false;
    }

    // 2. Sole Owner Protection Guard: Cannot remove the last ORG_OWNER
    if (currentRole === 'ORG_OWNER') {
      const ownerCountRes = await client.query<{ count: string }>(
        "SELECT count(*)::text as count FROM memberships WHERE organization_id = $1 AND role = 'ORG_OWNER'",
        [organizationId]
      );
      const ownerCount = parseInt(ownerCountRes.rows[0]?.count ?? '0', 10);
      if (ownerCount <= 1) {
        throw new Error(
          'Cannot remove the sole organization owner. Transfer ownership to another member before leaving.'
        );
      }
    }

    // 3. Delete membership
    await client.query(
      'DELETE FROM memberships WHERE organization_id = $1 AND user_id = $2',
      [organizationId, targetUserId]
    );

    await recordAuditEvent({
      organizationId,
      actorUserId,
      action: 'ORGANIZATION_MEMBER_REMOVED',
      resourceType: 'membership',
      resourceId: targetUserId,
      metadata: { removedUserId: targetUserId, previousRole: currentRole },
    });

    return true;
  });
}

/**
 * Atomically transfer primary organization ownership to another existing member.
 */
export async function transferOrganizationOwnership(params: {
  organizationId: string;
  newOwnerUserId: string;
  currentOwnerUserId: string;
}): Promise<boolean> {
  const { organizationId, newOwnerUserId, currentOwnerUserId } = params;

  return withTransaction(async (client) => {
    // Verify target user is an existing member
    const newOwnerRes = await client.query<{ role: string }>(
      'SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2',
      [organizationId, newOwnerUserId]
    );

    if (newOwnerRes.rows.length === 0) {
      throw new Error('New owner must be an existing member of the organization');
    }

    // 1. Promote new owner to ORG_OWNER
    await client.query(
      "UPDATE memberships SET role = 'ORG_OWNER' WHERE organization_id = $1 AND user_id = $2",
      [organizationId, newOwnerUserId]
    );

    // 2. Demote previous owner to ORG_ADMIN
    await client.query(
      "UPDATE memberships SET role = 'ORG_ADMIN' WHERE organization_id = $1 AND user_id = $2",
      [organizationId, currentOwnerUserId]
    );

    await recordAuditEvent({
      organizationId,
      actorUserId: currentOwnerUserId,
      action: 'ORGANIZATION_OWNERSHIP_TRANSFERRED',
      resourceType: 'organization',
      resourceId: organizationId,
      metadata: { previousOwner: currentOwnerUserId, newOwner: newOwnerUserId },
    });

    return true;
  });
}

/**
 * Look up public invitation metadata by raw token for previewing before acceptance.
 */
export async function getInvitationByToken(rawToken: string): Promise<{
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: OrganizationRole;
  status: string;
  expiresAt: Date;
  isExpired: boolean;
  inviterEmail: string;
  inviterName: string | null;
} | null> {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const tokenHash = hashInvitationToken(rawToken);

  const res = await query<{
    id: string;
    organization_id: string;
    organization_name: string;
    email: string;
    role: OrganizationRole;
    status: string;
    expires_at: Date;
    inviter_email: string;
    inviter_name: string | null;
  }>(
    `
    SELECT
      i.id,
      i.organization_id,
      o.name as organization_name,
      i.email,
      i.role,
      i.status,
      i.expires_at,
      u.email as inviter_email,
      u.display_name as inviter_name
    FROM organization_invitations i
    JOIN organizations o ON o.id = i.organization_id
    JOIN users u ON u.id = i.invited_by_user_id
    WHERE i.token_hash = $1
    LIMIT 1
    `,
    [tokenHash]
  );

  const row = res.rows[0];
  if (!row) return null;

  const isExpired = new Date(row.expires_at).getTime() <= Date.now() || row.status === 'EXPIRED';

  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expires_at,
    isExpired,
    inviterEmail: row.inviter_email,
    inviterName: row.inviter_name,
  };
}
