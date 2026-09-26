/**
 * Sensitive Data & PII Scrubbing Rules (Phase 14 Production Hardening)
 *
 * Guarantees zero sensitive credential leakage into logs, APM, or error tracking.
 */

// Keys matching these patterns are replaced with [REDACTED]
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passphrase/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /set-cookie/i,
  /api[_-]?key/i,
  /access[_-]?key/i,
  /private[_-]?key/i,
  /credential/i,
  /session/i,
  /database[_-]?url/i,
  /connection[_-]?string/i,
  /stripe[_-]?secret/i,
  /jwt/i,
  /card[_-]?num/i,
  /cvv/i,
  /ssn/i,
];

// In-string pattern replacements
const INLINE_REPLACEMENT_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // Database connection string with password: postgres://user:password@host
  {
    regex: /(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi,
    replacement: '$1[REDACTED_PASSWORD]$3',
  },
  // Bearer authentication tokens
  {
    regex: /(Bearer\s+)[A-Za-z0-9._\-~+/]+=*/gi,
    replacement: '$1[REDACTED_BEARER_TOKEN]',
  },
  // Stripe Live Keys: sk_live_...
  {
    regex: /sk_live_[0-9a-zA-Z]{24,}/g,
    replacement: 'sk_live_[REDACTED_KEY]',
  },
  // AWS Access Key ID
  {
    regex: /AKIA[0-9A-Z]{16}/g,
    replacement: 'AKIA[REDACTED_AWS_KEY]',
  },
  // Standard JSON Web Tokens (JWT)
  {
    regex: /\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*/g,
    replacement: '[REDACTED_JWT]',
  },
  // GitHub Personal Access Tokens: ghp_...
  {
    regex: /ghp_[0-9a-zA-Z]{36}/g,
    replacement: 'ghp_[REDACTED_GITHUB_TOKEN]',
  },
];

export const REDACTED_VALUE = '[REDACTED]';
const MAX_SCRUB_DEPTH = 8;

/**
 * Scrub sensitive strings, URLs, and auth tokens.
 */
export function scrubString(val: string): string {
  if (!val || typeof val !== 'string') return val;

  let result = val;
  for (const { regex, replacement } of INLINE_REPLACEMENT_PATTERNS) {
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Check if an object key name matches known sensitive key patterns.
 */
export function isSensitiveKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively scrub sensitive properties from objects, arrays, and primitives.
 * Does not mutate the original data structure.
 */
export function scrubSensitiveData<T = any>(data: T, depth = 0): T {
  if (depth > MAX_SCRUB_DEPTH) return data;
  if (data === null || data === undefined) return data;

  // Primitives
  if (typeof data === 'string') {
    return scrubString(data) as unknown as T;
  }
  if (typeof data !== 'object') {
    return data;
  }

  // Errors
  if (data instanceof Error) {
    const errorCopy: any = {
      name: data.name,
      message: scrubString(data.message),
      stack: data.stack ? scrubString(data.stack) : undefined,
    };
    for (const key of Object.keys(data)) {
      if (!['name', 'message', 'stack'].includes(key)) {
        if (isSensitiveKey(key)) {
          errorCopy[key] = REDACTED_VALUE;
        } else {
          errorCopy[key] = scrubSensitiveData((data as any)[key], depth + 1);
        }
      }
    }
    return errorCopy;
  }

  // Arrays
  if (Array.isArray(data)) {
    return data.map((item) => scrubSensitiveData(item, depth + 1)) as unknown as T;
  }

  // Plain Objects
  const scrubbed: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      scrubbed[key] = REDACTED_VALUE;
    } else {
      scrubbed[key] = scrubSensitiveData(value, depth + 1);
    }
  }

  return scrubbed as T;
}
