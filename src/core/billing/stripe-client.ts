export async function stripeRequest(path: string, options: { method?: 'GET' | 'POST'; body?: URLSearchParams; idempotencyKey?: string } = {}): Promise<Record<string, any>> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith('sk_')) throw Object.assign(new Error('Stripe credentials are not configured'), { statusCode: 503 });
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: options.method || 'GET', signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': '2025-04-30.basil',
      ...(options.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}) },
    body: options.body?.toString(),
  });
  if (!response.ok) throw Object.assign(new Error(`Stripe request failed (HTTP ${response.status})`), { statusCode: 502 });
  return response.json();
}
