/** Bound actual bytes, including chunked bodies without Content-Length. */
export async function readTextBody(request: Request, maxBytes = 2 * 1024 * 1024): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw Object.assign(new Error('Request body exceeds the allowed size'), { statusCode: 413 });
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(body); }
  catch { throw Object.assign(new Error('Request body is not valid UTF-8'), { statusCode: 400 }); }
}

// Match Request.json's boundary type; each route validates its own input schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJsonBody(request: Request): Promise<any> {
  const body = await readTextBody(request);
  try {
    const parsed: unknown = body ? JSON.parse(body) : {};
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Object required');
    return parsed;
  }
  catch { throw Object.assign(new Error('Invalid JSON request body'), { statusCode: 400 }); }
}
