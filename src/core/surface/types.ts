/**
 * Types and interfaces for the Zerivex Attack Surface Engine
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type DiscoverySource =
  | 'CRAWLER'
  | 'ROBOTS_TXT'
  | 'SITEMAP'
  | 'API_DISCOVERY'
  | 'SPEC_OPENAPI'
  | 'MANUAL';

export type TechCategory =
  | 'FRAMEWORK'
  | 'SERVER'
  | 'CDN_WAF'
  | 'LANGUAGE'
  | 'SECURITY_HEADER'
  | 'AI_TOOLING'
  | 'DATABASE';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface EndpointParameter {
  name: string;
  in: 'query' | 'body' | 'path';
  required?: boolean;
  sampleValue?: string;
}

export interface DiscoveredEndpoint {
  id?: string;
  targetId?: string;
  organizationId?: string;
  scanId?: string | null;
  url: string;
  path: string;
  httpMethod: HttpMethod;
  parameters: EndpointParameter[];
  statusCode?: number | null;
  contentType?: string | null;
  discoverySource: DiscoverySource;
  responseTimeMs?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TechnologyFingerprint {
  id?: string;
  targetId?: string;
  organizationId?: string;
  scanId?: string | null;
  category: TechCategory;
  name: string;
  version?: string | null;
  confidence: ConfidenceLevel;
  matchedIndicators: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CrawlOptions {
  maxDepth?: number;
  maxPages?: number;
  timeoutMs?: number;
  scanId?: string;
}

export interface AttackSurfaceResult {
  endpoints: DiscoveredEndpoint[];
  technologies: TechnologyFingerprint[];
  crawlDurationMs: number;
  totalPagesScanned: number;
}
