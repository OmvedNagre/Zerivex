-- ============================================================================
-- Migration 009: User Profiles and Onboarding State
-- Schema definition for user personas, customization goals, and onboarding flags
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  persona TEXT CHECK (persona IN ('STUDENT', 'SOLO_BUILDER', 'FREELANCER_AGENCY', 'STARTUP_FOUNDER', 'COMPANY_TEAM')),
  goals TEXT[] DEFAULT '{}',
  built_with TEXT[] DEFAULT '{}',
  stack TEXT[] DEFAULT '{}',
  team_size TEXT,
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_skipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_persona ON user_profiles(persona);
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding ON user_profiles(onboarding_completed_at, onboarding_skipped_at);
