/**
 * ZERIVEX Central Display-Name and Label Definitions
 * Section 8: Display-name maps live in one labels.ts.
 */

export const SCAN_MODE_LABELS: Record<string, string> = {
  PUBLIC_PASSIVE: 'Passive',
  VERIFIED_ACTIVE: 'Active (verified)',
  CI_GATE: 'CI Gate',
};

export const SCAN_STATUS_LABELS: Record<string, string> = {
  QUEUED: 'In progress',
  RUNNING: 'In progress',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

export const SCAN_FILTER_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'IN_PROGRESS', label: 'In progress' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'FAILED', label: 'Failed' },
] as const;

export const ORG_ROLE_LABELS: Record<string, string> = {
  ORG_OWNER: 'Workspace owner',
  ORG_ADMIN: 'Admin',
  ORG_MEMBER: 'Member',
  ORG_VIEWER: 'Viewer',
  ORG_AUDITOR: 'Auditor',
  // Backward compatibility aliases if any raw strings exist
  OWNER: 'Workspace owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
  AUDITOR: 'Auditor',
};

export const FINDING_SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Info',
};

export const FINDING_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  CONFIRMED: 'Confirmed',
  FALSE_POSITIVE: 'False Positive',
  ACCEPTED_RISK: 'Accepted Risk',
  FIXED: 'Fixed',
  REOPENED: 'Reopened',
};

export const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  VERIFIED: 'Verified',
  PENDING: 'Pending',
  UNVERIFIED: 'Unverified',
  REVOKED: 'Revoked',
};

export const VERIFICATION_METHOD_LABELS: Record<string, string> = {
  DNS_TXT: 'DNS TXT Record',
  HTTP_HEADER: 'HTTP Custom Header',
  HTML_META: 'HTML Meta Tag',
  FILE_UPLOAD: 'Well-Known File',
};

export function getScanModeLabel(mode: string): string {
  return SCAN_MODE_LABELS[mode] || mode;
}

export function getScanStatusLabel(status: string): string {
  return SCAN_STATUS_LABELS[status] || status;
}

export function getOrgRoleLabel(role?: string | null): string {
  if (!role) return 'Member';
  return ORG_ROLE_LABELS[role] || role;
}

export function getFindingSeverityLabel(sev: string): string {
  return FINDING_SEVERITY_LABELS[sev] || sev;
}

export function getFindingStatusLabel(status: string): string {
  return FINDING_STATUS_LABELS[status] || status;
}
