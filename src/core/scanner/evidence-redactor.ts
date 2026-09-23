/**
 * Zerivex Mandatory Multi-Stage Evidence Redactor (ADR-0007)
 * Strictly scrubs credentials, API keys, JWTs, and sensitive headers
 * before persistence to prevent credential exfiltration.
 */

const MAX_EVIDENCE_SIZE_BYTES = 64 * 1024; // 64KB per finding

// Sensitive HTTP header names
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
  'x-session-token',
  'x-amz-security-token',
]);

// High-confidence regex patterns for credentials and tokens
const SECRET_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  // Anthropic API Key (must precede OpenAI sk- pattern)
  {
    name: 'Anthropic API Key',
    regex: /sk-ant-[a-zA-Z0-9_-]{20,95}/g,
    replacement: '[REDACTED_ANTHROPIC_KEY]',
  },
  // OpenAI API Key (standard and modern sk-proj- formats)
  {
    name: 'OpenAI API Key',
    regex: /sk-(?!ant-)(?:proj-|None-)?[a-zA-Z0-9_-]{20,120}/g,
    replacement: '[REDACTED_OPENAI_KEY]',
  },
  // AWS Access Key ID
  {
    name: 'AWS Access Key',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    replacement: '[REDACTED_AWS_KEY]',
  },
  // GitHub Personal Access Token / Fine-grained PAT
  {
    name: 'GitHub Token',
    regex: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,255}/g,
    replacement: '[REDACTED_GITHUB_TOKEN]',
  },
  // Google API Key
  {
    name: 'Google API Key',
    regex: /AIza[0-9A-Za-z-_]{35,45}/g,
    replacement: '[REDACTED_GOOGLE_KEY]',
  },
  // JSON Web Token (JWT) - Header.Payload.Signature
  {
    name: 'JWT Token',
    regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
    replacement: '[REDACTED_JWT_TOKEN]',
  },
  // Database Connection Strings with Passwords
  {
    name: 'Database URL',
    regex: /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s]+:[^@\s]+@[^\s]+/gi,
    replacement: '$1://[REDACTED_USER]:[REDACTED_PASSWORD]@[REDACTED_HOST]',
  },
  // RSA / EC / OpenSSH Private Keys
  {
    name: 'Private Key',
    regex: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
  // Bearer Token in authorization headers or JSON
  {
    name: 'Bearer Token',
    regex: /Bearer\s+(?!\[REDACTED_)[a-zA-Z0-9_\-\.]{15,}/gi,
    replacement: 'Bearer [REDACTED_BEARER_TOKEN]',
  },
  // Password / Secret key-value assignments in .env or config
  {
    name: 'Secret Assignment',
    regex: /((?:password|passwd|secret|token|api_key|apikey|access_key|auth_key)\s*[:=]\s*["']?)(?!\[REDACTED_)[^\s"'\r\n]{4,}(["']?)/gi,
    replacement: '$1[REDACTED_SECRET]$2',
  },
];

/**
 * Sanitize a string by applying all secret masking patterns.
 */
export function sanitizeString(text: string): string {
  let sanitized = text;
  for (const { regex, replacement } of SECRET_PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized;
}

/**
 * Sanitize HTTP headers by replacing values of sensitive headers.
 */
export function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[]> {
  const sanitized: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;

    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADERS.has(lowerKey)) {
      sanitized[key] = '[REDACTED_BY_ZERIVEX]';
    } else {
      if (Array.isArray(value)) {
        sanitized[key] = value.map((v) => sanitizeString(v));
      } else {
        sanitized[key] = sanitizeString(value);
      }
    }
  }

  return sanitized;
}

/**
 * Multi-stage redaction pipeline for finding evidence.
 * Recursively scrubs objects, caps total payload size at 64KB, and replaces all secret patterns.
 */
export function redactEvidence(evidence: Record<string, unknown>): Record<string, unknown> {
  const serialized = JSON.stringify(evidence);

  // 1. Secret pattern masking on serialized representation
  const maskedString = sanitizeString(serialized);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(maskedString);
  } catch {
    parsed = { error: 'Failed to parse sanitized evidence', raw: maskedString.substring(0, 1024) };
  }

  // 2. Specific header redaction if headers object is present
  if (parsed.headers && typeof parsed.headers === 'object') {
    parsed.headers = sanitizeHeaders(parsed.headers as Record<string, string | string[] | undefined>);
  }

  if (parsed.responseHeaders && typeof parsed.responseHeaders === 'object') {
    parsed.responseHeaders = sanitizeHeaders(parsed.responseHeaders as Record<string, string | string[] | undefined>);
  }

  if (parsed.requestHeaders && typeof parsed.requestHeaders === 'object') {
    parsed.requestHeaders = sanitizeHeaders(parsed.requestHeaders as Record<string, string | string[] | undefined>);
  }

  // 3. Size limit enforcement (cap at 64KB)
  const finalJson = JSON.stringify(parsed);
  if (Buffer.byteLength(finalJson, 'utf-8') > MAX_EVIDENCE_SIZE_BYTES) {
    return {
      truncated: true,
      message: 'Evidence exceeded maximum size limit of 64KB and was truncated for security.',
      snippet: finalJson.substring(0, MAX_EVIDENCE_SIZE_BYTES / 2),
    };
  }

  return parsed;
}
