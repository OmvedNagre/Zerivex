/**
 * Zerivex Finding Collaboration & Commenting Service
 * Manages multi-engineer collaboration threads, system notes, and assignee tracking.
 */

import { query, withTransaction } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';

export type CommentType = 'USER_COMMENT' | 'SYSTEM_NOTE' | 'STATUS_CHANGE_NOTE';

export interface FindingComment {
  id: string;
  findingId: string;
  organizationId: string;
  userId: string;
  content: string;
  commentType: CommentType;
  createdAt: Date;
  updatedAt: Date;
}

export interface FindingCommentWithAuthor extends FindingComment {
  authorEmail: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
}

/**
 * Add a comment or system note to a vulnerability finding.
 */
export async function addFindingComment(params: {
  findingId: string;
  organizationId: string;
  userId: string;
  content: string;
  commentType?: CommentType;
  ipAddress?: string;
  userAgent?: string;
}): Promise<FindingCommentWithAuthor> {
  const {
    findingId,
    organizationId,
    userId,
    content,
    commentType = 'USER_COMMENT',
    ipAddress,
    userAgent,
  } = params;

  if (!content || !content.trim()) {
    throw new Error('Comment content cannot be empty');
  }

  // 1. Verify finding belongs to organization (Multi-tenant security)
  const findingRes = await query<{ id: string; title: string }>(
    `SELECT id, title FROM findings WHERE id = $1 AND organization_id = $2`,
    [findingId, organizationId]
  );

  if (findingRes.rows.length === 0) {
    throw new Error('Finding not found or access denied in this organization');
  }

  const finding = findingRes.rows[0];
  if (!finding) {
    throw new Error('Finding not found or access denied in this organization');
  }

  // 2. Insert comment
  const insertRes = await query<FindingComment>(
    `
    INSERT INTO finding_comments (
      finding_id,
      organization_id,
      user_id,
      content,
      comment_type
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      finding_id as "findingId",
      organization_id as "organizationId",
      user_id as "userId",
      content,
      comment_type as "commentType",
      created_at as "createdAt",
      updated_at as "updatedAt"
    `,
    [findingId, organizationId, userId, content.trim(), commentType]
  );

  const comment = insertRes.rows[0];
  if (!comment) {
    throw new Error('Failed to create finding comment');
  }

  // 3. Fetch author profile details
  const authorRes = await query<{
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  }>(
    `SELECT email, display_name as "displayName", avatar_url as "avatarUrl" FROM users WHERE id = $1`,
    [userId]
  );
  const author = authorRes.rows[0];

  // 4. Audit trail entry
  await recordAuditEvent({
    organizationId,
    actorUserId: userId,
    action: 'FINDING_COMMENT_ADDED',
    resourceType: 'FINDING_COMMENT',
    resourceId: comment.id,
    reason: `Added ${commentType} on finding "${finding.title}"`,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    metadata: {
      findingId,
      commentType,
    },
  });

  return {
    id: comment.id,
    findingId: comment.findingId,
    organizationId: comment.organizationId,
    userId: comment.userId,
    content: comment.content,
    commentType: comment.commentType,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    authorEmail: author?.email ?? 'Unknown User',
    authorName: author?.displayName ?? null,
    authorAvatarUrl: author?.avatarUrl ?? null,
  };
}

/**
 * Retrieve chronological comment thread for a vulnerability finding.
 */
export async function getFindingComments(params: {
  findingId: string;
  organizationId: string;
}): Promise<FindingCommentWithAuthor[]> {
  const { findingId, organizationId } = params;

  // Verify finding belongs to organization
  const findingRes = await query<{ id: string }>(
    `SELECT id FROM findings WHERE id = $1 AND organization_id = $2`,
    [findingId, organizationId]
  );

  if (findingRes.rows.length === 0) {
    throw new Error('Finding not found or access denied in this organization');
  }

  const res = await query<FindingCommentWithAuthor>(
    `
    SELECT
      fc.id,
      fc.finding_id as "findingId",
      fc.organization_id as "organizationId",
      fc.user_id as "userId",
      fc.content,
      fc.comment_type as "commentType",
      fc.created_at as "createdAt",
      fc.updated_at as "updatedAt",
      u.email as "authorEmail",
      u.display_name as "authorName",
      u.avatar_url as "authorAvatarUrl"
    FROM finding_comments fc
    JOIN users u ON fc.user_id = u.id
    WHERE fc.finding_id = $1 AND fc.organization_id = $2
    ORDER BY fc.created_at ASC
    `,
    [findingId, organizationId]
  );

  return res.rows;
}

/**
 * Assign or reassign a finding to an organization member.
 */
export async function assignFinding(params: {
  findingId: string;
  organizationId: string;
  actorUserId: string;
  assignedUserId: string | null;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{
  findingId: string;
  assignedUserId: string | null;
  assignedUserEmail: string | null;
  assignedUserName: string | null;
}> {
  const { findingId, organizationId, actorUserId, assignedUserId, ipAddress, userAgent } = params;

  return await withTransaction(async (client) => {
    // 1. Verify finding exists in organization
    const findingRes = await client.query<{ id: string; title: string; assigned_user_id: string | null }>(
      `SELECT id, title, assigned_user_id FROM findings WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [findingId, organizationId]
    );

    if (findingRes.rows.length === 0) {
      throw new Error('Finding not found or access denied in this organization');
    }

    const finding = findingRes.rows[0];
    if (!finding) {
      throw new Error('Finding not found or access denied in this organization');
    }

    // 2. If assigning, verify assigned user is a member of the organization
    let assignedEmail: string | null = null;
    let assignedName: string | null = null;

    if (assignedUserId) {
      const memberRes = await client.query<{ email: string; displayName: string | null }>(
        `
        SELECT u.email, u.display_name as "displayName"
        FROM memberships m
        JOIN users u ON m.user_id = u.id
        WHERE m.organization_id = $1 AND m.user_id = $2
        `,
        [organizationId, assignedUserId]
      );

      const member = memberRes.rows[0];
      if (!member) {
        throw new Error('Assigned user is not an active member of this organization');
      }

      assignedEmail = member.email;
      assignedName = member.displayName;
    }

    // 3. Update finding assignment
    await client.query(
      `UPDATE findings SET assigned_user_id = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3`,
      [assignedUserId, findingId, organizationId]
    );

    // 4. Create system note
    const systemNoteContent = assignedUserId
      ? `Assigned finding to ${assignedName || assignedEmail}`
      : 'Removed assignee from finding';

    await client.query(
      `
      INSERT INTO finding_comments (
        finding_id,
        organization_id,
        user_id,
        content,
        comment_type
      )
      VALUES ($1, $2, $3, $4, 'SYSTEM_NOTE')
      `,
      [findingId, organizationId, actorUserId, systemNoteContent]
    );

    // 5. Record audit event
    await recordAuditEvent(
      {
        organizationId,
        actorUserId,
        action: 'FINDING_ASSIGNED',
        resourceType: 'FINDING',
        resourceId: findingId,
        reason: systemNoteContent,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: {
          findingTitle: finding.title,
          assignedUserId,
          assignedEmail,
          previousAssigneeId: finding.assigned_user_id,
        },
      },
      client
    );

    return {
      findingId,
      assignedUserId,
      assignedUserEmail: assignedEmail,
      assignedUserName: assignedName,
    };
  });
}
