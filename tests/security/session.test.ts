import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { query, closeDbPool } from '@/core/db/database';
import {
  createSession,
  validateSessionToken,
  revokeSession,
  revokeAllUserSessions,
  hashSessionToken,
} from '@/core/auth/session-service';
import { verifyCsrfProtection, ForbiddenError } from '@/core/rbac/authorization-guard';

describe('Server-Side Session Security & Revocation Controls', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const res = await query<{ id: string }>(
      "INSERT INTO users (email, display_name, role) VALUES ('session-tester@zerivex.local', 'Session Tester', 'USER') RETURNING id"
    );
    testUserId = res.rows[0]!.id;
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email = 'session-tester@zerivex.local'");
    await closeDbPool();
  });

  it('generates an opaque token and stores ONLY the SHA-256 hash in the database', async () => {
    const { rawToken, sessionId } = await createSession({
      userId: testUserId,
      ipAddress: '192.0.2.1',
      userAgent: 'ZerivexSecurityTestRunner/1.0',
    });

    expect(rawToken.length).toBe(64); // 32 bytes hex encoded = 64 chars

    // Inspect database directly to verify raw token is NOT in database
    const dbRow = await query<{ session_token_hash: string }>(
      'SELECT session_token_hash FROM sessions WHERE id = $1',
      [sessionId]
    );

    const storedHash = dbRow.rows[0]!.session_token_hash;
    expect(storedHash).not.toBe(rawToken);
    expect(storedHash).toBe(hashSessionToken(rawToken));
  });

  it('validates active session and rehydrates authenticated context', async () => {
    const { rawToken } = await createSession({ userId: testUserId });

    const context = await validateSessionToken(rawToken);
    expect(context).not.toBeNull();
    expect(context?.user.id).toBe(testUserId);
    expect(context?.user.email).toBe('session-tester@zerivex.local');
    expect(context?.user.role).toBe('USER');
  });

  it('rejects tampered, malformed, or non-existent session tokens', async () => {
    expect(await validateSessionToken('')).toBeNull();
    expect(await validateSessionToken('short-invalid-token')).toBeNull();
    expect(await validateSessionToken('a'.repeat(64))).toBeNull(); // Valid format, non-existent
  });

  it('revokes single session on sign out', async () => {
    const { rawToken } = await createSession({ userId: testUserId });

    // Validate active
    expect(await validateSessionToken(rawToken)).not.toBeNull();

    // Revoke
    const revoked = await revokeSession(rawToken);
    expect(revoked).toBe(true);

    // Validation must now fail
    expect(await validateSessionToken(rawToken)).toBeNull();
  });

  it('revokes all sessions on logout-all devices', async () => {
    // Create 3 sessions simulating phone, laptop, and tablet
    const session1 = await createSession({ userId: testUserId, deviceName: 'Phone' });
    const session2 = await createSession({ userId: testUserId, deviceName: 'Laptop' });
    const session3 = await createSession({ userId: testUserId, deviceName: 'Tablet' });

    expect(await validateSessionToken(session1.rawToken)).not.toBeNull();
    expect(await validateSessionToken(session2.rawToken)).not.toBeNull();
    expect(await validateSessionToken(session3.rawToken)).not.toBeNull();

    // Revoke all sessions
    const revokedCount = await revokeAllUserSessions(testUserId);
    expect(revokedCount).toBeGreaterThanOrEqual(3);

    // All sessions must now be rejected
    expect(await validateSessionToken(session1.rawToken)).toBeNull();
    expect(await validateSessionToken(session2.rawToken)).toBeNull();
    expect(await validateSessionToken(session3.rawToken)).toBeNull();
  });

  it('enforces CSRF validation on state-changing requests', () => {
    // Safe method GET is exempt
    const getReq = new NextRequest('http://localhost:3000/api/auth/session', { method: 'GET' });
    expect(() => verifyCsrfProtection(getReq)).not.toThrow();

    // POST without X-Requested-With or origin check MUST be rejected
    const unsafePostReq = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });
    expect(() => verifyCsrfProtection(unsafePostReq)).toThrow(ForbiddenError);

    // POST with custom X-Requested-With header MUST be permitted
    const safePostReq = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    expect(() => verifyCsrfProtection(safePostReq)).not.toThrow();
  });
});
