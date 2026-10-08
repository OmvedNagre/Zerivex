import { query } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';
import {
  UserProfile,
  Persona,
  VALID_PERSONAS,
  VALID_GOALS,
  VALID_BUILD_TOOLS,
  VALID_STACKS,
} from './types';

export interface UserProfileUpdateInput {
  displayName?: string | null;
  persona?: Persona | null;
  goals?: string[];
  builtWith?: string[];
  stack?: string[];
  teamSize?: string | null;
  onboardingCompleted?: boolean;
  onboardingSkipped?: boolean;
}

export function validateProfileInput(input: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
  sanitized: UserProfileUpdateInput;
} {
  const errors: string[] = [];
  const sanitized: UserProfileUpdateInput = {};

  // Check unknown fields
  const allowedKeys = new Set([
    'displayName',
    'persona',
    'goals',
    'builtWith',
    'stack',
    'teamSize',
    'onboardingCompleted',
    'onboardingSkipped',
  ]);

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown field "${key}" is not permitted.`);
    }
  }

  // 1. displayName
  if (input.displayName !== undefined) {
    if (input.displayName === null) {
      sanitized.displayName = null;
    } else if (typeof input.displayName === 'string') {
      const trimmed = input.displayName.trim();
      if (trimmed.length > 100) {
        errors.push('displayName cannot exceed 100 characters.');
      } else {
        sanitized.displayName = trimmed;
      }
    } else {
      errors.push('displayName must be a string or null.');
    }
  }

  // 2. persona
  if (input.persona !== undefined) {
    if (input.persona === null) {
      sanitized.persona = null;
    } else if (typeof input.persona === 'string') {
      if (!VALID_PERSONAS.includes(input.persona as Persona)) {
        errors.push(
          `Invalid persona "${input.persona}". Must be one of: ${VALID_PERSONAS.join(', ')}.`
        );
      } else {
        sanitized.persona = input.persona as Persona;
      }
    } else {
      errors.push('persona must be a valid string identifier or null.');
    }
  }

  // 3. goals
  if (input.goals !== undefined) {
    if (Array.isArray(input.goals)) {
      const filteredGoals: string[] = [];
      for (const g of input.goals) {
        if (typeof g === 'string') {
          const upper = g.trim().toUpperCase();
          if (VALID_GOALS.includes(upper)) {
            filteredGoals.push(upper);
          } else {
            errors.push(`Invalid goal "${g}". Must be one of: ${VALID_GOALS.join(', ')}.`);
          }
        }
      }
      sanitized.goals = Array.from(new Set(filteredGoals));
    } else {
      errors.push('goals must be an array of goal identifiers.');
    }
  }

  // 4. builtWith
  if (input.builtWith !== undefined) {
    if (Array.isArray(input.builtWith)) {
      const filteredTools: string[] = [];
      for (const t of input.builtWith) {
        if (typeof t === 'string') {
          const upper = t.trim().toUpperCase();
          if (VALID_BUILD_TOOLS.includes(upper)) {
            filteredTools.push(upper);
          } else {
            errors.push(`Invalid tool "${t}". Must be one of: ${VALID_BUILD_TOOLS.join(', ')}.`);
          }
        }
      }
      sanitized.builtWith = Array.from(new Set(filteredTools));
    } else {
      errors.push('builtWith must be an array of tool identifiers.');
    }
  }

  // 5. stack
  if (input.stack !== undefined) {
    if (Array.isArray(input.stack)) {
      const filteredStack: string[] = [];
      for (const s of input.stack) {
        if (typeof s === 'string') {
          const upper = s.trim().toUpperCase();
          if (VALID_STACKS.includes(upper)) {
            filteredStack.push(upper);
          } else {
            errors.push(`Invalid stack "${s}". Must be one of: ${VALID_STACKS.join(', ')}.`);
          }
        }
      }
      sanitized.stack = Array.from(new Set(filteredStack));
    } else {
      errors.push('stack must be an array of stack identifiers.');
    }
  }

  // 6. teamSize
  if (input.teamSize !== undefined) {
    if (input.teamSize === null) {
      sanitized.teamSize = null;
    } else if (typeof input.teamSize === 'string') {
      const trimmed = input.teamSize.trim();
      if (trimmed.length > 50) {
        errors.push('teamSize cannot exceed 50 characters.');
      } else {
        sanitized.teamSize = trimmed;
      }
    } else {
      errors.push('teamSize must be a string or null.');
    }
  }

  // 7. Onboarding flags
  if (input.onboardingCompleted !== undefined) {
    sanitized.onboardingCompleted = Boolean(input.onboardingCompleted);
  }
  if (input.onboardingSkipped !== undefined) {
    sanitized.onboardingSkipped = Boolean(input.onboardingSkipped);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const res = await query<UserProfile>(
    `
    SELECT
      user_id as "userId",
      display_name as "displayName",
      persona,
      goals,
      built_with as "builtWith",
      stack,
      team_size as "teamSize",
      onboarding_completed_at as "onboardingCompletedAt",
      onboarding_skipped_at as "onboardingSkippedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM user_profiles
    WHERE user_id = $1
    `,
    [userId]
  );

  return res.rows[0] || null;
}

export async function upsertUserProfile(
  userId: string,
  input: UserProfileUpdateInput,
  organizationId?: string
): Promise<UserProfile> {
  const existing = await getUserProfile(userId);

  const displayName = input.displayName !== undefined ? input.displayName : existing?.displayName ?? null;
  const persona = input.persona !== undefined ? input.persona : existing?.persona ?? null;
  const goals = input.goals !== undefined ? input.goals : existing?.goals ?? [];
  const builtWith = input.builtWith !== undefined ? input.builtWith : existing?.builtWith ?? [];
  const stack = input.stack !== undefined ? input.stack : existing?.stack ?? [];
  const teamSize = input.teamSize !== undefined ? input.teamSize : existing?.teamSize ?? null;

  let onboardingCompletedAt = existing?.onboardingCompletedAt ?? null;
  if (input.onboardingCompleted) {
    onboardingCompletedAt = new Date();
  }

  let onboardingSkippedAt = existing?.onboardingSkippedAt ?? null;
  if (input.onboardingSkipped) {
    onboardingSkippedAt = new Date();
  }

  const res = await query<UserProfile>(
    `
    INSERT INTO user_profiles (
      user_id,
      display_name,
      persona,
      goals,
      built_with,
      stack,
      team_size,
      onboarding_completed_at,
      onboarding_skipped_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      persona = EXCLUDED.persona,
      goals = EXCLUDED.goals,
      built_with = EXCLUDED.built_with,
      stack = EXCLUDED.stack,
      team_size = EXCLUDED.team_size,
      onboarding_completed_at = COALESCE(EXCLUDED.onboarding_completed_at, user_profiles.onboarding_completed_at),
      onboarding_skipped_at = COALESCE(EXCLUDED.onboarding_skipped_at, user_profiles.onboarding_skipped_at),
      updated_at = NOW()
    RETURNING
      user_id as "userId",
      display_name as "displayName",
      persona,
      goals,
      built_with as "builtWith",
      stack,
      team_size as "teamSize",
      onboarding_completed_at as "onboardingCompletedAt",
      onboarding_skipped_at as "onboardingSkippedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    `,
    [
      userId,
      displayName,
      persona,
      goals,
      builtWith,
      stack,
      teamSize,
      onboardingCompletedAt,
      onboardingSkippedAt,
    ]
  );

  const updated = res.rows[0]!;

  // Audit event (Privacy strict: field names only, NO free-text PII in payload)
  const updatedFieldNames = Object.keys(input).filter((k) => input[k as keyof UserProfileUpdateInput] !== undefined);
  await recordAuditEvent({
    organizationId: organizationId ?? null,
    actorUserId: userId,
    action: 'PROFILE_UPDATED',
    resourceType: 'user_profile',
    resourceId: userId,
    metadata: {
      updatedFields: updatedFieldNames,
      persona: updated.persona,
      hasCompletedOnboarding: Boolean(updated.onboardingCompletedAt),
      hasSkippedOnboarding: Boolean(updated.onboardingSkippedAt),
    },
  });

  return updated;
}
