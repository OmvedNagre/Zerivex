import { describe, expect, it } from 'vitest';
import { readJsonBody, readTextBody } from '@/core/security/request-body';

describe('Actual request-byte limits', () => {
  it('rejects streamed payloads without a Content-Length header', async () => {
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(6)); controller.enqueue(new Uint8Array(6)); controller.close();
    } });
    const request = new Request('https://example.com', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
    await expect(readTextBody(request, 10)).rejects.toMatchObject({ statusCode: 413 });
  });

  it.each(['null', '[]', 'false', '{bad'])('rejects invalid or non-object JSON: %s', async (body) => {
    await expect(readJsonBody(new Request('https://example.com', { method: 'POST', body }))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('accepts a bounded object payload', async () => {
    expect(await readJsonBody(new Request('https://example.com', { method: 'POST', body: '{"scanMode":"PUBLIC_PASSIVE"}' })))
      .toEqual({ scanMode: 'PUBLIC_PASSIVE' });
  });
});
