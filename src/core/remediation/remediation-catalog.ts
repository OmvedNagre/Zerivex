/**
 * Zerivex Remediation Knowledge Catalog
 * Maps every deterministic scan rule (ZX-*) to plain-English impact analysis,
 * concrete multi-framework code diffs (Next.js, Express, Nginx),
 * and copy-pasteable local CLI verification commands.
 */

export interface FrameworkRemediation {
  filename: string;
  diff: string;
  explanation: string;
}

export interface RuleRemediation {
  ruleId: string;
  title: string;
  summary: string;
  impact: string;
  cwe: string;
  owasp: string;
  frameworks: {
    nextjs?: FrameworkRemediation;
    express?: FrameworkRemediation;
    nginx?: FrameworkRemediation;
  };
  cliVerification: string;
}

export const REMEDIATION_CATALOG: Record<string, RuleRemediation> = {
  // ==========================================
  // TLS & TRANSPORT SECURITY (ZX-TLS-*)
  // ==========================================
  'ZX-TLS-001': {
    ruleId: 'ZX-TLS-001',
    title: 'Unencrypted Cleartext HTTP Protocol in Use',
    summary: 'The application is serving content over unencrypted HTTP (port 80), exposing all traffic to network eavesdropping and injection.',
    impact: 'Attackers on the same network (e.g. public Wi-Fi, ISP, or upstream routers) can capture session tokens, credentials, and inject malicious scripts.',
    cwe: 'CWE-319: Cleartext Transmission of Sensitive Information',
    owasp: 'A02:2021-Cryptographic Failures',
    frameworks: {
      nextjs: {
        filename: 'next.config.mjs',
        explanation: 'Configure Next.js to redirect all insecure HTTP traffic to HTTPS via headers/redirects.',
        diff: `// next.config.mjs
 export default {
+  async redirects() {
+    return [
+      {
+        source: '/:path*',
+        has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
+        destination: 'https://app.yourdomain.com/:path*',
+        permanent: true,
+      },
+    ];
+  },
 };`,
      },
      express: {
        filename: 'src/middleware/enforce-https.ts',
        explanation: 'Enforce HTTPS redirect middleware behind reverse proxies or load balancers.',
        diff: `// src/middleware/enforce-https.ts
+export function enforceHttps(req: Request, res: Response, next: NextFunction) {
+  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
+    return res.redirect(301, \`https://\${req.hostname}\${req.originalUrl}\`);
+  }
+  next();
+}`,
      },
      nginx: {
        filename: '/etc/nginx/conf.d/default.conf',
        explanation: 'Redirect all HTTP requests to HTTPS with an HTTP 301 Permanent Redirect.',
        diff: ` server {
     listen 80;
     server_name app.yourdomain.com;
-    location / { proxy_pass http://localhost:3000; }
+    return 301 https://$host$request_uri;
 }`,
      },
    },
    cliVerification: 'curl -I http://YOUR_TARGET_URL | grep -E "(HTTP/|Location:)"',
  },

  'ZX-TLS-002': {
    ruleId: 'ZX-TLS-002',
    title: 'TLS Certificate Expiring Soon (< 14 Days)',
    summary: 'The X.509 TLS certificate for this domain will expire within 14 days, risking service outages and browser security warnings.',
    impact: 'Expired certificates break automated API clients and cause modern web browsers to display full-page security warnings that block users.',
    cwe: 'CWE-298: Impoprer Validation of Certificate Expiration',
    owasp: 'A02:2021-Cryptographic Failures',
    frameworks: {
      nginx: {
        filename: 'Certbot Automation',
        explanation: 'Trigger an immediate certificate renewal via Certbot and ensure the systemd renewal timer is active.',
        diff: `# Run manual renewal test
$ sudo certbot renew --dry-run

# Force renewal
$ sudo certbot renew --force-renewal
$ sudo systemctl reload nginx`,
      },
    },
    cliVerification: 'openssl s_client -connect YOUR_HOST:443 -servername YOUR_HOST < /dev/null 2>/dev/null | openssl x509 -noout -dates',
  },

  'ZX-TLS-003': {
    ruleId: 'ZX-TLS-003',
    title: 'Invalid or Untrusted TLS Certificate',
    summary: 'The presented TLS certificate is self-signed, expired, or issued by an untrusted Certificate Authority.',
    impact: 'Browsers reject connections to untrusted certificates. API integrations fail unless insecure flags (e.g. rejectUnauthorized: false) are dangerously enabled.',
    cwe: 'CWE-295: Improper Certificate Validation',
    owasp: 'A02:2021-Cryptographic Failures',
    frameworks: {
      nginx: {
        filename: '/etc/nginx/conf.d/ssl.conf',
        explanation: 'Replace self-signed or invalid certificates with a valid CA certificate (e.g. Let\'s Encrypt or Cloudflare Origin CA).',
        diff: ` server {
     listen 443 ssl http2;
-    ssl_certificate /etc/ssl/self-signed.crt;
-    ssl_certificate_key /etc/ssl/self-signed.key;
+    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
+    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
 }`,
      },
    },
    cliVerification: 'openssl s_client -connect YOUR_HOST:443 -servername YOUR_HOST -verify_return_error',
  },

  'ZX-TLS-004': {
    ruleId: 'ZX-TLS-004',
    title: 'Deprecated TLS 1.0 or 1.1 Protocol Enabled',
    summary: 'The web server allows legacy TLS 1.0 or 1.1 protocols which contain known cryptographic flaws (POODLE, BEAST).',
    impact: 'Legacy TLS versions use weak ciphers susceptible to downgrade and plaintext recovery attacks. Deprecated by PCI-DSS and major browsers.',
    cwe: 'CWE-326: Inadequate Encryption Strength',
    owasp: 'A02:2021-Cryptographic Failures',
    frameworks: {
      nginx: {
        filename: '/etc/nginx/conf.d/ssl.conf',
        explanation: 'Enforce modern TLS protocols (TLSv1.2 and TLSv1.3 only).',
        diff: ` server {
-    ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
+    ssl_protocols TLSv1.2 TLSv1.3;
+    ssl_prefer_server_ciphers off;
 }`,
      },
    },
    cliVerification: 'openssl s_client -connect YOUR_HOST:443 -tls1_1 2>&1 | grep -E "(handshake failure|protocol)"',
  },

  'ZX-TLS-005': {
    ruleId: 'ZX-TLS-005',
    title: 'Missing HTTP Strict Transport Security (HSTS) Header',
    summary: 'The server does not send the Strict-Transport-Security header to instruct browsers to interact exclusively over HTTPS.',
    impact: 'Leaves users vulnerable to SSL-stripping and man-in-the-middle attacks on the initial unencrypted HTTP connection.',
    cwe: 'CWE-523: Unprotected Transport-Layer Information',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      nextjs: {
        filename: 'next.config.mjs',
        explanation: 'Add Strict-Transport-Security header in Next.js security headers configuration.',
        diff: ` export default {
+  async headers() {
+    return [{
+      source: '/:path*',
+      headers: [{
+        key: 'Strict-Transport-Security',
+        value: 'max-age=31536000; includeSubDomains; preload',
+      }],
+    }];
+  },
 };`,
      },
      express: {
        filename: 'src/server.ts',
        explanation: 'Use Helmet to enforce HSTS in Express.',
        diff: ` import helmet from 'helmet';
-app.use(helmet());
+app.use(helmet.hsts({
+  maxAge: 31536000,
+  includeSubDomains: true,
+  preload: true,
+}));`,
      },
      nginx: {
        filename: '/etc/nginx/conf.d/ssl.conf',
        explanation: 'Add HSTS directive in Nginx SSL server block.',
        diff: ` server {
     listen 443 ssl http2;
+    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
 }`,
      },
    },
    cliVerification: 'curl -I https://YOUR_TARGET_URL | grep -i "strict-transport-security"',
  },

  'ZX-TLS-006': {
    ruleId: 'ZX-TLS-006',
    title: 'Short HSTS max-age Directive (< 6 Months)',
    summary: 'The HSTS max-age value is too short (under 15,724,800 seconds / 6 months), reducing browser enforcement persistence.',
    impact: 'Short HSTS lifetimes expire quickly on infrequent visits, leaving returning users vulnerable to network interception.',
    cwe: 'CWE-523: Unprotected Transport-Layer Information',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      nextjs: {
        filename: 'next.config.mjs',
        explanation: 'Increase HSTS max-age to 31,536,000 seconds (1 year).',
        diff: ` headers: [{
   key: 'Strict-Transport-Security',
-  value: 'max-age=86400',
+  value: 'max-age=31536000; includeSubDomains',
 }]`,
      },
    },
    cliVerification: 'curl -I https://YOUR_TARGET_URL | grep -i "strict-transport-security"',
  },

  // ==========================================
  // HTTP SECURITY HEADERS (ZX-HDR-*)
  // ==========================================
  'ZX-HDR-001': {
    ruleId: 'ZX-HDR-001',
    title: 'Missing Content-Security-Policy (CSP) Header',
    summary: 'No Content-Security-Policy header was detected on responses from the application.',
    impact: 'Increases risk of Cross-Site Scripting (XSS), malicious script injection, unauthorized iframe framing, and data exfiltration.',
    cwe: 'CWE-1021: Improper Restriction of Rendered UI Layers or Resources',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      nextjs: {
        filename: 'next.config.mjs',
        explanation: 'Define a secure default-src CSP policy in Next.js.',
        diff: ` export default {
+  async headers() {
+    return [{
+      source: '/:path*',
+      headers: [{
+        key: 'Content-Security-Policy',
+        value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';",
+      }],
+    }];
+  },
 };`,
      },
      express: {
        filename: 'src/server.ts',
        explanation: 'Deploy Content Security Policy using Helmet.',
        diff: ` import helmet from 'helmet';
+app.use(helmet.contentSecurityPolicy({
+  directives: {
+    defaultSrc: ["'self'"],
+    scriptSrc: ["'self'"],
+    styleSrc: ["'self'", "'unsafe-inline'"],
+    imgSrc: ["'self'", "data:", "https:"],
+    frameAncestors: ["'none'"],
+  },
+}));`,
      },
      nginx: {
        filename: '/etc/nginx/conf.d/default.conf',
        explanation: 'Set Content-Security-Policy response header.',
        diff: ` server {
+    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none';" always;
 }`,
      },
    },
    cliVerification: 'curl -I https://YOUR_TARGET_URL | grep -i "content-security-policy"',
  },

  'ZX-HDR-002': {
    ruleId: 'ZX-HDR-002',
    title: 'Permissive CSP Directives (unsafe-inline / unsafe-eval)',
    summary: 'Content-Security-Policy uses \'unsafe-inline\' or \'unsafe-eval\', significantly weakening XSS protections.',
    impact: 'Attackers can execute injected inline JavaScript payloads despite the presence of a CSP header.',
    cwe: 'CWE-1021: Improper Restriction of Rendered UI Layers',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      nextjs: {
        filename: 'src/middleware.ts',
        explanation: 'Generate cryptographic nonces for inline scripts instead of using unsafe-inline.',
        diff: `// src/middleware.ts
+import { NextRequest, NextResponse } from 'next/server';
+export function middleware(request: NextRequest) {
+  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
+  const cspHeader = \`default-src 'self'; script-src 'self' 'nonce-\${nonce}'; object-src 'none';\`;
+  const response = NextResponse.next();
+  response.headers.set('Content-Security-Policy', cspHeader);
+  return response;
+}`,
      },
    },
    cliVerification: 'curl -I https://YOUR_TARGET_URL | grep -i "content-security-policy"',
  },

  'ZX-HDR-003': {
    ruleId: 'ZX-HDR-003',
    title: 'Missing X-Content-Type-Options: nosniff Header',
    summary: 'The application is missing X-Content-Type-Options: nosniff on HTTP responses.',
    impact: 'Allows older browsers to MIME-sniff response content, potentially interpreting user-uploaded image or text files as executable scripts.',
    cwe: 'CWE-16: Configuration',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      nextjs: {
        filename: 'next.config.mjs',
        explanation: 'Add X-Content-Type-Options: nosniff.',
        diff: ` headers: [{
+  key: 'X-Content-Type-Options',
+  value: 'nosniff',
 }]`,
      },
      express: {
        filename: 'src/server.ts',
        explanation: 'Use helmet.noSniff() in Express.',
        diff: ` import helmet from 'helmet';
+app.use(helmet.noSniff());`,
      },
      nginx: {
        filename: '/etc/nginx/conf.d/default.conf',
        explanation: 'Add X-Content-Type-Options header.',
        diff: ` server {
+    add_header X-Content-Type-Options "nosniff" always;
 }`,
      },
    },
    cliVerification: 'curl -I https://YOUR_TARGET_URL | grep -i "x-content-type-options"',
  },

  'ZX-HDR-004': {
    ruleId: 'ZX-HDR-004',
    title: 'Missing Clickjacking Defense (X-Frame-Options / frame-ancestors)',
    summary: 'The application neither sends an X-Frame-Options header nor a CSP frame-ancestors directive.',
    impact: 'Attackers can embed the target site inside an invisible iframe on a malicious website to trick users into unintended clicks (Clickjacking).',
    cwe: 'CWE-1021: Improper Restriction of Rendered UI Layers',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      nextjs: {
        filename: 'next.config.mjs',
        explanation: 'Set X-Frame-Options to DENY or SAMEORIGIN.',
        diff: ` headers: [{
+  key: 'X-Frame-Options',
+  value: 'DENY',
 }]`,
      },
      express: {
        filename: 'src/server.ts',
        explanation: 'Set X-Frame-Options in Express with Helmet.',
        diff: ` import helmet from 'helmet';
+app.use(helmet.frameguard({ action: 'deny' }));`,
      },
      nginx: {
        filename: '/etc/nginx/conf.d/default.conf',
        explanation: 'Deny framing in Nginx.',
        diff: ` server {
+    add_header X-Frame-Options "DENY" always;
 }`,
      },
    },
    cliVerification: 'curl -I https://YOUR_TARGET_URL | grep -i -E "(x-frame-options|frame-ancestors)"',
  },

  'ZX-HDR-005': {
    ruleId: 'ZX-HDR-005',
    title: 'Missing or Permissive Referrer-Policy Header',
    summary: 'The application does not set a strict Referrer-Policy, potentially leaking internal URL paths and query parameters to external sites.',
    impact: 'Sensitive tokens, email addresses, or document IDs in query strings may be leaked to external analytics or third-party referrers.',
    cwe: 'CWE-200: Exposure of Sensitive Information',
    owasp: 'A01:2021-Broken Access Control',
    frameworks: {
      nextjs: {
        filename: 'next.config.mjs',
        explanation: 'Enforce strict-origin-when-cross-origin Referrer-Policy.',
        diff: ` headers: [{
+  key: 'Referrer-Policy',
+  value: 'strict-origin-when-cross-origin',
 }]`,
      },
      express: {
        filename: 'src/server.ts',
        explanation: 'Enforce Referrer-Policy with Helmet.',
        diff: `+app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));`,
      },
      nginx: {
        filename: '/etc/nginx/conf.d/default.conf',
        explanation: 'Add Referrer-Policy header.',
        diff: ` server {
+    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
 }`,
      },
    },
    cliVerification: 'curl -I https://YOUR_TARGET_URL | grep -i "referrer-policy"',
  },

  'ZX-HDR-006': {
    ruleId: 'ZX-HDR-006',
    title: 'Server and Framework Version Disclosure',
    summary: 'The application exposes server or runtime version information in Server or X-Powered-By response headers.',
    impact: 'Provides automated recon scanners with exact technology versions, facilitating targeted exploitation of unpatched CVEs.',
    cwe: 'CWE-200: Exposure of Sensitive Information',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      nextjs: {
        filename: 'next.config.mjs',
        explanation: 'Disable the X-Powered-By header in Next.js.',
        diff: ` export default {
+  poweredByHeader: false,
 };`,
      },
      express: {
        filename: 'src/server.ts',
        explanation: 'Disable X-Powered-By in Express.',
        diff: ` const app = express();
+app.disable('x-powered-by');`,
      },
      nginx: {
        filename: '/etc/nginx/nginx.conf',
        explanation: 'Hide Nginx version information.',
        diff: ` http {
+    server_tokens off;
 }`,
      },
    },
    cliVerification: 'curl -I https://YOUR_TARGET_URL | grep -i -E "(server:|x-powered-by:)"',
  },

  // ==========================================
  // CROSS-ORIGIN RESOURCE SHARING (ZX-CORS-*)
  // ==========================================
  'ZX-CORS-001': {
    ruleId: 'ZX-CORS-001',
    title: 'CORS Misconfiguration: Wildcard Origin with Credentials',
    summary: 'The CORS policy sets Access-Control-Allow-Origin: * alongside Access-Control-Allow-Credentials: true.',
    impact: 'Permits any third-party website to make authenticated credentialed requests to read private user data.',
    cwe: 'CWE-942: Permissive Cross-Domain Policy with Untrusted Domains',
    owasp: 'A01:2021-Broken Access Control',
    frameworks: {
      express: {
        filename: 'src/server.ts',
        explanation: 'Replace wildcard CORS origin with an explicit domain allowlist.',
        diff: ` import cors from 'cors';
-app.use(cors({ origin: '*', credentials: true }));
+const allowedOrigins = ['https://app.yourdomain.com'];
+app.use(cors({
+  origin: (origin, callback) => {
+    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
+    callback(new Error('Blocked by CORS'));
+  },
+  credentials: true,
+}));`,
      },
    },
    cliVerification: 'curl -I -H "Origin: https://evil.example.com" https://YOUR_TARGET_URL | grep -i -E "(access-control-allow-origin|access-control-allow-credentials)"',
  },

  'ZX-CORS-002': {
    ruleId: 'ZX-CORS-002',
    title: 'CORS Misconfiguration: Arbitrary Origin Reflection',
    summary: 'The server reflects whatever Origin header the client sends directly back into Access-Control-Allow-Origin with credentials allowed.',
    impact: 'Equivalent to a wildcard origin with credentials; any malicious site can steal session-protected data via cross-origin fetch.',
    cwe: 'CWE-942: Permissive Cross-Domain Policy with Untrusted Domains',
    owasp: 'A01:2021-Broken Access Control',
    frameworks: {
      express: {
        filename: 'src/middleware/cors.ts',
        explanation: 'Validate origin against a strict whitelist instead of blindly reflecting request header.',
        diff: `// src/middleware/cors.ts
-res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
-res.setHeader('Access-Control-Allow-Credentials', 'true');
+const ALLOWLIST = new Set(['https://app.yourdomain.com']);
+if (req.headers.origin && ALLOWLIST.has(req.headers.origin)) {
+  res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
+  res.setHeader('Access-Control-Allow-Credentials', 'true');
+}`,
      },
    },
    cliVerification: 'curl -I -H "Origin: https://attacker.example.com" https://YOUR_TARGET_URL | grep -i "access-control-allow-origin: https://attacker.example.com"',
  },

  'ZX-CORS-003': {
    ruleId: 'ZX-CORS-003',
    title: 'CORS Misconfiguration: Null Origin Reflection',
    summary: 'The server allows Access-Control-Allow-Origin: null with credentials.',
    impact: 'Sandboxed iframes or data: URIs produce a "null" origin and can be exploited to bypass origin policies and read responses.',
    cwe: 'CWE-942: Permissive Cross-Domain Policy with Untrusted Domains',
    owasp: 'A01:2021-Broken Access Control',
    frameworks: {
      express: {
        filename: 'src/server.ts',
        explanation: 'Explicitly reject "null" origin in CORS handler.',
        diff: ` app.use((req, res, next) => {
-  if (req.headers.origin === 'null') res.setHeader('Access-Control-Allow-Origin', 'null');
+  if (req.headers.origin === 'null') return next();
   next();
 });`,
      },
    },
    cliVerification: 'curl -I -H "Origin: null" https://YOUR_TARGET_URL | grep -i "access-control-allow-origin: null"',
  },

  // ==========================================
  // EXPOSED SECRETS & SOURCE CONTROL (ZX-SEC-*)
  // ==========================================
  'ZX-SEC-001': {
    ruleId: 'ZX-SEC-001',
    title: 'Exposed Environment Configuration File (.env)',
    summary: 'The environment configuration file (.env, .env.local, .env.production) is publicly accessible via direct HTTP GET.',
    impact: 'Catastrophic disclosure: contains production database credentials, API keys, JWT secrets, and payment tokens.',
    cwe: 'CWE-200: Exposure of Sensitive Information',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      nginx: {
        filename: '/etc/nginx/conf.d/default.conf',
        explanation: 'Block public access to all dotfiles and environment files in Nginx.',
        diff: ` server {
+    # Deny access to all hidden dotfiles (.env, .git, etc.)
+    location ~ /\\.(?!well-known) {
+        deny all;
+        return 404;
+    }
 }`,
      },
      nextjs: {
        filename: 'next.config.mjs',
        explanation: 'Never place .env files inside the public/ directory. Verify files are in the repository root.',
        diff: `# Ensure .env files are in the root directory and listed in .gitignore
# Remove any accidental copies from public/
$ git rm -f public/.env*`,
      },
    },
    cliVerification: 'curl -s -o /dev/null -w "%{http_code}" https://YOUR_TARGET_URL/.env',
  },

  'ZX-SEC-002': {
    ruleId: 'ZX-SEC-002',
    title: 'Exposed Git Repository Metadata (.git/HEAD)',
    summary: 'The .git metadata directory is publicly downloadable, allowing anyone to reconstruct the complete source code.',
    impact: 'Full source code exposure, including commit history, developer notes, previous credentials, and architectural secrets.',
    cwe: 'CWE-200: Exposure of Sensitive Information',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      nginx: {
        filename: '/etc/nginx/conf.d/default.conf',
        explanation: 'Block access to .git and all subpaths.',
        diff: ` server {
+    location ~ /\\.git {
+        deny all;
+        return 404;
+    }
 }`,
      },
    },
    cliVerification: 'curl -s -o /dev/null -w "%{http_code}" https://YOUR_TARGET_URL/.git/HEAD',
  },

  'ZX-SEC-003': {
    ruleId: 'ZX-SEC-003',
    title: 'Exposed Public API Specification File (openapi.json / swagger.json)',
    summary: 'Publicly readable OpenAPI or Swagger specification files were discovered on production endpoints.',
    impact: 'Maps internal API endpoints, administrative routes, schemas, and deprecated parameters for attackers to target.',
    cwe: 'CWE-200: Exposure of Sensitive Information',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      express: {
        filename: 'src/server.ts',
        explanation: 'Gate Swagger UI and API specifications behind authentication or disable in production.',
        diff: `// src/server.ts
-app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
+if (process.env.NODE_ENV !== 'production') {
+  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
+}`,
      },
    },
    cliVerification: 'curl -s -o /dev/null -w "%{http_code}" https://YOUR_TARGET_URL/openapi.json',
  },

  // ==========================================
  // COOKIE SECURITY (ZX-CKI-*)
  // ==========================================
  'ZX-CKI-001': {
    ruleId: 'ZX-CKI-001',
    title: 'Cookie Missing Secure Flag on HTTPS',
    summary: 'The application sets cookies over an HTTPS connection without the "Secure" flag.',
    impact: 'The cookie will be transmitted in cleartext if the user ever follows an http:// link or is subjected to an SSL-stripping attack.',
    cwe: 'CWE-614: Sensitive Cookie in HTTPS Session Without Secure Attribute',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      nextjs: {
        filename: 'src/app/api/auth/route.ts',
        explanation: 'Ensure the secure: true flag is enabled when setting cookies.',
        diff: ` cookies().set({
   name: 'session',
   value: token,
+  secure: process.env.NODE_ENV === 'production',
+  httpOnly: true,
+  sameSite: 'lax',
 });`,
      },
    },
    cliVerification: 'curl -I https://YOUR_TARGET_URL | grep -i "set-cookie"',
  },

  'ZX-CKI-002': {
    ruleId: 'ZX-CKI-002',
    title: 'Sensitive Session Cookie Missing HttpOnly Flag',
    summary: 'A session or authentication cookie is accessible to client-side JavaScript because the "HttpOnly" flag is omitted.',
    impact: 'If any XSS vulnerability exists on the origin, an attacker can directly steal session tokens via document.cookie.',
    cwe: 'CWE-1004: Sensitive Cookie Without HttpOnly Flag',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      express: {
        filename: 'src/server.ts',
        explanation: 'Set httpOnly: true on express-session or cookie-parser.',
        diff: ` app.use(session({
   cookie: {
+    httpOnly: true,
+    secure: true,
+    sameSite: 'lax',
   },
 }));`,
      },
    },
    cliVerification: 'curl -I https://YOUR_TARGET_URL | grep -i "set-cookie"',
  },

  'ZX-CKI-003': {
    ruleId: 'ZX-CKI-003',
    title: 'Cookie Missing SameSite Attribute',
    summary: 'Cookies do not specify a SameSite attribute (Strict, Lax, or None).',
    impact: 'Increases susceptibility to Cross-Site Request Forgery (CSRF) attacks in older browsers or non-GET cross-site navigations.',
    cwe: 'CWE-1275: Sensitive Cookie with Improper SameSite Attribute',
    owasp: 'A01:2021-Broken Access Control',
    frameworks: {
      nextjs: {
        filename: 'src/lib/auth.ts',
        explanation: 'Set sameSite: "lax" or "strict" on all cookies.',
        diff: ` cookies().set('auth_token', token, {
+  sameSite: 'lax',
   httpOnly: true,
   secure: true,
 });`,
      },
    },
    cliVerification: 'curl -I https://YOUR_TARGET_URL | grep -i "set-cookie"',
  },

  // ==========================================
  // AI CODE SMELLS & INFORMATION LEAKAGE (ZX-AI-*)
  // ==========================================
  'ZX-AI-001': {
    ruleId: 'ZX-AI-001',
    title: 'Stack Trace and Internal File Path Disclosure',
    summary: 'The application returns raw exception stack traces or absolute filesystem paths in error responses.',
    impact: 'Exposes local source code filenames, line numbers, third-party libraries, and internal variable names to potential attackers.',
    cwe: 'CWE-209: Generation of Error Message Containing Sensitive Information',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      express: {
        filename: 'src/middleware/error-handler.ts',
        explanation: 'Sanitize error responses and log stack traces internally instead of returning them to clients.',
        diff: `// src/middleware/error-handler.ts
 app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
-  res.status(500).json({ error: err.message, stack: err.stack });
+  console.error('[SERVER ERROR]', err);
+  res.status(500).json({ error: 'An unexpected internal error occurred.' });
 });`,
      },
      nextjs: {
        filename: 'src/app/error.tsx',
        explanation: 'Use Next.js Error Boundaries to present friendly user-facing messages in production.',
        diff: `// src/app/error.tsx
'use client';
export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
-     <pre>{error.stack}</pre>
+     <p>Our team has been notified. Please try again later.</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}`,
      },
    },
    cliVerification: 'curl -s https://YOUR_TARGET_URL/non-existent-route-404 | grep -i -E "(node_modules|at async|Traceback)"',
  },

  'ZX-AI-002': {
    ruleId: 'ZX-AI-002',
    title: 'GraphQL Introspection Enabled in Production',
    summary: 'The GraphQL API endpoint answers __schema and __type introspection queries in a production environment.',
    impact: 'Attackers can automatically download the entire GraphQL schema, discovering hidden queries, mutations, admin types, and sensitive fields.',
    cwe: 'CWE-200: Exposure of Sensitive Information',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      express: {
        filename: 'src/graphql/server.ts',
        explanation: 'Disable introspection in Apollo Server or Yoga in production.',
        diff: ` const server = new ApolloServer({
   typeDefs,
   resolvers,
-  introspection: true,
+  introspection: process.env.NODE_ENV !== 'production',
 });`,
      },
    },
    cliVerification: 'curl -X POST -H "Content-Type: application/json" -d \'{"query":"{ __schema { types { name } } }"}\' https://YOUR_TARGET_URL/graphql',
  },

  'ZX-AI-003': {
    ruleId: 'ZX-AI-003',
    title: 'Exposed Debug, Test, or Seed Route in Production',
    summary: 'Common development routes such as /api/debug, /api/test, /api/seed, or /debug were left active in production.',
    impact: 'Debug and test endpoints often bypass authentication, expose system environment variables, or allow test database resets.',
    cwe: 'CWE-489: Active Debug Code in Production',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      nextjs: {
        filename: 'src/app/api/debug/route.ts',
        explanation: 'Guard debug routes with NODE_ENV !== "production" or remove them entirely from production builds.',
        diff: ` export async function GET() {
+  if (process.env.NODE_ENV === 'production') {
+    return new Response('Not Found', { status: 404 });
+  }
   return Response.json({ debugInfo: true });
 }`,
      },
    },
    cliVerification: 'curl -s -o /dev/null -w "%{http_code}" https://YOUR_TARGET_URL/api/debug',
  },

  // ==========================================
  // ACTIVE SECURITY TESTING (ZX-ACT-*)
  // ==========================================
  'ZX-ACT-SQLI-001': {
    ruleId: 'ZX-ACT-SQLI-001',
    title: 'SQL Injection (SQLi) Vulnerability Detected',
    summary: 'Untrusted user input is directly concatenated or interpolated into a dynamic database query string, allowing remote attackers to alter query logic.',
    impact: 'Full database compromise, authentication bypass, data exfiltration, unauthorized modification or deletion of all database records.',
    cwe: 'CWE-89: Improper Neutralization of Special Elements used in an SQL Command',
    owasp: 'A03:2021-Injection',
    frameworks: {
      nextjs: {
        filename: 'src/app/api/users/route.ts',
        explanation: 'Replace dynamic string template concatenation with parameterized SQL bindings.',
        diff: ` export async function GET(request: Request) {
   const { searchParams } = new URL(request.url);
   const id = searchParams.get('id');
-  const result = await db.query(\`SELECT * FROM users WHERE id = '\${id}'\`);
+  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
   return Response.json(result.rows);
 }`,
      },
      express: {
        filename: 'src/routes/users.ts',
        explanation: 'Use parameterized queries with the node-postgres (pg) library or ORM.',
        diff: ` router.get('/users', async (req, res) => {
-  const { rows } = await pool.query(\`SELECT * FROM users WHERE email = '\${req.query.email}'\`);
+  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [req.query.email]);
   res.json(rows);
 });`,
      },
    },
    cliVerification: 'curl -s "https://YOUR_TARGET_URL/api/users?id=1%27"',
  },

  'ZX-ACT-XSS-001': {
    ruleId: 'ZX-ACT-XSS-001',
    title: 'Reflected Cross-Site Scripting (XSS) Vulnerability',
    summary: 'User-supplied query parameters are reflected back into the HTML response without contextual entity encoding or sanitization.',
    impact: 'Execution of arbitrary malicious JavaScript in victim browsers, session hijacking via stolen authentication tokens, and account takeover.',
    cwe: 'CWE-79: Improper Neutralization of Input During Web Page Generation',
    owasp: 'A03:2021-Injection',
    frameworks: {
      nextjs: {
        filename: 'src/app/search/page.tsx',
        explanation: 'Avoid dangerouslySetInnerHTML and use default JSX escaping for untrusted user inputs.',
        diff: ` export default function SearchPage({ searchParams }: { searchParams: { q: string } }) {
   return (
     <div>
-      <div dangerouslySetInnerHTML={{ __html: searchParams.q }} />
+      <div>{searchParams.q}</div>
     </div>
   );
 }`,
      },
      express: {
        filename: 'src/routes/search.ts',
        explanation: 'Contextually HTML entity-encode all user input before interpolating into HTML templates.',
        diff: `+import escapeHtml from 'escape-html';
 
 router.get('/search', (req, res) => {
-  res.send(\`<h1>Results for: \${req.query.q}</h1>\`);
+  res.send(\`<h1>Results for: \${escapeHtml(req.query.q as string)}</h1>\`);
 });`,
      },
    },
    cliVerification: 'curl -s "https://YOUR_TARGET_URL/search?q=%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E" | grep "<script>alert(1)</script>"',
  },

  'ZX-ACT-REDIR-001': {
    ruleId: 'ZX-ACT-REDIR-001',
    title: 'Unvalidated Open Redirect Vulnerability',
    summary: 'The application redirects users to destination URLs supplied via query parameters without validating against an allowed whitelist of internal paths.',
    impact: 'Attackers craft believable phishing links using your trusted domain to lure victims to malicious websites.',
    cwe: 'CWE-601: URL Redirection to Untrusted Site',
    owasp: 'A01:2021-Broken Access Control',
    frameworks: {
      nextjs: {
        filename: 'src/app/auth/callback/route.ts',
        explanation: 'Verify that the redirection target is a relative path starting with / and not //.',
        diff: ` export async function GET(request: Request) {
   const { searchParams } = new URL(request.url);
   const rawNext = searchParams.get('next') || '/dashboard';
-  return NextResponse.redirect(new URL(rawNext, request.url));
+  const safeNext = (rawNext.startsWith('/') && !rawNext.startsWith('//')) ? rawNext : '/dashboard';
+  return NextResponse.redirect(new URL(safeNext, request.url));
 }`,
      },
      express: {
        filename: 'src/routes/auth.ts',
        explanation: 'Enforce strict relative URL validation before issuing redirect responses.',
        diff: ` router.get('/login-return', (req, res) => {
-  res.redirect(req.query.redirect as string || '/');
+  const target = (req.query.redirect as string) || '/';
+  const isSafe = target.startsWith('/') && !target.startsWith('//');
+  res.redirect(isSafe ? target : '/');
 });`,
      },
    },
    cliVerification: 'curl -s -I "https://YOUR_TARGET_URL/login?redirect=https://example.com" | grep -i "Location:"',
  },

  'ZX-ACT-TRAV-001': {
    ruleId: 'ZX-ACT-TRAV-001',
    title: 'Path Traversal / Arbitrary File Read Vulnerability',
    summary: 'File path parameters accept dot-dot-slash sequence payloads (../ or ..\\), allowing remote attackers to traverse directory boundaries and read host operating system files.',
    impact: 'Exposure of sensitive host OS files (/etc/passwd, environment configs, SSH keys, application source code).',
    cwe: 'CWE-22: Improper Limitation of a Pathname to a Restricted Directory',
    owasp: 'A01:2021-Broken Access Control',
    frameworks: {
      nextjs: {
        filename: 'src/app/api/docs/route.ts',
        explanation: 'Normalize paths using path.resolve and verify they remain within the intended base directory.',
        diff: ` import path from 'path';
 import fs from 'fs/promises';
 
 export async function GET(request: Request) {
   const { searchParams } = new URL(request.url);
   const filename = searchParams.get('file') || 'readme.txt';
-  const filePath = path.join(BASE_DIR, filename);
-  const content = await fs.readFile(filePath, 'utf-8');
+  const resolvedPath = path.resolve(BASE_DIR, filename);
+  if (!resolvedPath.startsWith(BASE_DIR)) {
+    return new Response('Access Denied', { status: 403 });
+  }
+  const content = await fs.readFile(resolvedPath, 'utf-8');
   return new Response(content);
 }`,
      },
      express: {
        filename: 'src/routes/files.ts',
        explanation: 'Verify canonical path prefix before serving files from the filesystem.',
        diff: ` router.get('/download', (req, res) => {
-  res.sendFile(path.join(__dirname, 'public', req.query.file as string));
+  const safePath = path.resolve(__dirname, 'public', req.query.file as string);
+  if (!safePath.startsWith(path.resolve(__dirname, 'public'))) {
+    return res.status(403).send('Forbidden');
+  }
+  res.sendFile(safePath);
 });`,
      },
    },
    cliVerification: 'curl -s "https://YOUR_TARGET_URL/api/download?file=../../../../etc/passwd"',
  },
};

/**
 * Retrieve comprehensive remediation guidance for a specific rule ID.
 * Returns default fallback guidance if rule ID is not specifically indexed.
 */
export function getRemediationForRule(ruleId: string): RuleRemediation {
  if (REMEDIATION_CATALOG[ruleId]) {
    return REMEDIATION_CATALOG[ruleId];
  }

  // Deterministic fallback
  return {
    ruleId,
    title: `Remediation for ${ruleId}`,
    summary: 'Review server configuration and application code to adhere to the principle of least privilege and secure transport defaults.',
    impact: 'Unmitigated security misconfigurations can allow unauthorized resource access or information leakage.',
    cwe: 'CWE-16: Configuration',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {},
    cliVerification: `curl -I https://YOUR_TARGET_URL`,
  };
}
