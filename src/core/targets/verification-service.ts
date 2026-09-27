import dns, { Resolver } from 'dns/promises';
import { query } from '@/core/db/database';
import { Target, getTargetById, VerificationMethod } from './target-service';
import { safeFetch } from '@/core/security/safe-http-client';
import { recordAuditEvent } from '@/core/audit/audit-service';

export interface VerificationResult {
  success: boolean;
  diagnostic: string;
  verifiedAt?: Date;
}

export interface VerificationInstructions {
  method: VerificationMethod;
  token: string;
  dnsHost: string;
  dnsHostShort: string;
  dnsApexHost: string;
  apexDomain: string;
  dnsRecordValue: string;
  dnsRecordValuePlain: string;
  htmlMetaTag: string;
  httpHeaderName: string;
  httpHeaderValue: string;
  fileUrl: string;
  fileContent: string;
}

/**
 * Extract the registered/apex domain from a hostname.
 * Handles common two-part TLDs (co.uk, com.au, org.in, etc.) as well as standard TLDs.
 */
export function extractApexDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return hostname.toLowerCase();

  const twoPartSuffixes = new Set([
    'co.uk', 'org.uk', 'gov.uk', 'ac.uk',
    'com.au', 'net.au', 'org.au', 'edu.au',
    'co.in', 'net.in', 'org.in', 'gen.in', 'ind.in',
    'co.nz', 'net.nz', 'org.nz',
    'co.jp', 'ne.jp', 'or.jp',
    'com.br', 'org.br',
    'co.za', 'org.za',
  ]);

  if (parts.length >= 3) {
    const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (twoPartSuffixes.has(lastTwo)) {
      return `${parts[parts.length - 3]}.${lastTwo}`;
    }
  }

  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

/**
 * Get all candidate DNS hostnames where the challenge TXT record might be published.
 */
export function getDnsChallengeCandidates(hostname: string, apexDomain: string): string[] {
  const candidates: string[] = [];
  const cleanHost = hostname.toLowerCase();
  const cleanApex = apexDomain.toLowerCase();

  // 1. Standard challenge host for the specific hostname (e.g. _zerivex-challenge.www.omved.live)
  candidates.push(`_zerivex-challenge.${cleanHost}`);

  // 2. Apex domain challenge host (e.g. _zerivex-challenge.omved.live)
  if (cleanHost !== cleanApex) {
    candidates.push(`_zerivex-challenge.${cleanApex}`);
    // 3. Duplicate domain append fallback (e.g. if DNS panel appends root domain automatically)
    candidates.push(`_zerivex-challenge.${cleanHost}.${cleanApex}`);
  }

  // 4. TXT record directly placed on hostname or apex domain
  candidates.push(cleanHost);
  if (cleanHost !== cleanApex) {
    candidates.push(cleanApex);
  }

  return Array.from(new Set(candidates));
}

/**
 * Generate human-readable verification instructions for a target.
 */
export function getVerificationInstructions(target: Target): VerificationInstructions {
  const apexDomain = extractApexDomain(target.hostname);
  const dnsHost = `_zerivex-challenge.${target.hostname}`;
  const dnsApexHost = `_zerivex-challenge.${apexDomain}`;

  // Short host for modern DNS dashboards (Vercel, Cloudflare, Route53, GoDaddy)
  const dnsHostShort =
    target.hostname.toLowerCase() === apexDomain
      ? '_zerivex-challenge'
      : `_zerivex-challenge.${target.hostname.replace(`.${apexDomain}`, '')}`;

  const dnsRecordValue = `zerivex-verification=${target.verificationToken}`;
  const dnsRecordValuePlain = target.verificationToken;
  const htmlMetaTag = `<meta name="zerivex-verification" content="${target.verificationToken}">`;
  const httpHeaderName = 'X-Zerivex-Verification';
  const httpHeaderValue = target.verificationToken;
  const baseUrl = target.targetUrl.replace(/\/+$/, '');
  const fileUrl = `${baseUrl}/.well-known/zerivex-verification.txt`;
  const fileContent = `zerivex-verification=${target.verificationToken}`;

  return {
    method: target.verificationMethod,
    token: target.verificationToken,
    dnsHost,
    dnsHostShort,
    dnsApexHost,
    apexDomain,
    dnsRecordValue,
    dnsRecordValuePlain,
    htmlMetaTag,
    httpHeaderName,
    httpHeaderValue,
    fileUrl,
    fileContent,
  };
}

/**
 * Perform DNS TXT verification check.
 * Checks candidate hostnames against public resolvers (8.8.8.8, 1.1.1.1) to avoid local caching,
 * with graceful fallback to system DNS.
 */
async function verifyViaDnsTxt(hostname: string, token: string): Promise<{ success: boolean; diagnostic: string }> {
  const apexDomain = extractApexDomain(hostname);
  const candidates = getDnsChallengeCandidates(hostname, apexDomain);

  let publicResolver: Resolver | null = null;
  try {
    publicResolver = new Resolver();
    publicResolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1']);
  } catch {
    publicResolver = null;
  }

  let foundRecordsAt: string | null = null;

  for (const candidateHost of candidates) {
    let rawRecords: string[][] = [];

    // 1. Try public resolver first to bypass local cache
    if (publicResolver) {
      try {
        rawRecords = await publicResolver.resolveTxt(candidateHost);
      } catch {
        // Fall back to system resolver
      }
    }

    // 2. Fall back to system resolver if public lookup failed or had no records
    if (!rawRecords || rawRecords.length === 0) {
      try {
        rawRecords = await dns.resolveTxt(candidateHost);
      } catch {
        rawRecords = [];
      }
    }

    if (rawRecords && rawRecords.length > 0) {
      foundRecordsAt = candidateHost;
      const flatRecords = rawRecords.map((entry) => entry.join(''));

      for (const record of flatRecords) {
        const cleaned = record.replace(/^"|"$/g, '').trim();
        if (
          cleaned === token ||
          cleaned === `zerivex-verification=${token}` ||
          cleaned.includes(`zerivex-verification=${token}`) ||
          cleaned.includes(token)
        ) {
          return {
            success: true,
            diagnostic: `DNS TXT record verified at "${candidateHost}"`,
          };
        }
      }
    }
  }

  if (foundRecordsAt) {
    return {
      success: false,
      diagnostic: `DNS TXT record found at "${foundRecordsAt}", but token did not match expected value.`,
    };
  }

  return {
    success: false,
    diagnostic: `DNS TXT record was not found at "_zerivex-challenge.${hostname}". Please verify DNS propagation.`,
  };
}

/**
 * Perform HTTP /.well-known/ file verification check via SSRF-safe HTTP client.
 */
async function verifyViaHttpFile(targetUrl: string, token: string): Promise<{ success: boolean; diagnostic: string }> {
  const baseUrl = targetUrl.replace(/\/+$/, '');
  const verificationFileUrl = `${baseUrl}/.well-known/zerivex-verification.txt`;

  try {
    const response = await safeFetch(verificationFileUrl, {
      method: 'GET',
      timeoutMs: 12000,
      headers: { Accept: 'text/plain,*/*' },
    });

    if (response.statusCode >= 200 && response.statusCode < 400) {
      const body = response.body.trim();
      if (
        body === token ||
        body === `zerivex-verification=${token}` ||
        body.includes(token)
      ) {
        return {
          success: true,
          diagnostic: `Verified file at "${verificationFileUrl}"`,
        };
      }
    }

    return {
      success: false,
      diagnostic: `HTTP response from "${verificationFileUrl}" did not contain verification token.`,
    };
  } catch (err) {
    return {
      success: false,
      diagnostic: `Failed to inspect verification file at "${verificationFileUrl}": ${(err as Error).message}`,
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
  preferredMethod?: VerificationMethod | 'MANUAL_BYPASS' | 'HTTP_FILE';
  bypass?: boolean;
}): Promise<VerificationResult> {
  const target = await getTargetById(params.targetId, params.organizationId);

  // Platform Owner / Development Sandbox instant verification bypass
  if (params.bypass || params.preferredMethod === 'MANUAL_BYPASS') {
    const now = new Date();
    const effectiveMethod: VerificationMethod = target.verificationMethod || 'DNS_TXT';

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
      [effectiveMethod, now, target.id, params.organizationId]
    );

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
      [target.id, target.verificationToken, effectiveMethod, now]
    );

    await recordAuditEvent({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId ?? null,
      action: 'TARGET_VERIFIED',
      resourceType: 'target',
      resourceId: target.id,
      metadata: {
        method: 'MANUAL_BYPASS',
        diagnostic: 'Domain ownership verified instantly via Platform Owner / Sandbox authorization.',
        verifiedAt: now.toISOString(),
      },
    });

    return {
      success: true,
      diagnostic: 'Domain ownership verified instantly via Platform Owner / Sandbox authorization.',
      verifiedAt: now,
    };
  }

  const method = (params.preferredMethod as VerificationMethod) ?? target.verificationMethod;
  let checkResult: { success: boolean; diagnostic: string };

  switch (method) {
    case 'DNS_TXT':
      checkResult = await verifyViaDnsTxt(target.hostname, target.verificationToken);
      // Auto-fallback: If DNS hasn't propagated yet, check if /.well-known/zerivex-verification.txt exists
      if (!checkResult.success) {
        const fileCheck = await verifyViaHttpFile(target.targetUrl, target.verificationToken);
        if (fileCheck.success) {
          checkResult = fileCheck;
        }
      }
      break;
    case 'HTML_META':
      checkResult = await verifyViaHtmlMeta(target.targetUrl, target.verificationToken);
      if (!checkResult.success) {
        const fileCheck = await verifyViaHttpFile(target.targetUrl, target.verificationToken);
        if (fileCheck.success) {
          checkResult = fileCheck;
        }
      }
      break;
    case 'HTTP_HEADER':
      checkResult = await verifyViaHttpHeader(target.targetUrl, target.verificationToken);
      if (!checkResult.success) {
        const fileCheck = await verifyViaHttpFile(target.targetUrl, target.verificationToken);
        if (fileCheck.success) {
          checkResult = fileCheck;
        }
      }
      break;
    default:
      checkResult = { success: false, diagnostic: `Unsupported verification method: ${method}` };
  }

  if (checkResult.success) {
    const now = new Date();
    // Maintain DB constraint by using target's method or DNS_TXT
    const dbMethod: VerificationMethod =
      method === 'DNS_TXT' || method === 'HTML_META' || method === 'HTTP_HEADER'
        ? method
        : target.verificationMethod || 'DNS_TXT';

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
      [dbMethod, now, target.id, params.organizationId]
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
      [target.id, target.verificationToken, dbMethod, now]
    );

    // Record audit event
    await recordAuditEvent({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId ?? null,
      action: 'TARGET_VERIFIED',
      resourceType: 'target',
      resourceId: target.id,
      metadata: {
        method: dbMethod,
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
