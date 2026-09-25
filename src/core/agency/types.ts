/**
 * Core Types & Interfaces for Phase 12: Teams & Agencies
 * Agency Workflows, Multi-Client Architecture & White-Label Reporting
 */

export type AgencyClientStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type ClientGrantRole = 'CLIENT_VIEWER' | 'CLIENT_MANAGER';

export interface AgencyBrandingRecord {
  id: string;
  organizationId: string;
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  reportFooterText: string | null;
  supportEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgencyBrandingInput {
  companyName: string;
  logoUrl?: string | null;
  primaryColor?: string;
  reportFooterText?: string | null;
  supportEmail?: string | null;
}

export interface AgencyClientRecord {
  id: string;
  agencyOrganizationId: string;
  clientOrganizationId: string;
  clientName: string;
  accountManagerUserId: string | null;
  accountManagerName?: string | null;
  status: AgencyClientStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  targetCount: number;
  scanCount: number;
  latestSecurityScore: number | null;
  criticalFindingsCount: number;
  highFindingsCount: number;
}

export interface CreateAgencyClientInput {
  agencyOrganizationId: string;
  clientName: string;
  clientSlug?: string;
  accountManagerUserId?: string | null;
  notes?: string | null;
  actorUserId: string;
}

export interface AgencyClientGrantRecord {
  id: string;
  relationshipId: string;
  userId: string;
  userEmail: string;
  role: ClientGrantRole;
  createdAt: Date;
}

export interface AgencyPortfolioSummary {
  agencyOrganizationId: string;
  agencyName: string;
  isAgency: boolean;
  totalClients: number;
  totalTargets: number;
  totalScans: number;
  meanSecurityScore: number;
  totalCriticalFindings: number;
  totalHighFindings: number;
  clients: AgencyClientRecord[];
  branding: AgencyBrandingRecord | null;
}
