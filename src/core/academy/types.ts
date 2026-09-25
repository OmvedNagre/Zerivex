/**
 * Type definitions for Zerivex Security Academy & Knowledge Hub (Phase 13)
 */

export type AcademyCategory =
  | 'AI_CODE_SMELLS'
  | 'API_SECURITY'
  | 'INJECTION_DEFENSES'
  | 'AUTHENTICATION_SESSION'
  | 'INFRASTRUCTURE_HEADERS';

export type DifficultyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export type LearningTrackId =
  | 'ai-code-smells'
  | 'api-modern-web'
  | 'injection-sanitization'
  | 'identity-rbac-tenancy';

export type SupportedFramework = 'nextjs' | 'express' | 'nginx' | 'fastify' | 'general';

export interface FrameworkSnippet {
  framework: SupportedFramework;
  filename: string;
  code: string;
  explanation: string;
}

export interface CliVerificationCommand {
  tool: 'curl' | 'openssl' | 'nmap';
  command: string;
  expectedOutput: string;
  description: string;
}

export interface AcademyArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: AcademyCategory;
  trackId: LearningTrackId;
  difficulty: DifficultyLevel;
  estimatedReadMinutes: number;
  cweId?: string;
  owaspCategory?: string;
  relatedRuleIds: string[];
  aiPitfallDescription: string;
  vulnerabilityAnalysis: string;
  badCodeExample: {
    code: string;
    explanation: string;
    language?: string;
  };
  remediationSnippets: FrameworkSnippet[];
  cliVerification: CliVerificationCommand[];
  checklist: string[];
  tags: string[];
  publishedAt: string;
  updatedAt: string;
}

export interface LearningTrack {
  id: LearningTrackId;
  title: string;
  description: string;
  icon: string;
  articleSlugs: string[];
}

export interface AcademySearchQuery {
  query?: string;
  category?: AcademyCategory;
  trackId?: LearningTrackId;
  difficulty?: DifficultyLevel;
  tag?: string;
  ruleId?: string;
  limit?: number;
  offset?: number;
}

export interface AcademySearchResult {
  total: number;
  limit: number;
  offset: number;
  articles: AcademyArticleSummary[];
  tracks: LearningTrack[];
  categories: { category: AcademyCategory; count: number }[];
}

export type AcademyArticleSummary = Pick<
  AcademyArticle,
  | 'id'
  | 'slug'
  | 'title'
  | 'summary'
  | 'category'
  | 'trackId'
  | 'difficulty'
  | 'estimatedReadMinutes'
  | 'cweId'
  | 'owaspCategory'
  | 'relatedRuleIds'
  | 'tags'
  | 'updatedAt'
>;
