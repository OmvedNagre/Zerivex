import { NextRequest, NextResponse } from 'next/server';
import { requireApiOrSessionAuth, handleAuthError } from '@/core/rbac/authorization-guard';
import { createApiKey, listApiKeysByOrg } from '@/core/auth/api-key-service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'apikeys:read');
    const apiKeys = await listApiKeysByOrg(auth.organizationId);

    return NextResponse.json({
      success: true,
      data: { apiKeys },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'apikeys:create');
    const body = await req.json();

    const { name, scopes, expiresInDays } = body as {
      name: string;
      scopes?: string[];
      expiresInDays?: number;
    };

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'API key name is required' },
        { status: 400 }
      );
    }

    const { rawKey, apiKey } = await createApiKey({
      organizationId: auth.organizationId,
      userId: auth.userId,
      name,
      scopes,
      expiresInDays,
    });

    return NextResponse.json({
      success: true,
      data: {
        rawKey, // Revealed strictly once
        apiKey,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
