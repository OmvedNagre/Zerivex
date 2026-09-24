/**
 * Zerivex OASIS SARIF v2.1.0 Export Generator
 * Produces industry-standard SARIF (Static Analysis Results Interchange Format)
 * for native ingestion by GitHub Code Scanning, GitLab SAST/DAST, and IDE extensions.
 */

import { FindingRecord, ScanJobRecord } from '@/core/scanner/scan-runner';
import { getRemediationForRule } from '@/core/remediation/remediation-catalog';

export interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: SarifRun[];
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      semanticVersion: string;
      informationUri: string;
      rules: SarifRule[];
    };
  };
  results: SarifResult[];
  invocations?: Array<{
    executionSuccessful: boolean;
    endTimeUtc?: string;
  }>;
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: {
    text: string;
  };
  fullDescription: {
    text: string;
  };
  defaultConfiguration: {
    level: 'error' | 'warning' | 'note';
  };
  helpUri: string;
  help?: {
    text: string;
    markdown?: string;
  };
  properties?: {
    tags: string[];
    precision: 'high' | 'medium' | 'low';
    'problem.severity': 'error' | 'warning' | 'recommendation';
  };
}

export interface SarifResult {
  ruleId: string;
  ruleIndex?: number;
  level: 'error' | 'warning' | 'note';
  message: {
    text: string;
  };
  locations: Array<{
    physicalLocation: {
      artifactLocation: {
        uri: string;
        uriBaseId?: string;
      };
      region?: {
        startLine: number;
        startColumn?: number;
      };
    };
    logicalLocations?: Array<{
      name: string;
      kind: string;
    }>;
  }>;
  properties?: {
    category: string;
    cweId?: string | null;
    owaspCategory?: string | null;
    confidence: string;
    status: string;
  };
}

function mapSeverityToSarifLevel(severity: string): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return 'error';
    case 'MEDIUM':
      return 'warning';
    case 'LOW':
    case 'INFORMATIONAL':
    default:
      return 'note';
  }
}

function cleanUriForSarif(uriOrEndpoint: string): string {
  try {
    if (uriOrEndpoint.startsWith('http://') || uriOrEndpoint.startsWith('https://')) {
      const url = new URL(uriOrEndpoint);
      // Strip leading slash for relative file-like artifact location in code scanning
      return (url.pathname.replace(/^\//, '') || 'index.html') + (url.search || '');
    }
  } catch {}
  return uriOrEndpoint.replace(/^\//, '') || 'index.html';
}

/**
 * Generate OASIS SARIF v2.1.0 document from a completed scan job and findings.
 */
export function generateSarifReport(params: {
  scanJob: Pick<ScanJobRecord, 'id' | 'status' | 'completedAt'> & {
    targetUrl?: string;
    targetHostname?: string;
  };
  findings: FindingRecord[];
}): SarifLog {
  const { scanJob, findings } = params;

  // 1. Build distinct rule registry from findings
  const rulesMap = new Map<string, SarifRule>();

  for (const finding of findings) {
    if (!rulesMap.has(finding.ruleId)) {
      const remediation = getRemediationForRule(finding.ruleId);
      const tags = ['security'];
      if (finding.cweId) tags.push(finding.cweId.toLowerCase());
      if (finding.owaspCategory) tags.push(finding.owaspCategory.toLowerCase().replace(/[^a-z0-9]/g, '-'));

      const level = mapSeverityToSarifLevel(finding.severity);

      const rule: SarifRule = {
        id: finding.ruleId,
        name: finding.title.replace(/[^a-zA-Z0-9]/g, ''),
        shortDescription: {
          text: finding.title,
        },
        fullDescription: {
          text: remediation?.summary || finding.title,
        },
        defaultConfiguration: {
          level,
        },
        helpUri: `https://zerivex.com/docs/rules/${finding.ruleId}`,
        help: remediation
          ? {
              text: `${remediation.summary}\n\nSecurity Impact:\n${remediation.impact}\n\nCLI Verification:\n${remediation.cliVerification || 'N/A'}`,
              markdown: `### ${finding.title}\n\n${remediation.summary}\n\n**Security Impact:**\n${remediation.impact}\n\n**Fix Guidance:**\n\`\`\`${remediation.frameworks.nextjs ? 'typescript' : 'bash'}\n${remediation.frameworks.nextjs?.diff || remediation.frameworks.express?.diff || '// See remediation catalog'}\n\`\`\``,
            }
          : {
              text: finding.title,
            },
        properties: {
          tags,
          precision: finding.confidence === 'CONFIRMED' ? 'high' : 'medium',
          'problem.severity': level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'recommendation',
        },
      };

      rulesMap.set(finding.ruleId, rule);
    }
  }

  const rules = Array.from(rulesMap.values());
  const ruleIndexMap = new Map<string, number>(rules.map((r, idx) => [r.id, idx]));

  // 2. Build SARIF results
  const results: SarifResult[] = findings.map((f) => {
    const level = mapSeverityToSarifLevel(f.severity);
    const ruleIdx = ruleIndexMap.get(f.ruleId);
    const cleanUri = cleanUriForSarif(f.resourceEndpoint);

    return {
      ruleId: f.ruleId,
      ruleIndex: ruleIdx,
      level,
      message: {
        text: `${f.title} detected on ${f.resourceEndpoint}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: cleanUri,
            },
            region: {
              startLine: 1,
              startColumn: 1,
            },
          },
          logicalLocations: [
            {
              name: f.resourceEndpoint,
              kind: 'endpoint',
            },
          ],
        },
      ],
      properties: {
        category: f.category,
        cweId: f.cweId,
        owaspCategory: f.owaspCategory,
        confidence: f.confidence,
        status: f.status,
      },
    };
  });

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Zerivex',
            version: '1.0.0',
            semanticVersion: '1.0.0',
            informationUri: 'https://zerivex.com',
            rules,
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: scanJob.status === 'COMPLETED',
            endTimeUtc: scanJob.completedAt ? new Date(scanJob.completedAt).toISOString() : new Date().toISOString(),
          },
        ],
      },
    ],
  };
}
