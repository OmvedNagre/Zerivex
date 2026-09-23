import crypto from 'crypto';
import { withTransaction } from '@/core/db/database';
import { getEnvConfig } from '@/core/config/env-validator';
import { handleOwnerBootstrap } from '@/core/auth/bootstrap-service';
import { createSession } from '@/core/auth/session-service';

export type OAuthProvider = 'google' | 'github' | 'mock';

export interface VerifiedOAuthProfile {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  isEmailVerified: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
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

/**
 * Generate OAuth Authorization URL for a provider.
 */
export function getOAuthAuthorizationUrl(
  provider: OAuthProvider,
  state: string,
  codeChallenge?: string
): string {
  const config = getEnvConfig();
  const redirectUri = `${config.NEXT_PUBLIC_APP_URL}/api/auth/callback/${provider}`;

  if (provider === 'google') {
    if (!config.GOOGLE_CLIENT_ID) {
      throw new Error('[ZERIVEX AUTH] GOOGLE_CLIENT_ID not configured');
    }
    const params = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });
    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (provider === 'github') {
    if (!config.GITHUB_CLIENT_ID) {
      throw new Error('[ZERIVEX AUTH] GITHUB_CLIENT_ID not configured');
    }
    const params = new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  if (provider === 'mock') {
    return `${config.NEXT_PUBLIC_APP_URL}/api/auth/mock-consent?state=${state}`;
  }

  throw new Error(`Unsupported OAuth provider: ${provider}`);
}

/**
 * Exchange code and extract verified profile from Google OIDC.
 */
export async function exchangeGoogleCode(
  code: string,
  codeVerifier?: string
): Promise<VerifiedOAuthProfile> {
  const config = getEnvConfig();
  const redirectUri = `${config.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`;

  const bodyParams: Record<string, string> = {
    client_id: config.GOOGLE_CLIENT_ID ?? '',
    client_secret: config.GOOGLE_CLIENT_SECRET ?? '',
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  };
  if (codeVerifier) {
    bodyParams.code_verifier = codeVerifier;
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(bodyParams),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: HTTP ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    throw new Error('Failed to retrieve userinfo from Google');
  }

  const profile = await userRes.json();

  return {
    provider: 'google',
    providerAccountId: String(profile.sub),
    email: profile.email,
    isEmailVerified: Boolean(profile.email_verified),
    displayName: profile.name ?? null,
    avatarUrl: profile.picture ?? null,
  };
}

/**
 * Exchange code and extract verified profile from GitHub OAuth.
 */
export async function exchangeGitHubCode(code: string): Promise<VerifiedOAuthProfile> {
  const config = getEnvConfig();
  const redirectUri = `${config.NEXT_PUBLIC_APP_URL}/api/auth/callback/github`;

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`GitHub token exchange failed: HTTP ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    throw new Error(tokenData.error_description || 'Missing access token from GitHub');
  }

  // Fetch basic user profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Zerivex-Auth',
    },
  });
  const user = await userRes.json();

  // Fetch emails to get verified primary email
  const emailsRes = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Zerivex-Auth',
    },
  });
  const emails: Array<{ email: string; primary: boolean; verified: boolean }> = await emailsRes.json();

  const primaryVerifiedEmail = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);

  if (!primaryVerifiedEmail) {
    throw new Error('GitHub account does not have an active verified email');
  }

  return {
    provider: 'github',
    providerAccountId: String(user.id),
    email: primaryVerifiedEmail.email,
    isEmailVerified: true,
    displayName: user.name ?? user.login,
    avatarUrl: user.avatar_url ?? null,
  };
}

/**
 * Handle verified OAuth profile: find or create User, link Identity,
 * execute owner bootstrap if applicable, and generate a secure server session.
 */
export async function authenticateWithOAuthProfile(
  profile: VerifiedOAuthProfile,
  metadata?: { ipAddress?: string | null; userAgent?: string | null }
): Promise<{ rawSessionToken: string; userId: string; role: string }> {
  if (!profile.isEmailVerified) {
    throw new Error('[ZERIVEX SECURITY ERROR] Cannot authenticate with an unverified email address');
  }

  const normalizedEmail = profile.email.trim().toLowerCase();

  // Step 1: Ensure user and identity exist in database (committed atomically)
  const { userId } = await withTransaction(async (client) => {
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
        'SELECT id FROM users WHERE email = $1',
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

    return { userId: resolvedUserId };
  });

  // Step 2: Attempt Owner Bootstrap (one-time atomic operation with row locking)
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
