import net from 'net';

/**
 * CIDR Block definition for SSRF prevention.
 */
interface CidrBlock {
  network: number[];
  maskBits: number;
  description: string;
}

/**
 * Parse an IPv4 string into 4 octets.
 */
function parseIpv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const num = parseInt(part, 10);
    if (num < 0 || num > 255) return null;
    octets.push(num);
  }
  return octets;
}

/**
 * Check if an IPv4 address falls within a CIDR range.
 */
function isIpv4InCidr(octets: number[], block: CidrBlock): boolean {
  const ipInt = (octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!;
  const netInt =
    (block.network[0]! << 24) |
    (block.network[1]! << 16) |
    (block.network[2]! << 8) |
    block.network[3]!;
  const mask = block.maskBits === 0 ? 0 : (~0 << (32 - block.maskBits));
  return (ipInt & mask) === (netInt & mask);
}

/**
 * Prohibited IPv4 CIDRs:
 * - 0.0.0.0/8 (Current network)
 * - 10.0.0.0/8 (RFC 1918 Private)
 * - 100.64.0.0/10 (RFC 6598 Carrier-Grade NAT)
 * - 127.0.0.0/8 (Loopback)
 * - 169.254.0.0/16 (Link-Local, includes 169.254.169.254 Cloud Metadata)
 * - 172.16.0.0/12 (RFC 1918 Private)
 * - 192.0.0.0/24 (IETF Protocol Assignments)
 * - 192.0.2.0/24 (TEST-NET-1)
 * - 192.88.99.0/24 (6to4 Relay Anycast)
 * - 192.168.0.0/16 (RFC 1918 Private)
 * - 198.18.0.0/15 (Network Interconnect Benchmark)
 * - 198.51.100.0/24 (TEST-NET-2)
 * - 203.0.113.0/24 (TEST-NET-3)
 * - 224.0.0.0/4 (Multicast)
 * - 240.0.0.0/4 (Reserved / Future)
 * - 255.255.255.255/32 (Broadcast)
 */
const PROHIBITED_IPV4_CIDRS: CidrBlock[] = [
  { network: [0, 0, 0, 0], maskBits: 8, description: 'Current network' },
  { network: [10, 0, 0, 0], maskBits: 8, description: 'RFC 1918 Private' },
  { network: [100, 64, 0, 0], maskBits: 10, description: 'Carrier-Grade NAT' },
  { network: [127, 0, 0, 0], maskBits: 8, description: 'Loopback' },
  { network: [169, 254, 0, 0], maskBits: 16, description: 'Link-Local & Cloud Metadata' },
  { network: [172, 16, 0, 0], maskBits: 12, description: 'RFC 1918 Private' },
  { network: [192, 0, 0, 0], maskBits: 24, description: 'IETF Protocol Assignments' },
  { network: [192, 0, 2, 0], maskBits: 24, description: 'TEST-NET-1' },
  { network: [192, 88, 99, 0], maskBits: 24, description: '6to4 Relay' },
  { network: [192, 168, 0, 0], maskBits: 16, description: 'RFC 1918 Private' },
  { network: [198, 18, 0, 0], maskBits: 15, description: 'Benchmark' },
  { network: [198, 51, 100, 0], maskBits: 24, description: 'TEST-NET-2' },
  { network: [203, 0, 113, 0], maskBits: 24, description: 'TEST-NET-3' },
  { network: [224, 0, 0, 0], maskBits: 4, description: 'Multicast' },
  { network: [240, 0, 0, 0], maskBits: 4, description: 'Reserved' },
  { network: [255, 255, 255, 255], maskBits: 32, description: 'Broadcast' },
];

/**
 * Check whether an IP string is a prohibited private, loopback, or metadata address.
 * Fails closed: if the IP is invalid or cannot be parsed, it is treated as prohibited.
 */
export function isProhibitedIpAddress(ip: string): { prohibited: boolean; reason?: string } {
  const cleanIp = ip.trim().toLowerCase();

  // Check IPv4
  if (net.isIPv4(cleanIp)) {
    const octets = parseIpv4(cleanIp);
    if (!octets) {
      return { prohibited: true, reason: 'Malformed IPv4 address' };
    }

    for (const block of PROHIBITED_IPV4_CIDRS) {
      if (isIpv4InCidr(octets, block)) {
        return { prohibited: true, reason: `Matches prohibited IP range: ${block.description}` };
      }
    }

    return { prohibited: false };
  }

  // Check IPv6
  if (net.isIPv6(cleanIp)) {
    // Loopback
    if (cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1') {
      return { prohibited: true, reason: 'IPv6 Loopback' };
    }
    // Unspecified
    if (cleanIp === '::' || cleanIp === '0:0:0:0:0:0:0:0') {
      return { prohibited: true, reason: 'IPv6 Unspecified address' };
    }
    // Unique Local Address (fc00::/7)
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) {
      return { prohibited: true, reason: 'IPv6 Unique Local Address (RFC 4193)' };
    }
    // Link-Local (fe80::/10)
    if (
      cleanIp.startsWith('fe8') ||
      cleanIp.startsWith('fe9') ||
      cleanIp.startsWith('fea') ||
      cleanIp.startsWith('feb')
    ) {
      return { prohibited: true, reason: 'IPv6 Link-Local address' };
    }
    // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
    if (cleanIp.startsWith('::ffff:')) {
      const embeddedIpv4 = cleanIp.slice(7);
      return isProhibitedIpAddress(embeddedIpv4);
    }

    return { prohibited: false };
  }

  return { prohibited: true, reason: 'Unrecognized IP format' };
}

/**
 * Validate that a hostname does not resolve to localhost or known loopback names.
 */
export function isProhibitedHostname(hostname: string): { prohibited: boolean; reason?: string } {
  const cleanHost = hostname.trim().toLowerCase();

  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost === '127.0.0.1' ||
    cleanHost === '::1' ||
    cleanHost === 'metadata.google.internal' ||
    cleanHost === 'instance-data'
  ) {
    return { prohibited: true, reason: 'Reserved local/internal hostname' };
  }

  return { prohibited: false };
}
