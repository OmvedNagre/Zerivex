import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser, handleAuthError } from '@/core/rbac/authorization-guard';
import { evaluateLaunchReadiness } from '@/core/audit/launch-readiness';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuthenticatedUser(req);
    const report = await evaluateLaunchReadiness();

    return NextResponse.json({
      success: true,
      data: report,
      user: {
        id: session.user.id,
        role: session.user.role,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
