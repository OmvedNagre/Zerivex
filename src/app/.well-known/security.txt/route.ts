import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const SECURITY_TXT_CONTENT = `# RFC 9116 Coordinated Vulnerability Disclosure Policy for ZERIVEX
Contact: mailto:security@zerivex.com
Expires: 2028-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: https://zerivex.com/.well-known/security.txt
Policy: https://zerivex.com/security
Acknowledgments: https://zerivex.com/security/hall-of-fame
Hiring: https://zerivex.com/careers
`;

export async function GET() {
  return new NextResponse(SECURITY_TXT_CONTENT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
