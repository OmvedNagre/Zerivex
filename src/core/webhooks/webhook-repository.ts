/**
 * Multi-Tenant Webhook Repository
 */

import crypto from 'crypto';
import { query } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';

export interface WebhookRecord {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  lastDeliveryAt: Date | null;
  lastStatusCode: number | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryRecord {
  id: string;
  webhookId: string;
  organizationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  responseTimeMs: number;
  success: boolean;
  errorMessage: string | null;
  deliveredAt: Date;
}

export const ALLOWED_WEBHOOK_EVENTS = [
  'scan.completed',
  'scan.failed',
  'gate.failed',
  'gate.passed',
  'finding.critical',
  'monitoring.regression',
] as const;

export type WebhookEventName = (typeof ALLOWED_WEBHOOK_EVENTS)[number];

export async function createWebhook(params: {
  organizationId: string;
  userId: string;
  name: string;
  url: string;
  events?: string[];
  secret?: string;
}): Promise<WebhookRecord> {
  const { organizationId, userId, name, url, events, secret } = params;

  if (!name || name.trim().length === 0) {
    throw new Error('Webhook name is required');
  }

  if (!url || !url.startsWith('https://') && !url.startsWith('http://')) {
    throw new Error('Valid HTTP/HTTPS webhook URL is required');
  }

  const generatedSecret = secret || crypto.randomBytes(32).toString('hex');
  const subscribedEvents = events && events.length > 0
    ? events.filter((e) => (ALLOWED_WEBHOOK_EVENTS as readonly string[]).includes(e))
    : ['scan.completed', 'scan.failed', 'gate.failed', 'finding.critical'];

  const res = await query<{
    id: string;
    organization_id: string;
    name: string;
    url: string;
    secret: string;
    events: string[];
    is_active: boolean;
    last_delivery_at: Date | null;
    last_status_code: number | null;
    created_by_user_id: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    INSERT INTO webhooks (
      organization_id,
      name,
      url,
      secret,
      events,
      is_active,
      created_by_user_id
    )
    VALUES ($1, $2, $3, $4, $5, true, $6)
    RETURNING *
    `,
    [organizationId, name.trim(), url.trim(), generatedSecret, subscribedEvents, userId]
  );

  const row = res.rows[0]!;

  await recordAuditEvent({
    organizationId,
    actorUserId: userId,
    action: 'WEBHOOK_CREATED',
    resourceType: 'webhook',
    resourceId: row.id,
    metadata: {
      name: row.name,
      url: row.url,
      events: row.events,
    },
  });

  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    url: row.url,
    secret: row.secret,
    events: row.events,
    isActive: row.is_active,
    lastDeliveryAt: row.last_delivery_at,
    lastStatusCode: row.last_status_code,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWebhooksByOrg(organizationId: string): Promise<WebhookRecord[]> {
  const res = await query<{
    id: string;
    organization_id: string;
    name: string;
    url: string;
    secret: string;
    events: string[];
    is_active: boolean;
    last_delivery_at: Date | null;
    last_status_code: number | null;
    created_by_user_id: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    SELECT *
    FROM webhooks
    WHERE organization_id = $1
    ORDER BY created_at DESC
    `,
    [organizationId]
  );

  return res.rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    url: row.url,
    secret: row.secret,
    events: row.events,
    isActive: row.is_active,
    lastDeliveryAt: row.last_delivery_at,
    lastStatusCode: row.last_status_code,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getWebhookById(
  id: string,
  organizationId: string
): Promise<WebhookRecord | null> {
  const res = await query<{
    id: string;
    organization_id: string;
    name: string;
    url: string;
    secret: string;
    events: string[];
    is_active: boolean;
    last_delivery_at: Date | null;
    last_status_code: number | null;
    created_by_user_id: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    SELECT *
    FROM webhooks
    WHERE id = $1 AND organization_id = $2
    LIMIT 1
    `,
    [id, organizationId]
  );

  const row = res.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    url: row.url,
    secret: row.secret,
    events: row.events,
    isActive: row.is_active,
    lastDeliveryAt: row.last_delivery_at,
    lastStatusCode: row.last_status_code,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateWebhook(params: {
  id: string;
  organizationId: string;
  actorUserId: string;
  name?: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
}): Promise<WebhookRecord | null> {
  const { id, organizationId, actorUserId, name, url, events, isActive } = params;

  const current = await getWebhookById(id, organizationId);
  if (!current) return null;

  const newName = name !== undefined ? name.trim() : current.name;
  const newUrl = url !== undefined ? url.trim() : current.url;
  const newEvents = events !== undefined ? events : current.events;
  const newActive = isActive !== undefined ? isActive : current.isActive;

  const res = await query<{
    id: string;
    organization_id: string;
    name: string;
    url: string;
    secret: string;
    events: string[];
    is_active: boolean;
    last_delivery_at: Date | null;
    last_status_code: number | null;
    created_by_user_id: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    UPDATE webhooks
    SET
      name = $1,
      url = $2,
      events = $3,
      is_active = $4,
      updated_at = NOW()
    WHERE id = $5 AND organization_id = $6
    RETURNING *
    `,
    [newName, newUrl, newEvents, newActive, id, organizationId]
  );

  const row = res.rows[0]!;

  await recordAuditEvent({
    organizationId,
    actorUserId,
    action: 'WEBHOOK_UPDATED',
    resourceType: 'webhook',
    resourceId: row.id,
    metadata: {
      name: row.name,
      isActive: row.is_active,
      events: row.events,
    },
  });

  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    url: row.url,
    secret: row.secret,
    events: row.events,
    isActive: row.is_active,
    lastDeliveryAt: row.last_delivery_at,
    lastStatusCode: row.last_status_code,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deleteWebhook(params: {
  id: string;
  organizationId: string;
  actorUserId: string;
}): Promise<boolean> {
  const { id, organizationId, actorUserId } = params;

  const res = await query<{ id: string; name: string }>(
    `
    DELETE FROM webhooks
    WHERE id = $1 AND organization_id = $2
    RETURNING id, name
    `,
    [id, organizationId]
  );

  const row = res.rows[0];
  if (!row) return false;

  await recordAuditEvent({
    organizationId,
    actorUserId,
    action: 'WEBHOOK_DELETED',
    resourceType: 'webhook',
    resourceId: row.id,
    metadata: { name: row.name },
  });

  return true;
}

export async function recordWebhookDelivery(params: {
  webhookId: string;
  organizationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  statusCode?: number | null;
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string | null;
}): Promise<WebhookDeliveryRecord> {
  const res = await query<{
    id: string;
    webhook_id: string;
    organization_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    status_code: number | null;
    response_time_ms: number;
    success: boolean;
    error_message: string | null;
    delivered_at: Date;
  }>(
    `
    INSERT INTO webhook_deliveries (
      webhook_id,
      organization_id,
      event_type,
      payload,
      status_code,
      response_time_ms,
      success,
      error_message
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      params.webhookId,
      params.organizationId,
      params.eventType,
      params.payload,
      params.statusCode ?? null,
      params.responseTimeMs,
      params.success,
      params.errorMessage ?? null,
    ]
  );

  // Update last delivery status on parent webhook
  query(
    `
    UPDATE webhooks
    SET last_delivery_at = NOW(), last_status_code = $1, updated_at = NOW()
    WHERE id = $2
    `,
    [params.statusCode ?? null, params.webhookId]
  ).catch(() => {});

  const row = res.rows[0]!;
  return {
    id: row.id,
    webhookId: row.webhook_id,
    organizationId: row.organization_id,
    eventType: row.event_type,
    payload: row.payload,
    statusCode: row.status_code,
    responseTimeMs: row.response_time_ms,
    success: row.success,
    errorMessage: row.error_message,
    deliveredAt: row.delivered_at,
  };
}

export async function getWebhookDeliveries(
  webhookId: string,
  organizationId: string,
  limit = 50
): Promise<WebhookDeliveryRecord[]> {
  const res = await query<{
    id: string;
    webhook_id: string;
    organization_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    status_code: number | null;
    response_time_ms: number;
    success: boolean;
    error_message: string | null;
    delivered_at: Date;
  }>(
    `
    SELECT *
    FROM webhook_deliveries
    WHERE webhook_id = $1 AND organization_id = $2
    ORDER BY delivered_at DESC
    LIMIT $3
    `,
    [webhookId, organizationId, limit]
  );

  return res.rows.map((row) => ({
    id: row.id,
    webhookId: row.webhook_id,
    organizationId: row.organization_id,
    eventType: row.event_type,
    payload: row.payload,
    statusCode: row.status_code,
    responseTimeMs: row.response_time_ms,
    success: row.success,
    errorMessage: row.error_message,
    deliveredAt: row.delivered_at,
  }));
}
