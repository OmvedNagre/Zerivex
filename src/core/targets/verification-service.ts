import dns from 'dns/promises';
import { query } from '@/core/db/database';
import { Target, getTargetById, VerificationMethod } from './target-service';
import { safeFetch } from '@/core/security/safe-http-client';
import { recordAuditEvent } from '@/core/audit/audit-service';

export interface VerificationResult {
  success: boolean;
  diagnostic: string;
  verifiedAt?: Date;
}

/**
 * Generate human-readable verification instructions for a target.
 */
export function getVerificationInstructions(target: Target): {
  method: VerificationMethod;
  token: string;
  dnsHost: string;
  dnsRecordValue: string;
  htmlMetaTag: string;
  httpHeaderName: string;
  httpHeaderValue: string;
} {
  const dnsHost = `_zerivex-challenge.${target.hostname}`;
  const dnsRecordValue = `zerivex-verification=${target.verificationToken}`;
  const htmlMetaTag = `<meta name="zerivex-verification" content="${target.verificationToken}">`;
  const httpHeaderName = 'X-Zerivex-Verification';
  const httpHeaderValue = target.verificationToken;

  return {
    method: target.verificationMethod,
    token: target.verificationToken,
    dnsHost,
    dnsRecordValue,
    htmlMetaTag,
    httpHeaderName,
    httpHeaderValue,
  };
}

/**
 * Perform DNS TXT verification check.
 */
async function verifyViaDnsTxt(hostname: string, token: string): Promise<{ success: boolean; diagnostic: string }> {
  const challengeHost = `_zerivex-challenge.${hostname}`;

  try {
    const records = await dns.resolveTxt(challengeHost);
    const flatRecords = records.map((entry) => entry.join(''));

    for (const record of flatRecords) {
      const trimmed = record.trim();
      if (trimmed === token || trimmed === `zerivex-verification=${token}`) {
        return { success: true, diagnostic: `DNS TXT record verified at "${challengeHost}"` };
      }
    }

    return {
      success: false,
      diagnostic: `DNS TXT record found at "${challengeHost}", but token did not match expected value.`,
    };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN') {
      return {
        success: false,
        diagnostic: `DNS TXT record was not found at "${challengeHost}". Please verify DNS propagation.`,
      };
    }
    return {
      success: false,
      diagnostic: `DNS resolution failed: ${(err as Error).message}`,
    };
  }
}

/**
 * Perform HTML Meta Tag verification check via SSRF-safe HTTP client.
 */
async function verifyViaHtmlMeta(targetUrl: string, token: string): Promise<{ success: boolean; diagnostic: string }> {
  try {
    const response = await safeFetch(targetUrl, {
      method: 'GET',
      timeoutMs: 12000,
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });

    if (response.statusCode < 200 || response.statusCode >= 400) {
      return {
        success: false,
        diagnostic: `Target URL returned HTTP ${response.statusCode} while checking for meta tag.`,
      };
    }

    // Regex parsing for <meta name="zerivex-verification" content="<token>"> in either attribute order
    const metaRegex1 = new RegExp(
      `<meta\\s+[^>]*name=["']zerivex-verification["'][^>]*content=["']${token}["']`,
      'i'
    );
    const metaRegex2 = new RegExp(
      `<meta\\s+[^>]*content=["']${token}["'][^>]*name=["']zerivex-verification["']`,
      'i'
    );

    if (metaRegex1.test(response.body) || metaRegex2.test(response.body)) {
      return { success: true, diagnostic: `Verified HTML meta tag in response from "${targetUrl}"` };
    }

    return {
      success: false,
      diagnostic: `HTML response from "${targetUrl}" did not contain <meta name="zerivex-verification" content="${token}">.`,
    };
  } catch (err) {
    return {
      success: false,
      diagnostic: `Failed to inspect HTML meta tag: ${(err as Error).message}`,
    };
  }
}

/**
 * Perform HTTP Header verification check via SSRF-safe HTTP client.
 */
async function verifyViaHttpHeader(targetUrl: string, token: string): Promise<{ success: boolean; diagnostic: string }> {
  try {
    const response = await safeFetch(targetUrl, {
      method: 'GET',
      timeoutMs: 12000,
    });

    const headerVal = response.headers['x-zerivex-verification'];
    const stringHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;

    if (stringHeader && stringHeader.trim() === token) {
      return { success: true, diagnostic: `Verified X-Zerivex-Verification header from "${targetUrl}"` };
    }

    return {
      success: false,
      diagnostic: `HTTP response from "${targetUrl}" did not include header "X-Zerivex-Verification: ${token}".`,
    };
  } catch (err) {
    return {
      success: false,
      diagnostic: `Failed to inspect HTTP response headers: ${(err as Error).message}`,
    };
  }
}

/**
 * Execute domain verification check for a target.
 * Updates target state and records verification history if successful.
 */
export async function verifyTarget(params: {
  targetId: string;
  organizationId: string;
  actorUserId?: string;
  preferredMethod?: VerificationMethod;
}): Promise<VerificationResult> {
  const target = await getTargetById(params.targetId, params.organizationId);
  const method = params.preferredMethod ?? target.verificationMethod;

  let checkResult: { success: boolean; diagnostic: string };

  switch (method) {
    case 'DNS_TXT':
      checkResult = await verifyViaDnsTxt(target.hostname, target.verificationToken);
      break;
    case 'HTML_META':
      checkResult = await verifyViaHtmlMeta(target.targetUrl, target.verificationToken);
      break;
    case 'HTTP_HEADER':
      checkResult = await verifyViaHttpHeader(target.targetUrl, target.verificationToken);
      break;
    default:
      checkResult = { success: false, diagnostic: `Unsupported verification method: ${method}` };
  }

  if (checkResult.success) {
    const now = new Date();

    // Update target status to VERIFIED
    await query(
      `
      UPDATE targets
      SET 
        verification_status = 'VERIFIED',
        verification_method = $1,
        verified_at = $2,
        updated_at = NOW()
      WHERE id = $3 AND organization_id = $4
      `,
      [method, now, target.id, params.organizationId]
    );

    // Record verification record in domain_verifications
    await query(
      `
      INSERT INTO domain_verifications (
        target_id,
        token,
        method,
        expires_at,
        verified_at
      )
      VALUES ($1, $2, $3, NOW() + INTERVAL '1 year', $4)
      `,
      [target.id, target.verificationToken, method, now]
    );

    // Record audit event
    await recordAuditEvent({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId ?? null,
      action: 'TARGET_VERIFIED',
      resourceType: 'target',
      resourceId: target.id,
      metadata: {
        method,
        diagnostic: checkResult.diagnostic,
        verifiedAt: now.toISOString(),
      },
    });

    return {
      success: true,
      diagnostic: checkResult.diagnostic,
      verifiedAt: now,
    };
  }

  return {
    success: false,
    diagnostic: checkResult.diagnostic,
  };
}

/**
 * Critical authorization guard: Prevents active/intrusive scanning against unverified targets.
 * Fails closed immediately if target is not verified.
 */
export async function assertTargetScanAuthorization(
  targetId: string,
  organizationId: string,
  scanMode: 'PUBLIC_PASSIVE' | 'VERIFIED_ACTIVE'
): Promise<Target> {
  const target = await getTargetById(targetId, organizationId);

  if (scanMode === 'VERIFIED_ACTIVE') {
    if (target.verificationStatus !== 'VERIFIED') {
      throw new Error(
        `[ZERIVEX CRITICAL SECURITY] Target ownership must be verified before performing active intrusive scanning. Current verification status is "${target.verificationStatus}". Complete verification via DNS TXT, HTML Meta tag, or HTTP response header before launching an active scan.`
      );
    }
  }

  return target;
}
