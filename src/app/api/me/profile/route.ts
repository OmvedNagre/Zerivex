import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import {
  getUserProfile,
  upsertUserProfile,
  validateProfileInput,
} from '@/core/profile/profile-service';

import { query } from '@/core/db/database';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const profile = await getUserProfile(auth.user.id);

    const userRes = await query<{ createdAt: Date }>(
      'SELECT created_at as "createdAt" FROM users WHERE id = $1',
      [auth.user.id]
    );
    const userCreatedAt = userRes.rows[0]?.createdAt;
    const isNewUser = userCreatedAt
      ? Date.now() - new Date(userCreatedAt).getTime() < 7 * 24 * 60 * 60 * 1000
      : false;

    return NextResponse.json({
      success: true,
      data: {
        profile,
        isNewUser,
        hasCompletedOnboarding: Boolean(profile?.onboardingCompletedAt),
        hasSkippedOnboarding: Boolean(profile?.onboardingSkippedAt),
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = await req.json().catch(() => ({}));

    // 1. Strict input validation and sanitization
    const validation = validateProfileInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // 2. Fetch active organization context for optional audit logging
    let orgId: string | undefined;
    try {
      const orgCtx = await getUserActiveOrganization(auth.user.id);
      orgId = orgCtx.organizationId;
    } catch {
      // Organization context optional for personal profile
    }

    // 3. Upsert profile
    const updated = await upsertUserProfile(auth.user.id, validation.sanitized, orgId);

    return NextResponse.json({
      success: true,
      data: {
        profile: updated,
        hasCompletedOnboarding: Boolean(updated.onboardingCompletedAt),
        hasSkippedOnboarding: Boolean(updated.onboardingSkippedAt),
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
