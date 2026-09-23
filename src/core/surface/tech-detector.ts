import { TechnologyFingerprint, TechCategory, ConfidenceLevel } from './types';

export interface TechDetectionContext {
  headers?: Record<string, string | string[] | undefined>;
  body?: string;
  cookies?: string[];
  urlPaths?: string[];
}

interface TechSignature {
  name: string;
  category: TechCategory;
  detect: (ctx: TechDetectionContext) => {
    matched: boolean;
    version?: string | null;
    confidence: ConfidenceLevel;
    indicators: string[];
  } | null;
}

const SIGNATURES: TechSignature[] = [
  // 1. Next.js
  {
    name: 'Next.js',
    category: 'FRAMEWORK',
    detect: (ctx) => {
      const indicators: string[] = [];
      let version: string | null = null;
      let matched = false;

      const headers = ctx.headers || {};
      for (const [key, val] of Object.entries(headers)) {
        const k = key.toLowerCase();
        const v = Array.isArray(val) ? val.join(' ') : String(val || '');
        if (k === 'x-nextjs-cache' || k === 'x-nextjs-prerender' || k === 'x-nextjs-matched-path') {
          matched = true;
          indicators.push(`HTTP Header: ${key}`);
        }
        if (k === 'x-powered-by' && v.toLowerCase().includes('next.js')) {
          matched = true;
          indicators.push(`Header: X-Powered-By: ${v}`);
          const match = v.match(/next\.js\s*([\d.]+)/i);
          if (match && match[1]) version = match[1];
        }
      }

      const body = ctx.body || '';
      if (body.includes('id="__next"') || body.includes('id=\'__next\'')) {
        matched = true;
        indicators.push('HTML DOM element: <div id="__next">');
      }
      if (body.includes('/_next/static/') || body.includes('/_next/data/')) {
        matched = true;
        indicators.push('Static asset path: /_next/static/');
      }

      if (ctx.urlPaths) {
        if (ctx.urlPaths.some((p) => p.startsWith('/_next/'))) {
          matched = true;
          indicators.push('Discovered Next.js route: /_next/');
        }
      }

      if (!matched) return null;
      return {
        matched: true,
        version,
        confidence: indicators.length >= 2 ? 'HIGH' : 'MEDIUM',
        indicators,
      };
    },
  },

  // 2. React
  {
    name: 'React',
    category: 'FRAMEWORK',
    detect: (ctx) => {
      const indicators: string[] = [];
      const body = ctx.body || '';
      let matched = false;

      if (body.includes('data-reactroot')) {
        matched = true;
        indicators.push('DOM attribute: data-reactroot');
      }
      if (body.includes('react-dom') || body.includes('react.production.min.js')) {
        matched = true;
        indicators.push('Script bundle contains React runtime');
      }
      if (body.includes('/_next/')) {
        matched = true;
        indicators.push('Underlying React runtime detected via Next.js bundle');
      }

      if (!matched) return null;
      return {
        matched: true,
        version: null,
        confidence: indicators.length >= 2 ? 'HIGH' : 'MEDIUM',
        indicators,
      };
    },
  },

  // 3. Express
  {
    name: 'Express',
    category: 'FRAMEWORK',
    detect: (ctx) => {
      const indicators: string[] = [];
      let matched = false;

      const headers = ctx.headers || {};
      for (const [key, val] of Object.entries(headers)) {
        if (key.toLowerCase() === 'x-powered-by') {
          const v = Array.isArray(val) ? val.join(' ') : String(val || '');
          if (v.toLowerCase().includes('express')) {
            matched = true;
            indicators.push(`Header: X-Powered-By: ${v}`);
          }
        }
      }

      const cookies = ctx.cookies || [];
      if (cookies.some((c) => c.includes('connect.sid='))) {
        matched = true;
        indicators.push('Session cookie: connect.sid (express-session)');
      }

      if (!matched) return null;
      return {
        matched: true,
        version: null,
        confidence: 'HIGH',
        indicators,
      };
    },
  },

  // 4. Vercel
  {
    name: 'Vercel',
    category: 'CDN_WAF',
    detect: (ctx) => {
      const indicators: string[] = [];
      let matched = false;

      const headers = ctx.headers || {};
      for (const [key, val] of Object.entries(headers)) {
        const k = key.toLowerCase();
        if (k === 'x-vercel-id' || k === 'x-vercel-cache') {
          matched = true;
          const v = Array.isArray(val) ? val.join(' ') : String(val || '');
          indicators.push(`HTTP Header: ${key}: ${v.substring(0, 25)}...`);
        }
        if (k === 'server' && String(val || '').toLowerCase().includes('vercel')) {
          matched = true;
          indicators.push(`Server header: ${val}`);
        }
      }

      if (!matched) return null;
      return {
        matched: true,
        version: null,
        confidence: 'HIGH',
        indicators,
      };
    },
  },

  // 5. Cloudflare
  {
    name: 'Cloudflare',
    category: 'CDN_WAF',
    detect: (ctx) => {
      const indicators: string[] = [];
      let matched = false;

      const headers = ctx.headers || {};
      for (const [key, val] of Object.entries(headers)) {
        const k = key.toLowerCase();
        if (k === 'cf-ray' || k === 'cf-cache-status') {
          matched = true;
          indicators.push(`HTTP Header: ${key}`);
        }
        if (k === 'server' && String(val || '').toLowerCase().includes('cloudflare')) {
          matched = true;
          indicators.push('Server Header: cloudflare');
        }
      }

      if (!matched) return null;
      return {
        matched: true,
        version: null,
        confidence: 'HIGH',
        indicators,
      };
    },
  },

  // 6. Nginx
  {
    name: 'Nginx',
    category: 'SERVER',
    detect: (ctx) => {
      const indicators: string[] = [];
      let version: string | null = null;
      let matched = false;

      const headers = ctx.headers || {};
      for (const [key, val] of Object.entries(headers)) {
        if (key.toLowerCase() === 'server') {
          const v = Array.isArray(val) ? val.join(' ') : String(val || '');
          if (v.toLowerCase().includes('nginx')) {
            matched = true;
            indicators.push(`Server header: ${v}`);
            const match = v.match(/nginx\/([\d.]+)/i);
            if (match && match[1]) version = match[1];
          }
        }
      }

      if (!matched) return null;
      return {
        matched: true,
        version,
        confidence: 'HIGH',
        indicators,
      };
    },
  },

  // 7. Apache
  {
    name: 'Apache',
    category: 'SERVER',
    detect: (ctx) => {
      const indicators: string[] = [];
      let version: string | null = null;
      let matched = false;

      const headers = ctx.headers || {};
      for (const [key, val] of Object.entries(headers)) {
        if (key.toLowerCase() === 'server') {
          const v = Array.isArray(val) ? val.join(' ') : String(val || '');
          if (v.toLowerCase().includes('apache')) {
            matched = true;
            indicators.push(`Server header: ${v}`);
            const match = v.match(/apache\/([\d.]+)/i);
            if (match && match[1]) version = match[1];
          }
        }
      }

      if (!matched) return null;
      return {
        matched: true,
        version,
        confidence: 'HIGH',
        indicators,
      };
    },
  },

  // 8. Tailwind CSS
  {
    name: 'Tailwind CSS',
    category: 'AI_TOOLING',
    detect: (ctx) => {
      const body = ctx.body || '';
      const patterns = [
        /\b(?:flex\s+items-center|grid\s+grid-cols-|text-(?:sm|md|lg|xl)\s+font-)/,
        /\b(?:bg-(?:slate|neutral|zinc|gray|indigo|blue|red)-(?:100|200|500|600|700|800|900))/,
        /\b(?:px-\d\s+py-\d|rounded-(?:md|lg|xl|2xl|full))\b/,
      ];

      let matches = 0;
      for (const pat of patterns) {
        if (pat.test(body)) matches++;
      }

      if (matches >= 2) {
        return {
          matched: true,
          version: null,
          confidence: matches === 3 ? 'HIGH' : 'MEDIUM',
          indicators: [`Utility class patterns matched in HTML (${matches}/3 indicators)`],
        };
      }

      return null;
    },
  },

  // 9. Supabase
  {
    name: 'Supabase',
    category: 'DATABASE',
    detect: (ctx) => {
      const body = ctx.body || '';
      const cookies = ctx.cookies || [];
      const indicators: string[] = [];
      let matched = false;

      if (body.includes('@supabase/supabase-js') || body.includes('supabase.co')) {
        matched = true;
        indicators.push('Client bundle reference: supabase.co endpoint');
      }

      if (cookies.some((c) => c.includes('sb-') && c.includes('-auth-token'))) {
        matched = true;
        indicators.push('Supabase authentication cookie: sb-*-auth-token');
      }

      if (!matched) return null;
      return {
        matched: true,
        version: null,
        confidence: 'HIGH',
        indicators,
      };
    },
  },
];

export function detectTechnologies(ctx: TechDetectionContext): TechnologyFingerprint[] {
  const results: TechnologyFingerprint[] = [];

  for (const sig of SIGNATURES) {
    const outcome = sig.detect(ctx);
    if (outcome && outcome.matched) {
      results.push({
        category: sig.category,
        name: sig.name,
        version: outcome.version ?? null,
        confidence: outcome.confidence,
        matchedIndicators: outcome.indicators,
      });
    }
  }

  return results;
}
