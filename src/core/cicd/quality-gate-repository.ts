/**
 * Multi-Tenant Quality Gate Policy Repository
 */

import { query } from '@/core/db/database';
import { QualityGatePolicy, DEFAULT_QUALITY_GATE_POLICY } from '@/core/cicd/quality-gate-engine';

export async function getEffectiveQualityGatePolicy(
  organizationId: string,
  targetId?: string | null
): Promise<QualityGatePolicy> {
  // 1. Check for target-specific override
  if (targetId) {
    const targetRes = await query<{
      id: string;
      organization_id: string;
      target_id: string | null;
      name: string;
      min_security_score: number;
      fail_on_critical: boolean;
      max_high_findings: number;
      max_medium_findings: number;
      fail_on_new_findings: boolean;
      is_default: boolean;
    }>(
      `
      SELECT *
      FROM quality_gate_policies
      WHERE organization_id = $1 AND target_id = $2
      LIMIT 1
      `,
      [organizationId, targetId]
    );

    if (targetRes.rows.length > 0) {
      const row = targetRes.rows[0]!;
      return {
        id: row.id,
        organizationId: row.organization_id,
        targetId: row.target_id,
        name: row.name,
        minSecurityScore: row.min_security_score,
        failOnCritical: row.fail_on_critical,
        maxHighFindings: row.max_high_findings,
        maxMediumFindings: row.max_medium_findings,
        failOnNewFindings: row.fail_on_new_findings,
        isDefault: row.is_default,
      };
    }
  }

  // 2. Check for organization default policy
  const orgRes = await query<{
    id: string;
    organization_id: string;
    target_id: string | null;
    name: string;
    min_security_score: number;
    fail_on_critical: boolean;
    max_high_findings: number;
    max_medium_findings: number;
    fail_on_new_findings: boolean;
    is_default: boolean;
  }>(
    `
    SELECT *
    FROM quality_gate_policies
    WHERE organization_id = $1 AND target_id IS NULL AND is_default = true
    LIMIT 1
    `,
    [organizationId]
  );

  if (orgRes.rows.length > 0) {
    const row = orgRes.rows[0]!;
    return {
      id: row.id,
      organizationId: row.organization_id,
      targetId: row.target_id,
      name: row.name,
      minSecurityScore: row.min_security_score,
      failOnCritical: row.fail_on_critical,
      maxHighFindings: row.max_high_findings,
      maxMediumFindings: row.max_medium_findings,
      failOnNewFindings: row.fail_on_new_findings,
      isDefault: row.is_default,
    };
  }

  // 3. Fall back to standard defaults
  return {
    ...DEFAULT_QUALITY_GATE_POLICY,
    organizationId,
    targetId: targetId ?? null,
  };
}

export async function upsertQualityGatePolicy(
  policy: Omit<QualityGatePolicy, 'id'>
): Promise<QualityGatePolicy> {
  const res = await query<{
    id: string;
    organization_id: string;
    target_id: string | null;
    name: string;
    min_security_score: number;
    fail_on_critical: boolean;
    max_high_findings: number;
    max_medium_findings: number;
    fail_on_new_findings: boolean;
    is_default: boolean;
  }>(
    `
    INSERT INTO quality_gate_policies (
      organization_id,
      target_id,
      name,
      min_security_score,
      fail_on_critical,
      max_high_findings,
      max_medium_findings,
      fail_on_new_findings,
      is_default
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (organization_id, target_id) DO UPDATE
    SET
      name = EXCLUDED.name,
      min_security_score = EXCLUDED.min_security_score,
      fail_on_critical = EXCLUDED.fail_on_critical,
      max_high_findings = EXCLUDED.max_high_findings,
      max_medium_findings = EXCLUDED.max_medium_findings,
      fail_on_new_findings = EXCLUDED.fail_on_new_findings,
      is_default = EXCLUDED.is_default,
      updated_at = NOW()
    RETURNING *
    `,
    [
      policy.organizationId,
      policy.targetId ?? null,
      policy.name,
      policy.minSecurityScore,
      policy.failOnCritical,
      policy.maxHighFindings,
      policy.maxMediumFindings,
      policy.failOnNewFindings,
      policy.isDefault ?? false,
    ]
  );

  const row = res.rows[0]!;
  return {
    id: row.id,
    organizationId: row.organization_id,
    targetId: row.target_id,
    name: row.name,
    minSecurityScore: row.min_security_score,
    failOnCritical: row.fail_on_critical,
    maxHighFindings: row.max_high_findings,
    maxMediumFindings: row.max_medium_findings,
    failOnNewFindings: row.fail_on_new_findings,
    isDefault: row.is_default,
  };
}
