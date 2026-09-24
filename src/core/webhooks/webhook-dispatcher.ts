/**
 * Zerivex Outbound Webhook Dispatcher
 * Dispatches cryptographically signed webhook notifications to customer endpoints.
 * Protected against SSRF via SafeHttpClient and verifies delivery integrity.
 */

import crypto from 'crypto';
import { safeFetch, SecuritySSRFError } from '@/core/security/safe-http-client';
import {
  getWebhooksByOrg,
  getWebhookById,
  recordWebhookDelivery,
  WebhookEventName,
} from './webhook-repository';

export interface WebhookPayload<T = Record<string, unknown>> {
  id: string;
  event: string;
  createdAt: string;
  organizationId: string;
  data: T;
}

/**
 * Sign payload using HMAC-SHA256.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${hmac}`;
}

/**
 * Verify inbound webhook signature using constant-time comparison.
 */
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expected = signWebhookPayload(payload, secret);

  const sigBuffer = Buffer.from(signatureHeader, 'utf-8');
  const expectedBuffer = Buffer.from(expected, 'utf-8');

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Dispatch an event to all active webhooks subscribed to it within an organization.
 */
export async function dispatchWebhookEvent(params: {
  organizationId: string;
  eventType: WebhookEventName;
  data: Record<string, unknown>;
}): Promise<{ dispatched: number; successful: number }> {
  const { organizationId, eventType, data } = params;

  const webhooks = await getWebhooksByOrg(organizationId);
  const eligibleWebhooks = webhooks.filter(
    (w) => w.isActive && w.events.includes(eventType)
  );

  let successful = 0;

  for (const webhook of eligibleWebhooks) {
    const deliveryId = crypto.randomUUID();
    const payloadObject: WebhookPayload = {
      id: deliveryId,
      event: eventType,
      createdAt: new Date().toISOString(),
      organizationId,
      data,
    };

    const payloadString = JSON.stringify(payloadObject);
    const signature = signWebhookPayload(payloadString, webhook.secret);

    const startTime = Date.now();
    let statusCode: number | null = null;
    let isSuccess = false;
    let errorMessage: string | null = null;

    try {
      const res = await safeFetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Zerivex-Webhook-Dispatcher/1.0',
          'X-Zerivex-Signature-256': signature,
          'X-Zerivex-Event': eventType,
          'X-Zerivex-Delivery': deliveryId,
        },
        body: payloadString,
        timeoutMs: 5000,
        followRedirects: false, // Disallow redirects for webhooks to prevent destination hopping
      });

      statusCode = res.statusCode;
      isSuccess = res.statusCode >= 200 && res.statusCode < 300;
      if (!isSuccess) {
        errorMessage = `Webhook endpoint returned non-2xx status code: ${res.statusCode}`;
      } else {
        successful++;
      }
    } catch (err: unknown) {
      if (err instanceof SecuritySSRFError) {
        errorMessage = `SSRF Defense Blocked: ${err.message}`;
      } else {
        errorMessage = (err as Error).message || 'Connection failed';
      }
    }

    const responseTimeMs = Date.now() - startTime;

    await recordWebhookDelivery({
      webhookId: webhook.id,
      organizationId,
      eventType,
      payload: payloadObject as unknown as Record<string, unknown>,
      statusCode,
      responseTimeMs,
      success: isSuccess,
      errorMessage,
    });
  }

  return { dispatched: eligibleWebhooks.length, successful };
}

/**
 * Send a test ping event to verify webhook connectivity.
 */
export async function sendWebhookPing(params: {
  webhookId: string;
  organizationId: string;
}): Promise<{
  success: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  errorMessage: string | null;
}> {
  const { webhookId, organizationId } = params;
  const webhook = await getWebhookById(webhookId, organizationId);

  if (!webhook) {
    throw new Error('Webhook not found');
  }

  const deliveryId = crypto.randomUUID();
  const payloadObject: WebhookPayload = {
    id: deliveryId,
    event: 'ping',
    createdAt: new Date().toISOString(),
    organizationId,
    data: {
      message: 'Hello from Zerivex! Webhook integration test ping.',
      webhookId: webhook.id,
      webhookName: webhook.name,
    },
  };

  const payloadString = JSON.stringify(payloadObject);
  const signature = signWebhookPayload(payloadString, webhook.secret);

  const startTime = Date.now();
  let statusCode: number | null = null;
  let isSuccess = false;
  let errorMessage: string | null = null;

  try {
    const res = await safeFetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Zerivex-Webhook-Dispatcher/1.0',
        'X-Zerivex-Signature-256': signature,
        'X-Zerivex-Event': 'ping',
        'X-Zerivex-Delivery': deliveryId,
      },
      body: payloadString,
      timeoutMs: 5000,
      followRedirects: false,
    });

    statusCode = res.statusCode;
    isSuccess = res.statusCode >= 200 && res.statusCode < 300;
    if (!isSuccess) {
      errorMessage = `Target returned status ${res.statusCode}`;
    }
  } catch (err: unknown) {
    if (err instanceof SecuritySSRFError) {
      errorMessage = `SSRF Blocked: ${err.message}`;
    } else {
      errorMessage = (err as Error).message || 'Connection failed';
    }
  }

  const responseTimeMs = Date.now() - startTime;

  await recordWebhookDelivery({
    webhookId: webhook.id,
    organizationId,
    eventType: 'ping',
    payload: payloadObject as unknown as Record<string, unknown>,
    statusCode,
    responseTimeMs,
    success: isSuccess,
    errorMessage,
  });

  return {
    success: isSuccess,
    statusCode,
    responseTimeMs,
    errorMessage,
  };
}
