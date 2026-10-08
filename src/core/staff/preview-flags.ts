/**
 * Phase D-2: Internal Preview-Flag Scaffold
 * Strictly scoped to staff sessions operating within the internal organization.
 * Ships with an empty flag list. No mock or fake features are created.
 */

export type PreviewFlag = string;

export interface PreviewFlagsConfig {
  [key: string]: boolean;
}

/**
 * Empty flag list shipped for future internal experimental feature gates.
 */
export const PREVIEW_FLAGS: PreviewFlagsConfig = {};

/**
 * Returns available preview flags strictly for authenticated staff on internal workspaces.
 */
export function previewFlagsFor(session?: {
  isStaff?: boolean;
  isInternalOrg?: boolean;
} | null): PreviewFlagsConfig {
  if (!session || !session.isStaff || !session.isInternalOrg) {
    return {};
  }

  return { ...PREVIEW_FLAGS };
}

/**
 * Checks whether a specific preview flag is active for the current context.
 */
export function isPreviewFlagActive(
  flag: PreviewFlag,
  session?: { isStaff?: boolean; isInternalOrg?: boolean } | null
): boolean {
  if (!session || !session.isStaff || !session.isInternalOrg) {
    return false;
  }

  return Boolean(PREVIEW_FLAGS[flag]);
}
