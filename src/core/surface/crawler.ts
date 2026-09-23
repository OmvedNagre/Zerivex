import { safeFetch, SafeHttpResponse } from '@/core/security/safe-http-client';
import { activeRateLimiter, circuitBreaker } from '@/core/scanner/active-rate-limiter';
import { detectTechnologies } from './tech-detector';
import {
  DiscoveredEndpoint,
  AttackSurfaceResult,
  CrawlOptions,
  DiscoverySource,
  EndpointParameter,
  HttpMethod,
} from './types';

const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.pdf', '.mp4', '.avi', '.mov', '.zip', '.tar', '.gz',
  '.woff', '.woff2', '.ttf', '.eot', '.otf', '.css',
]);

const COMMON_DISCOVERY_PATHS = [
  { path: '/robots.txt', source: 'ROBOTS_TXT' as DiscoverySource },
  { path: '/sitemap.xml', source: 'SITEMAP' as DiscoverySource },
  { path: '/.well-known/security.txt', source: 'API_DISCOVERY' as DiscoverySource },
  { path: '/openapi.json', source: 'SPEC_OPENAPI' as DiscoverySource },
  { path: '/swagger.json', source: 'SPEC_OPENAPI' as DiscoverySource },
  { path: '/api-docs', source: 'SPEC_OPENAPI' as DiscoverySource },
  { path: '/api/health', source: 'API_DISCOVERY' as DiscoverySource },
  { path: '/health', source: 'API_DISCOVERY' as DiscoverySource },
  { path: '/metrics', source: 'API_DISCOVERY' as DiscoverySource },
  { path: '/graphql', source: 'API_DISCOVERY' as DiscoverySource },
];

/**
 * Normalizes a URL and extracts its query parameters.
 */
function parseUrlParameters(urlObj: URL): EndpointParameter[] {
  const params: EndpointParameter[] = [];
  urlObj.searchParams.forEach((val, key) => {
    params.push({
      name: key,
      in: 'query',
      sampleValue: val.substring(0, 100),
    });
  });
  return params;
}

/**
 * Clean path without fragment or query string.
 */
function cleanPath(urlObj: URL): string {
  return urlObj.pathname || '/';
}

/**
 * Checks if path has an asset extension that should not be crawled for HTML links.
 */
function isStaticAsset(path: string): boolean {
  const dotIndex = path.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const ext = path.substring(dotIndex).toLowerCase();
  return IGNORED_EXTENSIONS.has(ext);
}

/**
 * Extract HTML links (<a href="...">, <script src="...">).
 */
function extractHtmlLinks(html: string, currentUrl: URL, targetHostname: string): string[] {
  const discovered: string[] = [];
  const hrefRegex = /<a\s+[^>]*href=["']([^"'#\s>]+)["']/gi;
  const scriptRegex = /<script\s+[^>]*src=["']([^"'#\s>]+)["']/gi;

  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw || raw.startsWith('javascript:') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('data:')) {
      continue;
    }
    try {
      const resolved = new URL(raw, currentUrl);
      if (resolved.hostname === targetHostname && (resolved.protocol === 'http:' || resolved.protocol === 'https:')) {
        discovered.push(resolved.toString());
      }
    } catch {
      // Ignore invalid URLs
    }
  }

  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const resolved = new URL(raw, currentUrl);
      if (resolved.hostname === targetHostname) {
        discovered.push(resolved.toString());
      }
    } catch {
      // Ignore
    }
  }

  return discovered;
}

/**
 * Extract HTML form definitions and their inputs.
 */
function extractHtmlForms(html: string, currentUrl: URL, targetHostname: string): Array<{
  url: string;
  path: string;
  method: HttpMethod;
  parameters: EndpointParameter[];
}> {
  const forms: Array<{
    url: string;
    path: string;
    method: HttpMethod;
    parameters: EndpointParameter[];
  }> = [];

  const formRegex = /<form\s+([^>]*)>([\s\S]*?)<\/form>/gi;
  let formMatch: RegExpExecArray | null;

  while ((formMatch = formRegex.exec(html)) !== null) {
    const formAttrs = formMatch[1] || '';
    const formInner = formMatch[2] || '';

    // Action
    const actionMatch = formAttrs.match(/action=["']([^"']*)["']/i);
    const actionRaw = actionMatch && actionMatch[1] ? actionMatch[1].trim() : '';

    let formTargetUrl: URL;
    try {
      formTargetUrl = actionRaw ? new URL(actionRaw, currentUrl) : currentUrl;
    } catch {
      continue;
    }

    if (formTargetUrl.hostname !== targetHostname) {
      continue;
    }

    // Method
    const methodMatch = formAttrs.match(/method=["']([^"']+)["']/i);
    const methodRaw = (methodMatch && methodMatch[1] ? methodMatch[1].toUpperCase() : 'GET') as HttpMethod;
    const method: HttpMethod = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(methodRaw) ? methodRaw : 'GET';

    // Inputs
    const parameters: EndpointParameter[] = [];
    const inputRegex = /<(?:input|textarea|select)\s+[^>]*name=["']([^"']+)["'][^>]*>/gi;
    let inputMatch: RegExpExecArray | null;

    while ((inputMatch = inputRegex.exec(formInner)) !== null) {
      const paramName = inputMatch[1]?.trim();
      if (paramName && !parameters.some((p) => p.name === paramName)) {
        parameters.push({
          name: paramName,
          in: method === 'GET' ? 'query' : 'body',
        });
      }
    }

    forms.push({
      url: formTargetUrl.toString(),
      path: cleanPath(formTargetUrl),
      method,
      parameters,
    });
  }

  return forms;
}

/**
 * Parse robots.txt for disallowed or allowed paths and sitemaps.
 */
function parseRobotsTxt(content: string, targetHostname: string): {
  paths: string[];
  sitemaps: string[];
} {
  const paths: string[] = [];
  const sitemaps: string[] = [];

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) continue;

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('disallow:') || lower.startsWith('allow:')) {
      const parts = trimmed.split(':');
      if (parts.length >= 2) {
        const pathPart = parts.slice(1).join(':').trim();
        if (pathPart && pathPart.startsWith('/') && !pathPart.includes('*')) {
          paths.push(pathPart);
        }
      }
    } else if (lower.startsWith('sitemap:')) {
      const parts = trimmed.split(':');
      if (parts.length >= 2) {
        const sitemapUrl = parts.slice(1).join(':').trim();
        try {
          const u = new URL(sitemapUrl);
          if (u.hostname === targetHostname) {
            sitemaps.push(sitemapUrl);
          }
        } catch {
          // Ignore
        }
      }
    }
  }

  return { paths, sitemaps };
}

/**
 * Parse sitemap.xml for URLs.
 */
function parseSitemapXml(content: string, targetHostname: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = locRegex.exec(content)) !== null) {
    const loc = match[1]?.trim();
    if (!loc) continue;
    try {
      const u = new URL(loc);
      if (u.hostname === targetHostname) {
        urls.push(loc);
      }
    } catch {
      // Ignore
    }
  }

  return urls;
}

/**
 * Executes a deterministic, bounded crawl across the target's attack surface.
 */
export async function crawlAttackSurface(
  targetUrl: string,
  options: CrawlOptions = {}
): Promise<AttackSurfaceResult> {
  const startTime = Date.now();
  const maxDepth = options.maxDepth ?? 3;
  const maxPages = options.maxPages ?? 30;
  const timeoutMs = options.timeoutMs ?? 10000;

  const baseParsed = new URL(targetUrl);
  const targetHostname = baseParsed.hostname;

  const visitedUrls = new Set<string>();
  const discoveredEndpointsMap = new Map<string, DiscoveredEndpoint>();

  // Queue: { url, depth, source }
  const queue: Array<{ url: string; depth: number; source: DiscoverySource }> = [
    { url: baseParsed.origin + baseParsed.pathname, depth: 0, source: 'CRAWLER' },
  ];

  // Aggregated data for technology detection
  const collectedHeaders: Record<string, string | string[] | undefined> = {};
  const collectedCookies: string[] = [];
  let combinedBody = '';
  const discoveredPaths: string[] = [];

  // Helper to upsert discovered endpoint
  const registerEndpoint = (endpoint: DiscoveredEndpoint) => {
    const key = `${endpoint.httpMethod}:${endpoint.path}`;
    const existing = discoveredEndpointsMap.get(key);
    if (!existing) {
      discoveredEndpointsMap.set(key, endpoint);
    } else {
      // Merge parameters
      const existingNames = new Set(existing.parameters.map((p) => p.name));
      for (const p of endpoint.parameters) {
        if (!existingNames.has(p.name)) {
          existing.parameters.push(p);
          existingNames.add(p.name);
        }
      }
      if (endpoint.statusCode && !existing.statusCode) {
        existing.statusCode = endpoint.statusCode;
      }
      if (endpoint.contentType && !existing.contentType) {
        existing.contentType = endpoint.contentType;
      }
      if (endpoint.responseTimeMs && !existing.responseTimeMs) {
        existing.responseTimeMs = endpoint.responseTimeMs;
      }
    }
  };

  // Helper to safely fetch an endpoint
  async function fetchEndpoint(urlStr: string): Promise<SafeHttpResponse | null> {
    try {
      await activeRateLimiter.acquireToken(targetHostname);

      if (circuitBreaker.isOpen(targetHostname)) {
        console.warn(`[ZERIVEX CRAWLER] Circuit breaker OPEN for ${targetHostname}; skipping fetch ${urlStr}`);
        return null;
      }

      const res = await safeFetch(urlStr, {
        timeoutMs,
        followRedirects: true,
        maxRedirects: 3,
      });

      circuitBreaker.recordSuccess(targetHostname);
      return res;
    } catch (err) {
      circuitBreaker.recordFailure(targetHostname);
      return null;
    }
  }

  // 1. Breadth-First Spider Crawl Loop (starting with target root URL)
  while (queue.length > 0 && visitedUrls.size < maxPages) {
    const current = queue.shift()!;
    if (visitedUrls.has(current.url)) continue;

    visitedUrls.add(current.url);

    const currentParsed = new URL(current.url);
    const path = cleanPath(currentParsed);
    discoveredPaths.push(path);

    // If it's a known static non-HTML asset, do not crawl body
    if (isStaticAsset(path)) {
      registerEndpoint({
        url: current.url,
        path,
        httpMethod: 'GET',
        parameters: parseUrlParameters(currentParsed),
        discoverySource: current.source,
      });
      continue;
    }

    const reqStart = Date.now();
    const res = await fetchEndpoint(current.url);
    const respTime = Date.now() - reqStart;

    if (!res) continue;

    // Collect headers & cookies & body snippet
    Object.assign(collectedHeaders, res.headers);
    if (res.headers['set-cookie']) {
      const sc = Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']];
      collectedCookies.push(...sc);
    }
    if (combinedBody.length < 50000) {
      combinedBody += `\n${res.body.substring(0, 10000)}`;
    }

    // Register this endpoint
    registerEndpoint({
      url: current.url,
      path,
      httpMethod: 'GET',
      parameters: parseUrlParameters(currentParsed),
      statusCode: res.statusCode,
      contentType: (res.headers['content-type'] as string) || null,
      discoverySource: current.source,
      responseTimeMs: respTime,
    });

    // Check content type before parsing links
    const contentType = (res.headers['content-type'] as string) || '';
    if (contentType.includes('text/html') && current.depth < maxDepth) {
      // Extract links
      const links = extractHtmlLinks(res.body, currentParsed, targetHostname);
      for (const link of links) {
        if (!visitedUrls.has(link) && !queue.some((q) => q.url === link)) {
          if (visitedUrls.size + queue.length < maxPages * 2) {
            queue.push({ url: link, depth: current.depth + 1, source: 'CRAWLER' });
          }
        }
      }

      // Extract forms
      const forms = extractHtmlForms(res.body, currentParsed, targetHostname);
      for (const form of forms) {
        registerEndpoint({
          url: form.url,
          path: form.path,
          httpMethod: form.method,
          parameters: form.parameters,
          discoverySource: 'CRAWLER',
        });
      }
    }
  }

  // 2. Process common metadata and API discovery paths
  for (const item of COMMON_DISCOVERY_PATHS) {
    if (visitedUrls.size >= maxPages * 2) break;
    const probeUrl = new URL(item.path, baseParsed.origin).toString();
    if (visitedUrls.has(probeUrl)) continue;

    const reqStart = Date.now();
    const res = await fetchEndpoint(probeUrl);
    visitedUrls.add(probeUrl);

    if (res) {
      const respTime = Date.now() - reqStart;
      const u = new URL(probeUrl);
      const path = cleanPath(u);
      discoveredPaths.push(path);

      // Collect headers & cookies
      Object.assign(collectedHeaders, res.headers);
      if (res.headers['set-cookie']) {
        const sc = Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']];
        collectedCookies.push(...sc);
      }

      // Catalog endpoint if reachable or returns status
      if (res.statusCode < 500) {
        registerEndpoint({
          url: probeUrl,
          path,
          httpMethod: 'GET',
          parameters: parseUrlParameters(u),
          statusCode: res.statusCode,
          contentType: (res.headers['content-type'] as string) || null,
          discoverySource: item.source,
          responseTimeMs: respTime,
        });
      }

      // Parse robots.txt
      if (item.path === '/robots.txt' && res.statusCode === 200) {
        const parsedRobots = parseRobotsTxt(res.body, targetHostname);
        for (const p of parsedRobots.paths) {
          const uDisallowed = new URL(p, baseParsed.origin);
          registerEndpoint({
            url: uDisallowed.toString(),
            path: cleanPath(uDisallowed),
            httpMethod: 'GET',
            parameters: parseUrlParameters(uDisallowed),
            discoverySource: 'ROBOTS_TXT',
          });
        }
      }

      // Parse sitemap.xml
      if (item.path === '/sitemap.xml' && res.statusCode === 200) {
        const sitemapUrls = parseSitemapXml(res.body, targetHostname);
        for (const smUrl of sitemapUrls) {
          const uSm = new URL(smUrl);
          registerEndpoint({
            url: smUrl,
            path: cleanPath(uSm),
            httpMethod: 'GET',
            parameters: parseUrlParameters(uSm),
            discoverySource: 'SITEMAP',
          });
        }
      }
    }
  }

  // 3. Detect technologies from aggregated headers, cookies, body, and URL paths
  const technologies = detectTechnologies({
    headers: collectedHeaders,
    body: combinedBody,
    cookies: collectedCookies,
    urlPaths: discoveredPaths,
  });

  const duration = Date.now() - startTime;
  const endpoints = Array.from(discoveredEndpointsMap.values());

  return {
    endpoints,
    technologies,
    crawlDurationMs: duration,
    totalPagesScanned: visitedUrls.size,
  };
}
