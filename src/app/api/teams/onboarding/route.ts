import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser, handleAuthError } from '@/core/rbac/authorization-guard';
import { query, withTransaction } from '@/core/db/database';
import { readJsonBody } from '@/core/security/request-body';
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuthenticatedUser(req);
    const result = await query(`SELECT o.name AS "organizationName",m.role,m.onboarding_completed_at AS "completedAt",p.onboarding_completed_at AS "profileCompletedAt" FROM memberships m JOIN organizations o ON o.id=m.organization_id LEFT JOIN user_profiles p ON p.user_id=m.user_id WHERE m.user_id=$1 AND m.organization_id=$2`, [session.user.id,session.organizationId]);
    if (!result.rows[0]) return NextResponse.json({error:'Workspace unavailable'},{status:403});
    return NextResponse.json({success:true,data:{...result.rows[0],displayName:session.user.displayName}});
  } catch(error) { return handleAuthError(error); }
}
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuthenticatedUser(req); const body = await readJsonBody(req);
    if (typeof body.displayName!=='string' || !body.displayName.trim() || body.displayName.length>80) return NextResponse.json({error:'Enter a name of 1–80 characters'},{status:400});
    await withTransaction(async client => {
      const membership = await client.query('UPDATE memberships SET onboarding_completed_at=NOW() WHERE user_id=$1 AND organization_id=$2 RETURNING user_id', [session.user.id,session.organizationId]);
      if (!membership.rows.length) throw Object.assign(new Error('Membership is no longer active'),{statusCode:403});
      await client.query('UPDATE users SET display_name=$1 WHERE id=$2',[body.displayName.trim(),session.user.id]);
      await client.query('INSERT INTO user_profiles (user_id,onboarding_completed_at,display_name) VALUES ($1,NOW(),$2) ON CONFLICT (user_id) DO UPDATE SET display_name=EXCLUDED.display_name,onboarding_completed_at=COALESCE(user_profiles.onboarding_completed_at,NOW())',[session.user.id,body.displayName.trim()]);
    });
    return NextResponse.json({success:true});
  } catch(error) { return handleAuthError(error); }
}
