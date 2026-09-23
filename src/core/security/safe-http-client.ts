import http from 'http';
import https from 'https';
import dns from 'dns/promises';
import net from 'net';
import { isProhibitedHostname, isProhibitedIpAddress } from './ip-validator';

export class SecuritySSRFError extends Error {
  constructor(message: string) {
    super(`[ZERIVEX SSRF DEFENSE] ${message}`);
    this.name = 'SecuritySSRFError';
  }
}

export interface SafeHttpResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  finalUrl: string;
  pinnedIp: string;
}

export interface SafeFetchOptions {
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'TRACE' | 'PATCH' | string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxRedirects?: number;
  followRedirects?: boolean;
  maxBodyBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

/**
 * Validate URL structure, protocol allowlist, and port bounds.
 */
export function validateTargetUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SecuritySSRFError(`Invalid URL format: "${rawUrl}"`);
  }

  // 1. Protocol Allowlist
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SecuritySSRFError(
      `Disallowed protocol "${parsed.protocol}". Only "http:" and "https:" are permitted.`
    );
  }

  // 2. Reject credentials in URL
  if (parsed.username || parsed.password) {
    throw new SecuritySSRFError('URL contains embedded user credentials, which is forbidden');
  }

  // 3. Port check
  const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    throw new SecuritySSRFError(
      `Port ${port} is not permitted. Only standard web ports (80, 443, 8080, 8443) are allowed.`
    );
  }

  // 4. Hostname check
  const hostCheck = isProhibitedHostname(parsed.hostname);
  if (hostCheck.prohibited) {
    throw new SecuritySSRFError(hostCheck.reason || 'Prohibited hostname');
  }

  return parsed;
}

/**
 * Perform pre-flight DNS resolution and validate all resolved IPs against CIDR blacklists.
 * Returns the first verified safe IP for socket pinning.
 */
export async function resolveAndValidateIp(hostname: string): Promise<string> {
  // If hostname is already a raw IP
  if (net.isIP(hostname)) {
    const check = isProhibitedIpAddress(hostname);
    if (check.prohibited) {
      throw new SecuritySSRFError(`Direct IP connection rejected: ${check.reason}`);
    }
    return hostname;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (err) {
    throw new SecuritySSRFError(`DNS resolution failed for host "${hostname}": ${(err as Error).message}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new SecuritySSRFError(`DNS resolution returned zero records for host "${hostname}"`);
  }

  // Verify EVERY resolved IP address to prevent mixed safe/unsafe round-robin DNS attacks
  for (const record of addresses) {
    const check = isProhibitedIpAddress(record.address);
    if (check.prohibited) {
      throw new SecuritySSRFError(
        `Host "${hostname}" resolved to prohibited IP ${record.address}: ${check.reason}`
      );
    }
  }

  return addresses[0]!.address;
}

/**
 * Execute an SSRF-protected HTTP request with pre-flight DNS validation,
 * socket IP pinning, and verified chained redirect resolution.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeHttpResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const method = options.method ?? 'GET';

  let currentUrl = validateTargetUrl(rawUrl);
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const pinnedIp = await resolveAndValidateIp(currentUrl.hostname);
    const isHttps = currentUrl.protocol === 'https:';
    const port = currentUrl.port
      ? parseInt(currentUrl.port, 10)
      : isHttps
      ? 443
      : 80;

    // Custom agent with custom lookup pinning the exact pre-validated IP
    const customLookup: http.AgentOptions['lookup'] = (_hostname, _opts, callback) => {
      callback(null, pinnedIp, net.isIPv6(pinnedIp) ? 6 : 4);
    };

    const agent = isHttps
      ? new https.Agent({ lookup: customLookup, servername: currentUrl.hostname })
      : new http.Agent({ lookup: customLookup });

    const response = await new Promise<SafeHttpResponse>((resolve, reject) => {
      const reqModule = isHttps ? https : http;

      const reqHeaders = {
        'User-Agent': 'Zerivex-Security-Scanner/1.0 (+https://zerivex.com)',
        Host: currentUrl.host,
        Accept: '*/*',
        ...(options.headers ?? {}),
      };

      const request = reqModule.request(
        {
          method,
          protocol: currentUrl.protocol,
          hostname: currentUrl.hostname,
          port,
          path: `${currentUrl.pathname}${currentUrl.search}`,
          headers: reqHeaders,
          agent,
          timeout: timeoutMs,
        },
        (res) => {
          let receivedBytes = 0;
          const chunks: Buffer[] = [];

          res.on('data', (chunk: Buffer) => {
            receivedBytes += chunk.length;
            if (receivedBytes > maxBodyBytes) {
              request.destroy();
              reject(new SecuritySSRFError(`Response body exceeded max limit of ${maxBodyBytes} bytes`));
              return;
            }
            chunks.push(chunk);
          });

          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8');
            resolve({
              statusCode: res.statusCode ?? 500,
              headers: res.headers,
              body,
              finalUrl: currentUrl.toString(),
              pinnedIp,
            });
          });

          res.on('error', (err) => {
            reject(err);
          });
        }
      );

      request.on('timeout', () => {
        request.destroy();
        reject(new SecuritySSRFError(`Request timed out after ${timeoutMs}ms`));
      });

      request.on('error', (err) => {
        reject(err);
      });

      if (options.body) {
        request.write(options.body);
      }

      request.end();
    });

    // If followRedirects is explicitly disabled, return immediately
    if (options.followRedirects === false) {
      return response;
    }

    // Check for redirects (301, 302, 303, 307, 308)
    const status = response.statusCode;
    if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new SecuritySSRFError(`Exceeded maximum redirect limit of ${maxRedirects}`);
      }

      // Re-validate target URL on redirect
      const nextLocation = new URL(response.headers.location, currentUrl).toString();
      currentUrl = validateTargetUrl(nextLocation);
      continue;
    }

    return response;
  }

  throw new SecuritySSRFError('Exceeded redirect loop limit');
}
