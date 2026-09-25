import { AcademyArticle, LearningTrack } from './types';

export const LEARNING_TRACKS: LearningTrack[] = [
  {
    id: 'ai-code-smells',
    title: 'AI Code Smells & Common Pitfalls',
    description: 'Securing web applications developed with AI coding tools (Cursor, Lovable, v0, Bolt, Claude Code).',
    icon: '🤖',
    articleSlugs: ['securing-ai-generated-code', 'client-side-secret-leakage'],
  },
  {
    id: 'api-modern-web',
    title: 'API & Modern Web Defenses',
    description: 'Bulletproof defenses for REST, GraphQL, CORS origins, and defensive HTTP security headers.',
    icon: '🌐',
    articleSlugs: ['overly-permissive-cors', 'essential-security-headers', 'nextjs-server-actions-auth'],
  },
  {
    id: 'injection-sanitization',
    title: 'Injection & Input Sanitization',
    description: 'Stopping SQL injection, Cross-Site Scripting (XSS), and Server-Side Request Forgery (SSRF).',
    icon: '🛡️',
    articleSlugs: ['ssrf-defense-in-depth', 'sql-injection-modern-orms', 'xss-react-hydration'],
  },
  {
    id: 'identity-rbac-tenancy',
    title: 'Identity, RBAC & Multi-Tenancy',
    description: 'Hardening session management, multi-tenant database isolation, and fine-grained RBAC.',
    icon: '🔐',
    articleSlugs: ['multi-tenant-idor-isolation', 'session-security-token-hashing'],
  },
];

export const ACADEMY_ARTICLES: AcademyArticle[] = [
  {
    id: 'art-001',
    slug: 'securing-ai-generated-code',
    title: "The Developer's Guide to Auditing AI-Generated Web Applications",
    summary:
      'How AI code assistants systematically introduce security vulnerabilities, and a practical pre-deployment verification workflow.',
    category: 'AI_CODE_SMELLS',
    trackId: 'ai-code-smells',
    difficulty: 'BEGINNER',
    estimatedReadMinutes: 8,
    cweId: 'CWE-1188',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    relatedRuleIds: ['ZX-AI-SMELL-001', 'ZX-SECRETS-001'],
    aiPitfallDescription:
      'Generative AI models prioritize "making it work quickly" over security boundaries. They frequently hardcode placeholder credentials in client components, disable CORS checks, bypass authentication in server actions, and use unescaped template literals for database queries.',
    vulnerabilityAnalysis:
      'When prompting tools like Cursor, Lovable, or v0 to build a feature (e.g. "Create a profile edit modal that uploads an avatar to S3"), models frequently generate client-side code containing raw API keys, unauthenticated endpoints, or mock auth fallbacks. In production, these flaws lead to credential harvesting and data breaches.',
    badCodeExample: {
      language: 'typescript',
      code: `// AI-Generated Component (DANGEROUS)
export function PaymentProcessor() {
  // AI placed private secret in client bundle!
  const STRIPE_SECRET_KEY = "sk_live_51M0..."; 
  
  async function chargeUser(amount: number) {
    await fetch("https://api.stripe.com/v1/charges", {
      headers: { Authorization: \`Bearer \${STRIPE_SECRET_KEY}\` },
      body: JSON.stringify({ amount })
    });
  }
}`,
      explanation:
        'The AI tool inlined a live secret API key directly into a client-side React component, making it visible to anyone inspecting page source or network traffic.',
    },
    remediationSnippets: [
      {
        framework: 'nextjs',
        filename: 'src/app/api/charge/route.ts',
        code: `import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/core/rbac/authorization-guard';

export async function POST(req: NextRequest) {
  // 1. Authenticate requester server-side
  const auth = await requireAuth(req);
  const { amount } = await req.json();

  // 2. Secret remains exclusively in server environment
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe secret unconfigured");

  // Perform secure backend transaction...
  return NextResponse.json({ success: true });
}`,
        explanation: 'Keep all secrets server-side in secure API routes or server actions. Never prefix sensitive keys with NEXT_PUBLIC_.',
      },
      {
        framework: 'express',
        filename: 'server/routes/billing.js',
        code: `const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { requireAuth } = require('../middleware/auth');

router.post('/charge', requireAuth, async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Payment gateway unconfigured' });
  }

  const { amount } = req.body;
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'inr',
    metadata: { userId: req.user.id }
  });

  res.json({ clientSecret: paymentIntent.client_secret });
});

module.exports = router;`,
        explanation: 'Enforce secret isolation in Express route handlers using environment variables and auth middleware.',
      },
    ],
    cliVerification: [
      {
        tool: 'curl',
        command: "curl -sI https://example.com/_next/static/chunks/app/page-*.js | grep -iE 'sk_live|private_key|token'",
        expectedOutput: '(empty response - zero secrets exposed in frontend bundles)',
        description: 'Check production JavaScript bundles for leaked secret tokens.',
      },
    ],
    checklist: [
      'Audit all process.env occurrences; ensure sensitive keys do NOT have NEXT_PUBLIC_ or VITE_ prefixes.',
      'Verify that all Next.js Server Actions and Route Handlers check user authentication.',
      'Run an automated Zerivex scan before deploying any AI-scaffolded branch to staging or production.',
    ],
    tags: ['AI Security', 'Cursor', 'Lovable', 'v0', 'Secret Hygiene', 'OWASP Top 10'],
    publishedAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  },
  {
    id: 'art-002',
    slug: 'overly-permissive-cors',
    title: 'Fixing Permissive Wildcard CORS with Authenticated Credentials',
    summary:
      'Why Access-Control-Allow-Origin: * combined with credentials enables complete session hijacking, and how to configure strict origin whitelists.',
    category: 'API_SECURITY',
    trackId: 'api-modern-web',
    difficulty: 'INTERMEDIATE',
    cweId: 'CWE-942',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    relatedRuleIds: ['ZX-CORS-001'],
    estimatedReadMinutes: 6,
    aiPitfallDescription:
      'AI tools frequently encounter cross-origin fetch errors during local dev and resolve them by adding res.setHeader("Access-Control-Allow-Origin", "*") or returning the incoming Origin header verbatim, completely defeating browser Same-Origin Policy protections.',
    vulnerabilityAnalysis:
      'A permissive Cross-Origin Resource Sharing (CORS) policy allows unauthorized third-party websites to issue authenticated cross-origin requests using a logged-in user\'s browser cookies. An attacker hosting malicious JavaScript on evil.com can extract sensitive user account data and execute actions without consent.',
    badCodeExample: {
      language: 'typescript',
      code: `// Express / Node.js AI-generated middleware
app.use((req, res, next) => {
  // Reflects ANY origin that asks!
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});`,
      explanation: 'Reflecting req.headers.origin directly allows malicious sites to read authenticated API responses.',
    },
    remediationSnippets: [
      {
        framework: 'nextjs',
        filename: 'src/middleware.ts',
        code: `import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_ORIGINS = new Set([
  'https://zerivex.com',
  'https://app.zerivex.com',
]);

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');
  const res = NextResponse.next();

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }

  return res;
}`,
        explanation: 'Enforce an immutable Set of allowed origins. Reject unknown origins without setting CORS headers.',
      },
      {
        framework: 'express',
        filename: 'src/server.ts',
        code: `import cors from 'cors';

const ALLOWED_ORIGINS = ['https://zerivex.com', 'https://app.zerivex.com'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));`,
        explanation: 'Use dynamic origin validator in cors middleware rejecting untrusted origins.',
      },
      {
        framework: 'nginx',
        filename: '/etc/nginx/conf.d/cors.conf',
        code: `map $http_origin $cors_origin {
    default "";
    "~^https://(app\.)?zerivex\.com$" "$http_origin";
}

server {
    add_header Access-Control-Allow-Origin $cors_origin always;
    add_header Access-Control-Allow-Credentials "true" always;
}`,
        explanation: 'Nginx regex map that resolves strictly to whitelisted domain patterns.',
      },
    ],
    cliVerification: [
      {
        tool: 'curl',
        command: 'curl -sI -H "Origin: https://evil-attacker.com" https://example.com/api/user | grep -i "Access-Control-Allow-Origin"',
        expectedOutput: '(empty response - header must NOT reflect evil-attacker.com)',
        description: 'Verify malicious origin is not reflected in CORS response headers.',
      },
    ],
    checklist: [
      'Ensure Access-Control-Allow-Origin is never set to * when Access-Control-Allow-Credentials is true.',
      'Check that staging/preview environments do not use wildcard origins in production.',
      'Validate preflight OPTIONS requests return 204 No Content with restrictive headers.',
    ],
    tags: ['CORS', 'Browser Security', 'OWASP A05', 'Same-Origin Policy', 'APIs'],
    publishedAt: '2026-09-02T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  },
  {
    id: 'art-003',
    slug: 'client-side-secret-leakage',
    title: 'Preventing Exposed API Keys & Secrets in AI-Generated Frontend Bundles',
    summary:
      'Understanding why environment variables with NEXT_PUBLIC_ or VITE_ are baked into client JS, and how to establish strict secret isolation.',
    category: 'AI_CODE_SMELLS',
    trackId: 'ai-code-smells',
    difficulty: 'BEGINNER',
    cweId: 'CWE-798',
    owaspCategory: 'A07:2021-Identification and Authentication Failures',
    relatedRuleIds: ['ZX-SECRETS-001'],
    estimatedReadMinutes: 5,
    aiPitfallDescription:
      'When an AI prompt mentions "Connect to OpenAI API in the React frontend", the AI often outputs process.env.NEXT_PUBLIC_OPENAI_API_KEY. The developer assumes .env is safe, unaware that Next.js and Vite inline all NEXT_PUBLIC_ and VITE_ prefixed variables directly into the browser bundle.',
    vulnerabilityAnalysis:
      'Any credential compiled into client-side JavaScript can be extracted by scraping web scrapers, automated botnets, and curious users in seconds. Leaked database URLs, Stripe secret keys, AWS access keys, and OpenAI tokens lead to massive financial damage and database compromise.',
    badCodeExample: {
      language: 'typescript',
      code: `// .env.local (DANGEROUS)
NEXT_PUBLIC_DATABASE_URL="postgres://postgres:pass@db.example.com/prod"
NEXT_PUBLIC_OPENAI_SECRET="sk-proj-xyz123..."

// Client Component:
import { OpenAI } from 'openai';
const client = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_SECRET });`,
      explanation: 'Exposes database credentials and LLM billing keys to anyone opening browser DevTools.',
    },
    remediationSnippets: [
      {
        framework: 'nextjs',
        filename: '.env.local',
        code: `# Correct Server-Only Secrets (NO NEXT_PUBLIC_ PREFIX)
DATABASE_URL="postgres://postgres:pass@db.example.com/prod"
OPENAI_API_KEY="sk-proj-xyz123..."

# Only Non-Sensitive Configuration for Client:
NEXT_PUBLIC_APP_URL="https://app.zerivex.com"`,
        explanation: 'Remove NEXT_PUBLIC_ prefixes from all secrets. Secrets are only accessible on the server.',
      },
      {
        framework: 'express',
        filename: 'server/app.js',
        code: `const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

// Verify critical server secrets exist at boot time
const REQUIRED_SECRETS = ['DATABASE_URL', 'STRIPE_SECRET_KEY', 'JWT_SECRET'];
for (const secret of REQUIRED_SECRETS) {
  if (!process.env[secret]) {
    console.error(\`FATAL: Missing environment variable: \${secret}\`);
    process.exit(1);
  }
}

const app = express();
// Never expose environment dump endpoints (like /api/config or /env)
app.get('/api/config', (req, res) => {
  // ONLY expose explicitly safe, public client configuration:
  res.json({
    appVersion: '1.4.0',
    supportEmail: 'support@zerivex.local'
  });
});`,
        explanation: 'Validate server-only secrets at process startup and never leak environment tables through diagnostic endpoints.',
      },
    ],
    cliVerification: [
      {
        tool: 'curl',
        command: "curl -s https://example.com | grep -oE '(sk_live_[0-9a-zA-Z]{24}|ghp_[0-9a-zA-Z]{36})'",
        expectedOutput: '(empty response - zero API key tokens found)',
        description: 'Scan production HTML markup and asset manifests for token regexes.',
      },
    ],
    checklist: [
      'Audit your .env files for NEXT_PUBLIC_ or VITE_ prefixes on sensitive tokens.',
      'Add a git pre-commit hook (e.g. gitleaks or trufflehog) to block secrets from being committed.',
      'Check browser DevTools Sources tab on production to confirm zero secrets are present in bundle chunks.',
    ],
    tags: ['Secrets', 'Environment Variables', 'Next.js', 'Vite', 'DevSecOps'],
    publishedAt: '2026-09-03T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  },
  {
    id: 'art-004',
    slug: 'ssrf-defense-in-depth',
    title: 'Defeating Server-Side Request Forgery in Webhooks & Data Fetchers',
    summary:
      'How unvalidated backend HTTP fetch calls expose internal cloud metadata (169.254.169.254) and private networks, and how to implement socket-level IP pinning.',
    category: 'INJECTION_DEFENSES',
    trackId: 'injection-sanitization',
    difficulty: 'ADVANCED',
    cweId: 'CWE-918',
    owaspCategory: 'A10:2021-Server-Side Request Forgery',
    relatedRuleIds: ['ZX-SSRF-001'],
    estimatedReadMinutes: 10,
    aiPitfallDescription:
      'AI tools frequently implement features like "URL unfurling", "Webhook testing", or "Avatar image proxy" using simple fetch(userUrl). An attacker inputs http://169.254.169.254/latest/meta-data/iam/security-credentials/ or http://localhost:5432, allowing them to steal cloud IAM credentials or query internal databases.',
    vulnerabilityAnalysis:
      'Server-Side Request Forgery occurs when a web application fetches a remote resource without validating the destination IP address or protecting against DNS rebinding. Attackers exploit SSRF to pivot from the public web into private VPCs, Kubernetes metadata APIs, and internal Redis/PostgreSQL instances.',
    badCodeExample: {
      language: 'typescript',
      code: `// AI-Generated Webhook Dispatcher (VULNERABLE TO SSRF)
export async function testWebhook(webhookUrl: string) {
  // Directly fetches user-supplied URL!
  // Attacker inputs: http://169.254.169.254/latest/meta-data/
  const res = await fetch(webhookUrl);
  return res.text();
}`,
      explanation: 'No DNS resolution checks, no IP blacklists, and no protection against private network pivoting.',
    },
    remediationSnippets: [
      {
        framework: 'nextjs',
        filename: 'src/core/net/safe-fetch.ts',
        code: `import dns from 'dns/promises';
import net from 'net';

function isPrivateIp(ip: string): boolean {
  // Loopback (127.0.0.0/8, ::1)
  if (ip.startsWith('127.') || ip === '::1') return true;
  // RFC 1918 Private Ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  // Cloud Metadata (169.254.169.254)
  if (ip === '169.254.169.254') return true;
  return false;
}

export async function safeFetch(targetUrl: string): Promise<Response> {
  const parsed = new URL(targetUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Unsupported protocol');
  }

  // Pre-flight DNS resolution
  const addresses = await dns.lookup(parsed.hostname, { all: true });
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(\`SSRF Defense: IP \${address} is a restricted private address\`);
    }
  }

  return fetch(targetUrl, { redirect: 'error' }); // Avoid redirect bypasses
}`,
        explanation: 'Validate resolved IP against private CIDR ranges prior to initiating socket connection.',
      },
      {
        framework: 'express',
        filename: 'server/utils/safe-request.js',
        code: `const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');
const axios = require('axios');

async function safeHttpRequest(userUrl) {
  const parsed = new URL(userUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Disallowed scheme');
  }

  const { address } = await dns.lookup(parsed.hostname);
  const addr = ipaddr.parse(address);

  // Block private, loopback, link-local, and reserved ranges
  if (addr.range() !== 'unicast') {
    throw new Error('Target IP resolves to non-routable private network');
  }

  return axios.get(userUrl, { timeout: 3000, maxRedirects: 0 });
}

module.exports = { safeHttpRequest };`,
        explanation: 'Use ipaddr.js to block non-unicast private addresses and disable automatic redirect following in Express.',
      },
    ],
    cliVerification: [
      {
        tool: 'curl',
        command: "curl -s -X POST https://example.com/api/webhooks/test -d '{\"url\":\"http://169.254.169.254/latest/meta-data/\"}'",
        expectedOutput: '{"error":"SSRF Defense: IP is a restricted private address"}',
        description: 'Verify cloud metadata IP is rejected with 400 Bad Request.',
      },
    ],
    checklist: [
      'Reject all requests to 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, and 169.254.169.254.',
      'Enforce DNS pre-flight checking before HTTP request socket creation.',
      'Disable automatic HTTP redirect following, or re-verify every redirect target IP address.',
    ],
    tags: ['SSRF', 'Cloud Security', 'AWS Metadata', 'Network Security', 'OWASP A10'],
    publishedAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  },
  {
    id: 'art-005',
    slug: 'nextjs-server-actions-auth',
    title: 'Securing Next.js Server Actions Against Missing Authorization',
    summary:
      'Server Actions are publicly accessible POST endpoints by default. Here is how to prevent unauthenticated execution and broken access control.',
    category: 'API_SECURITY',
    trackId: 'api-modern-web',
    difficulty: 'INTERMEDIATE',
    cweId: 'CWE-862',
    owaspCategory: 'A01:2021-Broken Access Control',
    relatedRuleIds: ['ZX-SEC-API-001', 'ZX-AUTH-001'],
    estimatedReadMinutes: 7,
    aiPitfallDescription:
      'AI models treat Server Actions as simple "server-side helper functions" and often omit session authentication checks, assuming that because the function is inside a client component, only authenticated users can invoke it. In reality, any attacker can curl the Next.js action ID directly.',
    vulnerabilityAnalysis:
      'Next.js compiles every "use server" action into an exposed HTTP POST endpoint identifiable by its internal Next-Action hash. Without explicit session verification at the very beginning of the function, unauthenticated attackers can delete accounts, modify billing records, or export proprietary data.',
    badCodeExample: {
      language: 'typescript',
      code: `// app/actions/user.ts (VULNERABLE)
'use server';

export async function deleteUserAccount(targetUserId: string) {
  // AI forgot to check WHO is making this request!
  // Anyone with the action ID can delete any user!
  await db.query('DELETE FROM users WHERE id = $1', [targetUserId]);
}`,
      explanation: 'No authentication check and no verification that targetUserId matches the authenticated requester.',
    },
    remediationSnippets: [
      {
        framework: 'nextjs',
        filename: 'src/actions/user.ts',
        code: `'use server';

import { getServerSession } from '@/core/auth/session-service';

export async function deleteUserAccount(targetUserId: string) {
  // 1. Mandatory server-side authentication
  const session = await getServerSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  // 2. Strict authorization & tenant boundary check
  if (session.user.id !== targetUserId && session.user.role !== 'SUPER_ADMIN') {
    throw new Error('Forbidden: You can only delete your own account');
  }

  await db.query('DELETE FROM users WHERE id = $1', [targetUserId]);
  return { success: true };
}`,
        explanation: 'Always verify session and assert user permissions within the server action body.',
      },
      {
        framework: 'express',
        filename: 'server/middleware/require-auth.js',
        code: `const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

module.exports = { requireAuth };`,
        explanation: 'Always guard mutation endpoints behind robust authentication and role-checking middleware in Express.',
      },
    ],
    cliVerification: [
      {
        tool: 'curl',
        command: "curl -s -X POST https://example.com -H 'Next-Action: abc123def' -d '[\"user-id-to-delete\"]'",
        expectedOutput: '401 Unauthorized or {"error":"Unauthorized"}',
        description: 'Verify unauthenticated invocation of server action is rejected.',
      },
    ],
    checklist: [
      'Verify that every "use server" function performs an explicit session check at line 1.',
      'Enforce role-based access control (RBAC) and tenant scoping on all mutations.',
      'Never trust parameters passed into server actions without validating against the session identity.',
    ],
    tags: ['Next.js', 'Server Actions', 'Broken Access Control', 'OWASP A01', 'Auth'],
    publishedAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  },
  {
    id: 'art-006',
    slug: 'sql-injection-modern-orms',
    title: 'Preventing SQL Injection in Raw Queries and Modern ORMs',
    summary:
      'Why string concatenation in raw queries and unsafe ORM raw clauses ($queryRawUnsafe) lead to database compromise, and how to use parameterized queries.',
    category: 'INJECTION_DEFENSES',
    trackId: 'injection-sanitization',
    difficulty: 'INTERMEDIATE',
    cweId: 'CWE-89',
    owaspCategory: 'A03:2021-Injection',
    relatedRuleIds: ['ZX-SQLI-001'],
    estimatedReadMinutes: 8,
    aiPitfallDescription:
      "When building complex filters (search, sort, pagination), AI coding tools frequently resort to string interpolation: `SELECT * FROM users WHERE name LIKE '%${searchTerm}%'` or ORM raw escapes like prisma.$queryRawUnsafe(...), exposing the application to classic SQL injection.",
    vulnerabilityAnalysis:
      'SQL injection occurs when user-supplied input is directly concatenated into SQL statement text rather than passed as isolated parameters to the database driver. Attackers can execute arbitrary queries, extract entire database tables, alter records, and in some database configurations, execute system commands.',
    badCodeExample: {
      language: 'typescript',
      code: `// AI-Generated Search Endpoint (VULNERABLE)
export async function searchProducts(searchTerm: string) {
  // String interpolation into raw query:
  return await db.query(
    \`SELECT * FROM products WHERE name ILIKE '%\${searchTerm}%'\`
  );
}`,
      explanation: 'Input like "\' OR 1=1 --" alters SQL structure and extracts all rows.',
    },
    remediationSnippets: [
      {
        framework: 'nextjs',
        filename: 'src/core/db/products.ts',
        code: `// Correct Parameterized Query ($1, $2)
export async function searchProducts(searchTerm: string) {
  return await db.query(
    'SELECT id, name, price FROM products WHERE name ILIKE $1',
    [\`%\${searchTerm}%\`]
  );
}`,
        explanation: 'Always pass values as positional parameters. The database driver escapes and sanitizes them.',
      },
      {
        framework: 'express',
        filename: 'server/db/queries.js',
        code: `const { Pool } = require('pg');
const pool = new Pool();

async function searchProducts(searchTerm) {
  // Always use $1 positional placeholder instead of string interpolation
  const query = 'SELECT id, title, price FROM products WHERE title ILIKE $1';
  const values = [\`%\${searchTerm}%\`];
  
  const result = await pool.query(query, values);
  return result.rows;
}

module.exports = { searchProducts };`,
        explanation: 'Leverage PostgreSQL driver parameterized queries ($1, $2) in Express to safely handle untrusted user inputs.',
      },
    ],
    cliVerification: [
      {
        tool: 'curl',
        command: "curl -s 'https://example.com/api/search?q=%27%20OR%201=1%20--'",
        expectedOutput: '{"products":[]}',
        description: 'Verify injection payload is treated as literal text and does not dump all records.',
      },
    ],
    checklist: [
      'Never concatenate variables into SQL strings using template literals (${...}) or +.',
      'Always use parameterized placeholders ($1, $2 in pg, or ? in MySQL/SQLite).',
      'Avoid raw unescaped methods ($queryRawUnsafe) in ORMs like Prisma or Drizzle.',
    ],
    tags: ['SQLi', 'Database Security', 'PostgreSQL', 'Prisma', 'OWASP A03'],
    publishedAt: '2026-09-06T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  },
  {
    id: 'art-007',
    slug: 'xss-react-hydration',
    title: 'Stored & Reflected Cross-Site Scripting (XSS) in Modern React & Next.js',
    summary:
      'React escapes strings in JSX, but dangerouslySetInnerHTML, javascript: URLs, and unescaped SSR hydration payloads still introduce critical XSS.',
    category: 'INJECTION_DEFENSES',
    trackId: 'injection-sanitization',
    difficulty: 'INTERMEDIATE',
    cweId: 'CWE-79',
    owaspCategory: 'A03:2021-Injection',
    relatedRuleIds: ['ZX-XSS-001'],
    estimatedReadMinutes: 7,
    aiPitfallDescription:
      'AI tools building markdown rendering or rich text components routinely output <div dangerouslySetInnerHTML={{ __html: userContent }} /> without sanitizing the HTML with DOMPurify. They also render user links like <a href={userLink}>, allowing javascript:alert(1) payloads.',
    vulnerabilityAnalysis:
      'Cross-Site Scripting allows attackers to inject malicious JavaScript into victim browsers. In modern single-page applications, XSS can steal session tokens from localStorage/cookies, hijack the DOM to display fraudulent credential prompts, or execute transactions on behalf of the victim.',
    badCodeExample: {
      language: 'typescript',
      code: `// AI-Generated Markdown/Blog Component (VULNERABLE)
export function UserBio({ bioHtml, websiteUrl }: { bioHtml: string; websiteUrl: string }) {
  return (
    <div>
      {/* 1. Unsanitized HTML insertion */}
      <div dangerouslySetInnerHTML={{ __html: bioHtml }} />
      
      {/* 2. Unsanitized link href allows javascript: protocol */}
      <a href={websiteUrl}>Visit Website</a>
    </div>
  );
}`,
      explanation: 'dangerouslySetInnerHTML and javascript: links execute attacker code in the victim browser.',
    },
    remediationSnippets: [
      {
        framework: 'nextjs',
        filename: 'src/components/UserBio.tsx',
        code: `import DOMPurify from 'isomorphic-dompurify';

export function UserBio({ bioHtml, websiteUrl }: { bioHtml: string; websiteUrl: string }) {
  // 1. Sanitize HTML tags and strip event handlers
  const cleanHtml = DOMPurify.sanitize(bioHtml);

  // 2. Validate URL protocol is strictly http or https
  const safeHref =
    websiteUrl.startsWith('http://') || websiteUrl.startsWith('https://')
      ? websiteUrl
      : '#';

  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
      <a href={safeHref} rel="noopener noreferrer">Visit Website</a>
    </div>
  );
}`,
        explanation: 'Sanitize HTML with DOMPurify and strictly enforce http:// or https:// URL protocols.',
      },
      {
        framework: 'express',
        filename: 'server/middleware/security.js',
        code: `const helmet = require('helmet');

// Configure defensive Content Security Policy in Express
const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
});

module.exports = { securityMiddleware };`,
        explanation: 'Deploy Helmet with strict Content-Security-Policy to neutralize injected scripts even if rendering flaws exist.',
      },
    ],
    cliVerification: [
      {
        tool: 'curl',
        command: "curl -s 'https://example.com/profile?bio=<script>alert(1)</script>' | grep '<script>alert(1)</script>'",
        expectedOutput: '(empty response - payload must be sanitized or encoded)',
        description: 'Verify injected script tags are stripped from server rendered response.',
      },
    ],
    checklist: [
      'Sanitize any input rendered with dangerouslySetInnerHTML using DOMPurify.',
      'Validate user-provided URLs in href and src attributes to reject javascript: and data: protocols.',
      'Deploy a strict Content-Security-Policy header to prevent unauthorized script execution.',
    ],
    tags: ['XSS', 'React', 'Next.js', 'DOMPurify', 'OWASP A03'],
    publishedAt: '2026-09-07T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  },
  {
    id: 'art-008',
    slug: 'essential-security-headers',
    title: 'Configuring Bulletproof HTTP Security Headers (CSP, HSTS, X-Frame-Options)',
    summary:
      'A practical guide to implementing Content-Security-Policy, Strict-Transport-Security, and framing protections in Next.js and Nginx.',
    category: 'INFRASTRUCTURE_HEADERS',
    trackId: 'api-modern-web',
    difficulty: 'BEGINNER',
    cweId: 'CWE-1021',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    relatedRuleIds: ['ZX-HEADERS-001'],
    estimatedReadMinutes: 6,
    aiPitfallDescription:
      'AI coding tools almost never configure security headers unless explicitly instructed in the prompt. By default, Next.js, Express, and Vite serve pages without Content-Security-Policy, HSTS, or clickjacking protections.',
    vulnerabilityAnalysis:
      'Missing security headers leaves web applications vulnerable to clickjacking attacks (embedding the application in an invisible iframe), SSL stripping attacks, and unconstrained script execution.',
    badCodeExample: {
      language: 'typescript',
      code: `// Default Next.js config without security headers (INCOMPLETE)
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
export default nextConfig;`,
      explanation: 'Omits Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, and HSTS headers.',
    },
    remediationSnippets: [
      {
        framework: 'nextjs',
        filename: 'next.config.mjs',
        code: `/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;",
          },
        ],
      },
    ];
  },
};
export default nextConfig;`,
        explanation: 'Configure global security headers in Next.js config across all routes.',
      },
      {
        framework: 'nginx',
        filename: '/etc/nginx/conf.d/security-headers.conf',
        code: `add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header Content-Security-Policy "default-src 'self';" always;`,
        explanation: 'Set headers globally in Nginx server block with always flag.',
      },
    ],
    cliVerification: [
      {
        tool: 'curl',
        command: 'curl -sI https://example.com | grep -iE "(strict-transport|x-frame|content-security)"',
        expectedOutput: 'X-Frame-Options: DENY\nStrict-Transport-Security: max-age=63072000\nContent-Security-Policy: ...',
        description: 'Inspect live HTTP response headers for presence of required defensive directives.',
      },
    ],
    checklist: [
      'Verify X-Frame-Options is set to DENY or SAMEORIGIN.',
      'Ensure Strict-Transport-Security has a max-age of at least 31536000 (1 year).',
      'Test Content-Security-Policy with report-only mode before enforcing strictly.',
    ],
    tags: ['Headers', 'CSP', 'HSTS', 'Clickjacking', 'Defense in Depth'],
    publishedAt: '2026-09-08T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  },
  {
    id: 'art-009',
    slug: 'multi-tenant-idor-isolation',
    title: 'Enforcing Bulletproof Tenant Isolation & IDOR Defenses in Multi-Tenant SaaS',
    summary:
      'Preventing Insecure Direct Object References (IDOR) by coupling every database query with the caller active organization ID.',
    category: 'AUTHENTICATION_SESSION',
    trackId: 'identity-rbac-tenancy',
    difficulty: 'ADVANCED',
    cweId: 'CWE-639',
    owaspCategory: 'A01:2021-Broken Access Control',
    relatedRuleIds: ['ZX-AUTH-001'],
    estimatedReadMinutes: 9,
    aiPitfallDescription:
      'AI models implement CRUD queries by fetching resources solely by id: SELECT * FROM documents WHERE id = $1. An authenticated user belonging to Tenant A simply changes the ID to Tenant B\'s document ID and reads confidential data.',
    vulnerabilityAnalysis:
      'Insecure Direct Object Reference (IDOR) is the #1 vulnerability in multi-tenant SaaS. When access control decisions rely solely on object IDs without verifying organizational ownership, users can view, mutate, or delete records belonging to competitors.',
    badCodeExample: {
      language: 'typescript',
      code: `// AI-Generated Document Fetcher (VULNERABLE TO IDOR)
export async function getInvoice(invoiceId: string) {
  // Only filters by invoiceId! Does NOT check tenant ownership!
  return await db.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
}`,
      explanation: 'Any authenticated tenant can pass another tenant\'s invoice ID and inspect financial data.',
    },
    remediationSnippets: [
      {
        framework: 'nextjs',
        filename: 'src/core/db/invoices.ts',
        code: `export async function getInvoice(invoiceId: string, organizationId: string) {
  // CRITICAL: Always filter by BOTH object ID AND active organization ID!
  const res = await db.query(
    'SELECT * FROM invoices WHERE id = $1 AND organization_id = $2',
    [invoiceId, organizationId]
  );
  if (res.rows.length === 0) {
    throw new Error('Invoice not found or unauthorized');
  }
  return res.rows[0];
}`,
        explanation: 'Enforce tenant ID filter on every single SELECT, UPDATE, and DELETE query.',
      },
      {
        framework: 'express',
        filename: 'server/routes/invoices.js',
        code: `const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireTenant } = require('../middleware/tenant');

// Secure multi-tenant retrieval
router.get('/:invoiceId', requireTenant, async (req, res) => {
  const { invoiceId } = req.params;
  const tenantId = req.tenant.id;

  // Crucial: enforce both invoiceId AND tenantId in query conditions
  const query = 'SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2';
  const { rows } = await db.query(query, [invoiceId, tenantId]);

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  res.json({ invoice: rows[0] });
});

module.exports = router;`,
        explanation: 'Bind every DB query and mutation to req.tenant.id verified from the session in Express.',
      },
    ],
    cliVerification: [
      {
        tool: 'curl',
        command: "curl -s -H 'Cookie: session=tenant-a-token' https://example.com/api/invoices/tenant-b-invoice-id",
        expectedOutput: '404 Not Found or 403 Forbidden',
        description: 'Verify cross-tenant object query returns 404/403 and does not leak resource data.',
      },
    ],
    checklist: [
      'Audit every database query in your application to confirm organization_id is included in the WHERE clause.',
      'Avoid exposing sequential integer IDs; use random UUIDv4 or KSUID.',
      'Write automated IDOR security tests verifying Tenant A cannot access Tenant B resources.',
    ],
    tags: ['IDOR', 'Multi-Tenancy', 'Authorization', 'PostgreSQL', 'OWASP A01'],
    publishedAt: '2026-09-09T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  },
  {
    id: 'art-010',
    slug: 'session-security-token-hashing',
    title: 'Cryptographically Secure Session Management with Token Hashing',
    summary:
      'Why raw session tokens must never be persisted in databases, and how to implement SHA-256 session token hashing with __Host- cookie prefixes.',
    category: 'AUTHENTICATION_SESSION',
    trackId: 'identity-rbac-tenancy',
    difficulty: 'ADVANCED',
    cweId: 'CWE-384',
    owaspCategory: 'A07:2021-Identification and Authentication Failures',
    relatedRuleIds: ['ZX-SESS-001', 'ZX-COOKIE-001'],
    estimatedReadMinutes: 9,
    aiPitfallDescription:
      'AI generators often store raw session tokens in the database: INSERT INTO sessions (token, user_id) VALUES ($1, $2). If the database is compromised via SQLi or an exposed backup, attackers gain instant, persistent session access to all user accounts without needing passwords.',
    vulnerabilityAnalysis:
      'Just like passwords must be hashed with bcrypt or Argon2, session tokens should be hashed (SHA-256) before persistence. If a database dump is leaked, attackers cannot reconstruct the active raw session cookies.',
    badCodeExample: {
      language: 'typescript',
      code: `// AI-Generated Session Creator (VULNERABLE)
export async function createSession(userId: string) {
  const rawToken = crypto.randomUUID();
  // Storing plaintext token in DB!
  await db.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [rawToken, userId]);
  return rawToken;
}`,
      explanation: 'Plaintext tokens in database expose all active sessions upon database leak.',
    },
    remediationSnippets: [
      {
        framework: 'nextjs',
        filename: 'src/core/auth/session.ts',
        code: `import crypto from 'crypto';

export async function createHashedSession(userId: string): Promise<string> {
  // 1. Generate 256-bit CSPRNG raw token
  const rawToken = crypto.randomBytes(32).toString('hex');

  // 2. Hash token with SHA-256 before database insertion
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await db.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \\'14 days\\')',
    [tokenHash, userId]
  );

  // 3. Return only raw token to client in __Host- cookie
  return rawToken;
}`,
        explanation: 'Only token_hash is persisted. Reconstruct hash upon request validation.',
      },
      {
        framework: 'express',
        filename: 'server/config/session.js',
        code: `const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
  name: '__Host-session',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    path: '/',
  },
});

module.exports = { sessionMiddleware };`,
        explanation: 'Configure Redis-backed express-session with __Host- prefix, httpOnly, secure, and SameSite=Lax flags.',
      },
    ],
    cliVerification: [
      {
        tool: 'curl',
        command: "curl -sI https://example.com/api/auth/login | grep -i 'set-cookie'",
        expectedOutput: '__Host-zerivex_session=...; HttpOnly; Secure; SameSite=Lax; Path=/',
        description: 'Verify session cookie includes __Host- prefix, HttpOnly, Secure, and SameSite.',
      },
    ],
    checklist: [
      'Store only SHA-256 hashes of session tokens in the database.',
      'Use the __Host- cookie prefix with Secure, HttpOnly, SameSite=Lax, and Path=/.',
      'Provide single-device and multi-device session revocation endpoints.',
    ],
    tags: ['Session Security', 'Token Hashing', 'Cookies', 'Authentication', 'CSPRNG'],
    publishedAt: '2026-09-10T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  },
];
