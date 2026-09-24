import { NextRequest, NextResponse } from 'next/server';
import { requireApiOrSessionAuth, handleAuthError } from '@/core/rbac/authorization-guard';
import {
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
} from '@/core/webhooks/webhook-repository';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'webhooks:read');
    const { id } = await context.params;

    const webhook = await getWebhookById(id, auth.organizationId);
    if (!webhook) {
      return NextResponse.json(
        { success: false, error: 'Webhook not found' },
        { status: 404 }
      );
    }

    const deliveries = await getWebhookDeliveries(id, auth.organizationId, 50);

    return NextResponse.json({
      success: true,
      data: {
        webhook,
        deliveries,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'webhooks:update');
    const { id } = await context.params;
    const body = await req.json();

    const { name, url, events, isActive } = body as {
      name?: string;
      url?: string;
      events?: string[];
      isActive?: boolean;
    };

    const updated = await updateWebhook({
      id,
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      name,
      url,
      events,
      isActive,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Webhook not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { webhook: updated },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'webhooks:delete');
    const { id } = await context.params;

    const deleted = await deleteWebhook({
      id,
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
    });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Webhook not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook successfully deleted',
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
