import { NextRequest, NextResponse } from 'next/server';
import {
  verifyStripeWebhookSignature,
  handleStripeWebhookEvent,
} from '@/core/billing/stripe-service';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // In production or when webhook secret is configured, strictly enforce signature
    if (webhookSecret) {
      const verification = verifyStripeWebhookSignature(rawBody, signature, webhookSecret);
      if (!verification.valid) {
        return NextResponse.json(
          { error: `Webhook signature verification failed: ${verification.error}` },
          { status: 400 }
        );
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'STRIPE_WEBHOOK_SECRET must be configured in production' },
        { status: 500 }
      );
    }

    let event: { id: string; type: string; data: { object: Record<string, unknown> } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const result = await handleStripeWebhookEvent(event);

    return NextResponse.json({
      received: true,
      handled: result.handled,
      action: result.action,
    });
  } catch (error) {
    console.error('[STRIPE WEBHOOK ERROR]', (error as Error).message);
    return NextResponse.json(
      { error: (error as Error).message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
