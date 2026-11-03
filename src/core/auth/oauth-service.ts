import crypto from 'crypto';
import { authorizationUrl, providerProfile } from './oauth-providers';
import { isOAuthProvider } from './oauth-config';
import { withTransaction } from '@/core/db/database';
import { handleOwnerBootstrap } from '@/core/auth/bootstrap-service';
import { createSession } from '@/core/auth/session-service';

export type OAuthProvider = 'google' | 'github';

export interface VerifiedOAuthProfile {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  isEmailVerified: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
  hostedDomain?: string | null;
}

/**
 * Generate PKCE code_verifier and code_challenge (S256).
 */
export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

/**
 * Generate a cryptographically random state token to defend against OAuth CSRF.
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(24).toString('hex');
}

/** Provider exchange implementation is shared; these exports retain existing integrations. */
export function getOAuthAuthorizationUrl(provider:OAuthProvider,state:string,challenge?:string,callback?:string){return authorizationUrl(provider,state,challenge,callback);}
export function exchangeGoogleCode(code:string,verifier?:string,callback?:string){return providerProfile('google',code,verifier,callback);}
export function exchangeGitHubCode(code:string,verifier?:string,callback?:string){return providerProfile('github',code,verifier,callback);}

/**
 * Handle verified OAuth profile: find or create User, link Identity,
 * preserve explicit platform roles, and generate a secure server session.
 */
export async function authenticateWithOAuthProfile(
  profile: VerifiedOAuthProfile,
  metadata?: { ipAddress?: string | null; userAgent?: string | null }
): Promise<{ rawSessionToken: string; userId: string; role: string }> {
  if (profile.isEmailVerified !== true) {
    throw new Error('[ZERIVEX SECURITY ERROR] Cannot authenticate with an unverified email address');
  }

  if (!isOAuthProvider(profile.provider) || !profile.providerAccountId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) throw new Error('Invalid verified OAuth identity');
  const normalizedEmail = profile.email.trim().toLowerCase();

  // Step 1: Ensure user and identity exist in database (committed atomically)
  const { userId } = await withTransaction(async (client) => {
    // Serialize first sign-ins for the same provider identity and verified email.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`oauth-identity:${profile.provider}:${profile.providerAccountId}`]);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`oauth-email:${normalizedEmail}`]);
    // Check if identity already exists
    const identityRes = await client.query<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM identities WHERE provider = $1 AND provider_account_id = $2',
      [profile.provider, profile.providerAccountId]
    );

    let resolvedUserId: string;

    if (identityRes.rows.length > 0) {
      resolvedUserId = identityRes.rows[0]!.user_id;
    } else {
      // Check if a user with this verified email already exists
      const existingUserRes = await client.query<{ id: string }>(
        'SELECT id FROM users WHERE LOWER(email) = $1',
        [normalizedEmail]
      );

      if (existingUserRes.rows.length > 0) {
        resolvedUserId = existingUserRes.rows[0]!.id;
      } else {
        // Create new user
        const newUserRes = await client.query<{ id: string }>(
          `
          INSERT INTO users (email, email_verified_at, display_name, avatar_url, role, status)
          VALUES ($1, NOW(), $2, $3, 'USER', 'ACTIVE')
          RETURNING id
          `,
          [normalizedEmail, profile.displayName ?? null, profile.avatarUrl ?? null]
        );
        resolvedUserId = newUserRes.rows[0]!.id;
      }

      // Link Identity
      await client.query(
        `
        INSERT INTO identities (user_id, provider, provider_account_id, provider_email, is_verified)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (provider, provider_account_id) DO NOTHING
        `,
        [resolvedUserId, profile.provider, profile.providerAccountId, normalizedEmail]
      );
    }

    const account = await client.query<{status:string}>('SELECT status FROM users WHERE id=$1 FOR UPDATE',[resolvedUserId]);
    if(account.rows[0]?.status !== 'ACTIVE') throw new Error('Account is not active');
    return { userId: resolvedUserId };
  });

  // Preserve explicit existing platform role; sign-in never grants owner access.
  const role = await handleOwnerBootstrap({
    userId,
    email: normalizedEmail,
    isVerified: profile.isEmailVerified,
    displayName: profile.displayName,
  });

  // Step 3: Create secure server-side session for the committed user
  const { rawToken } = await createSession({
    userId,
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent,
  });

  return { rawSessionToken: rawToken, userId, role };
}
