import dns from 'dns/promises';
import net from 'net';
import { isProhibitedHostname, isProhibitedIpAddress } from './ip-validator';

export { isProhibitedHostname, isProhibitedIpAddress } from './ip-validator';

/**
 * Custom error thrown when outbound network traffic violates egress firewall policy.
 */
export class EgressBlockedError extends Error {
  public readonly code = 'EGRESS_POLICY_VIOLATION';
  public readonly targetUrl: string;
  public readonly reason: string;

  constructor(targetUrl: string, reason: string) {
    super(`Egress Blocked: ${reason} (Target: ${targetUrl})`);
    this.name = 'EgressBlockedError';
    this.targetUrl = targetUrl;
    this.reason = reason;
  }
}

export interface EgressValidationResult {
  allowed: boolean;
  reason?: string;
  normalizedUrl?: string;
  resolvedIps?: string[];
}

export interface EgressFirewallOptions {
  allowedProtocols?: string[];
  blockPrivateIps?: boolean;
  blockLocalhost?: boolean;
  blockCloudMetadata?: boolean;
  dnsTimeoutMs?: number;
}

const DEFAULT_ALLOWED_PROTOCOLS = ['http:', 'https:'];
const DEFAULT_DNS_TIMEOUT_MS = 5000;

/**
 * Production Network Egress Security Firewall (Phase 14)
 *
 * Enforces strict outbound network policies to defend against:
 * 1. Server-Side Request Forgery (SSRF)
 * 2. DNS rebinding / Multi-A-record masking attacks
 * 3. LAN & Internal service probing (Redis, PostgreSQL, Docker, K8s)
 * 4. Cloud Metadata exfiltration (AWS IMDSv1/v2, GCP, Azure metadata endpoints)
 * 5. Non-HTTP protocol abuse (file://, gopher://, dict://, ldap://)
 */
export class EgressFirewall {
  private allowedProtocols: Set<string>;
  private blockPrivateIps: boolean;
  private blockLocalhost: boolean;
  private dnsTimeoutMs: number;

  constructor(options: EgressFirewallOptions = {}) {
    this.allowedProtocols = new Set(options.allowedProtocols || DEFAULT_ALLOWED_PROTOCOLS);
    this.blockPrivateIps = options.blockPrivateIps ?? true;
    this.blockLocalhost = options.blockLocalhost ?? true;
    this.dnsTimeoutMs = options.dnsTimeoutMs ?? DEFAULT_DNS_TIMEOUT_MS;
  }

  /**
   * Validate a target URL against outbound network egress rules.
   * Performs protocol inspection, hostname checks, and pre-flight multi-A/AAAA DNS evaluation.
   */
  public async validateUrl(rawUrl: string): Promise<EgressValidationResult> {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { allowed: false, reason: 'URL must be a non-empty string' };
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      return { allowed: false, reason: 'Malformed URL structure' };
    }

    // 1. Protocol Whitelist Enforcement
    const protocol = parsed.protocol.toLowerCase();
    if (!this.allowedProtocols.has(protocol)) {
      return {
        allowed: false,
        reason: `Disallowed protocol "${protocol}". Only ${Array.from(this.allowedProtocols).join(', ')} are permitted.`,
      };
    }

    // 2. Hostname Validation
    const rawHostname = parsed.hostname.toLowerCase();
    if (!rawHostname) {
      return { allowed: false, reason: 'Missing hostname in target URL' };
    }
    // Strip IPv6 brackets if present (e.g. "[::1]" -> "::1")
    const hostname = rawHostname.replace(/^\[|\]$/g, '');

    if (this.blockLocalhost) {
      const hostCheck = isProhibitedHostname(hostname);
      if (hostCheck.prohibited) {
        return {
          allowed: false,
          reason: `Restricted hostname: ${hostCheck.reason}`,
        };
      }
    }

    // 3. Direct IP Address Validation
    if (net.isIP(hostname)) {
      const ipCheck = isProhibitedIpAddress(hostname);
      if (ipCheck.prohibited) {
        return {
          allowed: false,
          reason: `Restricted direct IP address: ${ipCheck.reason}`,
        };
      }
    }

    // 4. Pre-Flight DNS Resolution (All Records)
    try {
      const dnsPromise = dns.lookup(hostname, { all: true });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DNS resolution timeout')), this.dnsTimeoutMs)
      );

      const records = (await Promise.race([dnsPromise, timeoutPromise])) as Array<{
        address: string;
        family: number;
      }>;

      if (!records || records.length === 0) {
        return { allowed: false, reason: 'Hostname resolved to zero IP addresses' };
      }

      const resolvedIps = records.map((r) => r.address);

      // Verify EVERY resolved IP address to prevent multi-record SSRF masking
      if (this.blockPrivateIps) {
        for (const record of records) {
          const check = isProhibitedIpAddress(record.address);
          if (check.prohibited) {
            return {
              allowed: false,
              reason: `Resolved IP address ${record.address} violates egress policy (${check.reason})`,
              resolvedIps,
            };
          }
        }
      }

      return {
        allowed: true,
        normalizedUrl: parsed.toString(),
        resolvedIps,
      };
    } catch (err: any) {
      return {
        allowed: false,
        reason: `DNS resolution failed: ${err.message || 'unknown error'}`,
      };
    }
  }

  /**
   * Assert that a target URL is permitted under egress policy.
   * Throws EgressBlockedError if the request is prohibited.
   */
  public async assertAllowed(targetUrl: string): Promise<string[]> {
    const result = await this.validateUrl(targetUrl);
    if (!result.allowed) {
      throw new EgressBlockedError(targetUrl, result.reason || 'Unknown egress restriction');
    }
    return result.resolvedIps || [];
  }
}

// Default singleton instance configured for production hardening
export const defaultEgressFirewall = new EgressFirewall();

/**
 * Convenience helper to validate egress for a target URL.
 */
export async function assertEgressAllowed(url: string): Promise<string[]> {
  return defaultEgressFirewall.assertAllowed(url);
}

/**
 * Convenience helper to check if a URL is permitted.
 */
export async function validateEgressTarget(url: string): Promise<EgressValidationResult> {
  return defaultEgressFirewall.validateUrl(url);
}
