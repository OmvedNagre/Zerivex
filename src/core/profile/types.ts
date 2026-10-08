export type Persona =
  | 'STUDENT'
  | 'SOLO_BUILDER'
  | 'FREELANCER_AGENCY'
  | 'STARTUP_FOUNDER'
  | 'COMPANY_TEAM';

export type UserGoal =
  | 'CHECK_APP'
  | 'LEARN_SECURITY'
  | 'PROTECT_CLIENTS'
  | 'SETUP_CI_GATE'
  | 'SHOW_COMPLIANCE';

export interface UserProfile {
  userId: string;
  displayName: string | null;
  persona: Persona | null;
  goals: string[];
  builtWith: string[];
  stack: string[];
  teamSize: string | null;
  onboardingCompletedAt: Date | null;
  onboardingSkippedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const VALID_PERSONAS: readonly Persona[] = [
  'STUDENT',
  'SOLO_BUILDER',
  'FREELANCER_AGENCY',
  'STARTUP_FOUNDER',
  'COMPANY_TEAM',
];

export const VALID_GOALS: readonly string[] = [
  'CHECK_APP',
  'LEARN_SECURITY',
  'PROTECT_CLIENTS',
  'SETUP_CI_GATE',
  'SHOW_COMPLIANCE',
];

export const VALID_BUILD_TOOLS: readonly string[] = [
  'CURSOR',
  'LOVABLE',
  'V0',
  'BOLT',
  'CLAUDE_CODE',
  'HAND_CODED',
  'OTHER',
];

export const VALID_STACKS: readonly string[] = [
  'NEXTJS',
  'EXPRESS',
  'NGINX',
  'OTHER',
];
