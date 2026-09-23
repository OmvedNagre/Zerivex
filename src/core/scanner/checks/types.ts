export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
export type Confidence = 'CONFIRMED' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ScanMode = 'PUBLIC_PASSIVE' | 'VERIFIED_ACTIVE';

export interface RawFinding {
  ruleId: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  category: string;
  resourceEndpoint: string;
  evidence: Record<string, unknown>;
  cweId?: string;
  owaspCategory?: string;
  description?: string;
  remediation?: string;
}

export interface ScanContext {
  targetUrl: string;
  hostname: string;
  scanMode: ScanMode;
  organizationId: string;
  targetId: string;
  discoveredEndpoints?: Array<{
    url: string;
    path: string;
    httpMethod: string;
    parameters: Array<{ name: string; in: string }>;
  }>;
}

export interface ScanCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Whether this check requires active scanning authorization */
  requiresActiveScan?: boolean;
  run(context: ScanContext): Promise<RawFinding[]>;
}
