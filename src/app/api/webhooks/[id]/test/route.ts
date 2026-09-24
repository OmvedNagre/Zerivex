import { NextRequest, NextResponse } from 'next/server';
import { requireApiOrSessionAuth, handleAuthError } from '@/core/rbac/authorization-guard';
import { sendWebhookPing } from '@/core/webhooks/webhook-dispatcher';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'webhooks:update');
    const { id } = await context.params;

    const result = await sendWebhookPing({
      webhookId: id,
      organizationId: auth.organizationId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
