import { safeFetch } from '@/core/security/safe-http-client';
import { ScanCheck, ScanContext, RawFinding } from './types';
import { defaultRateLimiter, defaultCircuitBreaker, CircuitBreakerOpenError } from '../active-rate-limiter';

/**
 * SQL Error Signatures across major database management systems
 */
const SQL_ERROR_PATTERNS: Array<{ rdbms: string; pattern: RegExp }> = [
  // PostgreSQL
  { rdbms: 'PostgreSQL', pattern: /syntax error at or near/i },
  { rdbms: 'PostgreSQL', pattern: /unterminated quoted string at or near/i },
  { rdbms: 'PostgreSQL', pattern: /pg_query\(\):\s*Query failed/i },
  { rdbms: 'PostgreSQL', pattern: /psycopg2\.errors\./i },
  { rdbms: 'PostgreSQL', pattern: /org\.postgresql\.util\.PSQLException/i },

  // MySQL & MariaDB
  { rdbms: 'MySQL', pattern: /you have an error in your sql syntax/i },
  { rdbms: 'MySQL', pattern: /warning:\s*mysql_/i },
  { rdbms: 'MySQL', pattern: /check the manual that corresponds to your (mysql|mariadb) server version/i },
  { rdbms: 'MySQL', pattern: /com\.mysql\.jdbc\.exceptions/i },

  // SQLite
  { rdbms: 'SQLite', pattern: /unrecognized token:/i },
  { rdbms: 'SQLite', pattern: /sqlite3\.OperationalError:/i },
  { rdbms: 'SQLite', pattern: /near\s+["'].*?["']:\s*syntax error/i },
  { rdbms: 'SQLite', pattern: /SQLite_Exception/i },

  // Microsoft SQL Server
  { rdbms: 'MSSQL', pattern: /unclosed quotation mark after the character string/i },
  { rdbms: 'MSSQL', pattern: /Microsoft OLE DB Provider for SQL Server/i },
  { rdbms: 'MSSQL', pattern: /\[SQL Server\]/i },
  { rdbms: 'MSSQL', pattern: /com\.microsoft\.sqlserver\.jdbc\.SQLServerException/i },

  // Oracle
  { rdbms: 'Oracle', pattern: /ORA-01756:\s*quoted string not properly terminated/i },
  { rdbms: 'Oracle', pattern: /ORA-00933:\s*SQL command not properly ended/i },
  { rdbms: 'Oracle', pattern: /oracle\.jdbc\.driver/i },
];

const ERROR_PAYLOADS = [
  "'",
  "\"",
  "')",
  "' OR '1'='1",
  "' OR 1=1--",
  "1' AND '1'='1",
];

export const sqliCheck: ScanCheck = {
  id: 'check-sqli',
  name: 'Active SQL Injection (SQLi) Prober',
  description: 'Probes HTTP parameters with harmless, non-destructive SQL syntax delimiters and differential boolean logic to detect database injection vulnerabilities.',
  category: 'Injection',
  requiresActiveScan: true,

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    if (context.scanMode !== 'VERIFIED_ACTIVE') {
      return findings;
    }

    const parsed = new URL(context.targetUrl);
    const existingParams = Array.from(parsed.searchParams.keys());
    // Probe existing parameters first, or fallback to common candidate injection targets
    const targetParams = existingParams.length > 0 ? existingParams : ['id', 'query', 'category', 'item'];

    for (const param of targetParams) {
      if (defaultCircuitBreaker.isOpen(context.hostname)) {
        break;
      }

      // --- 1. Error-Based SQLi Probing ---
      let errorVulnerabilityFound = false;
      for (const payload of ERROR_PAYLOADS) {
        if (defaultCircuitBreaker.isOpen(context.hostname)) break;

        const testUrl = new URL(context.targetUrl);
        testUrl.searchParams.set(param, payload);

        try {
          await defaultRateLimiter.acquire(context.hostname);
          const res = await safeFetch(testUrl.toString(), {
            method: 'GET',
            timeoutMs: 8000,
          });

          // Check if any known database error pattern was reflected in the response
          for (const { rdbms, pattern } of SQL_ERROR_PATTERNS) {
            const match = res.body.match(pattern);
            if (match) {
              findings.push({
                ruleId: 'ZX-ACT-SQLI-001',
                title: `SQL Injection (${rdbms}) in Parameter "${param}"`,
                severity: 'CRITICAL',
                confidence: 'CONFIRMED',
                category: 'Injection',
                resourceEndpoint: testUrl.toString(),
                cweId: 'CWE-89',
                owaspCategory: 'A03:2021-Injection',
                description: `The application returned an explicit ${rdbms} database error when probed with SQL delimiter "${payload}" in parameter "${param}". This confirms that untrusted user input is directly concatenated into a dynamic database query.`,
                remediation: `Use parameterized queries, prepared statements (e.g. $1, ?, or ORM methods), or stored procedures. Never concatenate user input directly into SQL strings.`,
                evidence: {
                  parameter: param,
                  probePayload: payload,
                  detectedRdbms: rdbms,
                  matchedPattern: match[0],
                  responseSnippet: res.body.substring(Math.max(0, match.index! - 100), Math.min(res.body.length, match.index! + 150)),
                  statusCode: res.statusCode,
                },
              });
              errorVulnerabilityFound = true;
              break;
            }
          }

          if (res.statusCode >= 500 && !errorVulnerabilityFound) {
            defaultCircuitBreaker.recordFailure(context.hostname);
          } else {
            defaultCircuitBreaker.recordSuccess(context.hostname);
          }

          if (errorVulnerabilityFound) break;
        } catch (err) {
          if (err instanceof CircuitBreakerOpenError) {
            break;
          }
          defaultCircuitBreaker.recordFailure(context.hostname);
        }
      }

      if (errorVulnerabilityFound) {
        continue;
      }

      // --- 2. Boolean-Differential SQLi Probing ---
      // Compare response when condition is mathematically TRUE vs FALSE
      try {
        if (defaultCircuitBreaker.isOpen(context.hostname)) break;

        // Baseline request
        const baselineUrl = new URL(context.targetUrl);
        baselineUrl.searchParams.set(param, '1');
        await defaultRateLimiter.acquire(context.hostname);
        const baselineRes = await safeFetch(baselineUrl.toString(), { method: 'GET', timeoutMs: 8000 });

        if (baselineRes.statusCode === 200 && baselineRes.body.length > 50) {
          // Condition TRUE probe: 1' AND '1'='1
          const trueUrl = new URL(context.targetUrl);
          trueUrl.searchParams.set(param, "1' AND '1'='1");
          await defaultRateLimiter.acquire(context.hostname);
          const trueRes = await safeFetch(trueUrl.toString(), { method: 'GET', timeoutMs: 8000 });

          // Condition FALSE probe: 1' AND '1'='2
          const falseUrl = new URL(context.targetUrl);
          falseUrl.searchParams.set(param, "1' AND '1'='2");
          await defaultRateLimiter.acquire(context.hostname);
          const falseRes = await safeFetch(falseUrl.toString(), { method: 'GET', timeoutMs: 8000 });

          // Differential analysis:
          // True condition behaves identically to baseline (200 OK, comparable body length)
          // False condition differs significantly (different status or >35% body length difference)
          const trueMatchesBaseline =
            trueRes.statusCode === 200 &&
            Math.abs(trueRes.body.length - baselineRes.body.length) < (baselineRes.body.length * 0.15);

          const falseDiffers =
            falseRes.statusCode !== 200 ||
            Math.abs(falseRes.body.length - baselineRes.body.length) > (baselineRes.body.length * 0.35);

          if (trueMatchesBaseline && falseDiffers) {
            findings.push({
              ruleId: 'ZX-ACT-SQLI-001',
              title: `Boolean-Differential SQL Injection in Parameter "${param}"`,
              severity: 'CRITICAL',
              confidence: 'CONFIRMED',
              category: 'Injection',
              resourceEndpoint: trueUrl.toString(),
              cweId: 'CWE-89',
              owaspCategory: 'A03:2021-Injection',
              description: `The application responded differentially to boolean conditions (1' AND '1'='1 vs 1' AND '1'='2) in parameter "${param}". This confirms that input modifies SQL query execution logic.`,
              remediation: `Use parameterized queries and prepared statements. Ensure all dynamic query inputs are strongly typed and bound using parameterized placeholders.`,
              evidence: {
                parameter: param,
                baselineLength: baselineRes.body.length,
                trueConditionStatusCode: trueRes.statusCode,
                trueConditionLength: trueRes.body.length,
                falseConditionStatusCode: falseRes.statusCode,
                falseConditionLength: falseRes.body.length,
              },
            });
          }
        }
      } catch (err) {
        if (err instanceof CircuitBreakerOpenError) {
          break;
        }
      }
    }

    return findings;
  },
};
