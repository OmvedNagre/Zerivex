import { NextRequest, NextResponse } from 'next/server';
import { requireApiOrSessionAuth, handleAuthError } from '@/core/rbac/authorization-guard';
import { createWebhook, getWebhooksByOrg } from '@/core/webhooks/webhook-repository';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'webhooks:read');
    const webhooks = await getWebhooksByOrg(auth.organizationId);

    return NextResponse.json({
      success: true,
      data: { webhooks },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'webhooks:create');
    const body = await req.json();

    const { name, url, events, secret } = body as {
      name: string;
      url: string;
      events?: string[];
      secret?: string;
    };

    if (!name || !url) {
      return NextResponse.json(
        { success: false, error: 'Webhook name and url are required' },
        { status: 400 }
      );
    }

    const webhook = await createWebhook({
      organizationId: auth.organizationId,
      userId: auth.userId,
      name,
      url,
      events,
      secret,
    });

    return NextResponse.json({
      success: true,
      data: { webhook },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
