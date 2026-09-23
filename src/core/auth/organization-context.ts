import crypto from 'crypto';
import { query, withTransaction } from '@/core/db/database';

export interface UserOrganizationContext {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
  defaultProjectId: string;
}

/**
 * Get or automatically provision an active organization & default project for a user.
 * Ensures every authenticated user always operates within a strict tenant boundary.
 */
export async function getUserActiveOrganization(userId: string): Promise<UserOrganizationContext> {
  // 1. Check existing memberships
  const membershipRes = await query<{
    organization_id: string;
    organization_name: string;
    organization_slug: string;
    role: string;
  }>(
    `
    SELECT
      m.organization_id,
      o.name as organization_name,
      o.slug as organization_slug,
      m.role
    FROM memberships m
    JOIN organizations o ON o.id = m.organization_id
    WHERE m.user_id = $1
    ORDER BY m.created_at ASC
    LIMIT 1
    `,
    [userId]
  );

  if (membershipRes.rows.length > 0) {
    const mem = membershipRes.rows[0]!;

    // Find default project
    const projectRes = await query<{ id: string }>(
      'SELECT id FROM projects WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 1',
      [mem.organization_id]
    );

    let defaultProjectId: string;

    if (projectRes.rows.length > 0) {
      defaultProjectId = projectRes.rows[0]!.id;
    } else {
      // Auto-create default project if none exists
      const newProj = await query<{ id: string }>(
        "INSERT INTO projects (organization_id, name, description) VALUES ($1, 'Default Project', 'Primary security assessment project') RETURNING id",
        [mem.organization_id]
      );
      defaultProjectId = newProj.rows[0]!.id;
    }

    return {
      organizationId: mem.organization_id,
      organizationName: mem.organization_name,
      organizationSlug: mem.organization_slug,
      role: mem.role,
      defaultProjectId,
    };
  }

  // 2. No membership found - atomically create Personal Organization & Default Project
  return withTransaction(async (client) => {
    // Get user details
    const userRes = await client.query<{ email: string; display_name: string | null }>(
      'SELECT email, display_name FROM users WHERE id = $1',
      [userId]
    );

    const user = userRes.rows[0];
    const orgName = user?.display_name ? `${user.display_name}'s Workspace` : 'Personal Workspace';
    const slug = `org-${crypto.randomBytes(4).toString('hex')}`;

    const orgRes = await client.query<{ id: string; name: string; slug: string }>(
      'INSERT INTO organizations (name, slug, created_by_user_id) VALUES ($1, $2, $3) RETURNING id, name, slug',
      [orgName, slug, userId]
    );
    const org = orgRes.rows[0]!;

    // Create membership as ORG_OWNER
    await client.query(
      "INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'ORG_OWNER')",
      [org.id, userId]
    );

    // Create default project
    const projRes = await client.query<{ id: string }>(
      "INSERT INTO projects (organization_id, name, description) VALUES ($1, 'Default Project', 'Primary security assessment project') RETURNING id",
      [org.id]
    );
    const defaultProjectId = projRes.rows[0]!.id;

    return {
      organizationId: org.id,
      organizationName: org.name,
      organizationSlug: org.slug,
      role: 'ORG_OWNER',
      defaultProjectId,
    };
  });
}
