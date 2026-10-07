/**
 * ZERIVEX DESIGN SYSTEM ADAPTER LAYER (Backend-Agnostic)
 * 
 * Rules:
 * 1. Adapters are pure functions that translate raw backend/catalog data
 *    into stable component props.
 * 2. Never throw on missing data. Use optional chaining and sensible fallbacks.
 * 3. Components never receive raw backend entities directly.
 */

import { AcademyArticle } from '@/core/academy/types';
import { PLANS, PlanDefinition, PlanId } from '@/core/billing/types';

// ============================================================================
// Types & Data Contracts
// ============================================================================

export interface AnnouncementBarProps {
  id: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
  dismissible?: boolean;
}

export interface NavLinkItem {
  label: string;
  href: string;
  description?: string;
  badge?: string;
  iconName?: string;
}

export interface NavGroup {
  heading?: string;
  links: NavLinkItem[];
}

export interface NavItem {
  label: string;
  href?: string;
  groups?: NavGroup[];
  promo?: {
    title: string;
    description?: string;
    ctaLabel: string;
    ctaHref: string;
  };
}

export interface HeroProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  badgeText?: string;
}

export interface PromoBlockItem {
  id: string;
  title: string;
  body: string;
  cta: { label: string; href: string };
  badge?: string;
  highlight?: string;
}

export interface LogoItem {
  name: string;
  category?: string;
  status?: string;
}

export interface SolutionItem {
  id: string;
  eyebrow?: string;
  title: string;
  description: string;
  features?: string[];
  ctaLabel?: string;
  ctaHref?: string;
  badge?: string;
  accent?: string;
  rulePrefix?: string;
}

export interface StatItem {
  value: number | string;
  label: string;
  description?: string;
  unit?: string;
  prefix?: string;
  suffix?: string;
}

export interface LeaderboardRow {
  id: string;
  rank: number;
  name: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  speedMs: number;
  statusText: string;
  ruleCount: number;
  verified: boolean;
  coveragePercent: number;
  complianceRule: string;
}

export interface ResourceCardProps {
  id: string;
  slug: string;
  title: string;
  category: string;
  trackId: string;
  summary: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedReadMinutes: number;
  tags?: string[];
  cweId?: string;
  href: string;
  readTime?: string;
  excerpt?: string;
}

export interface FooterColumn {
  heading: string;
  links: Array<{ label: string; href: string; external?: boolean; badge?: string }>;
}

export interface CtaBannerProps {
  eyebrow?: string;
  title: string;
  body: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

export interface TestimonialProps {
  quote: string;
  author: {
    name: string;
    role: string;
    company: string;
    initials: string;
  };
  metric: {
    value: string;
    label: string;
  };
}

export interface AdaptedPlanCard {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  formattedMonthlyPrice: string;
  formattedAnnualPrice: string;
  annualSavingsText: string;
  highlighted: boolean;
  limits: {
    apps: number;
    scans: number;
    members: number;
  };
  features: Array<{ text: string; enabled: boolean; comingSoon?: boolean }>;
  cta: {
    label: string;
    href: string;
    variant: 'brand' | 'secondary' | 'ghost';
  };
}

export interface UpgradeNudgeData {
  attempted: string;
  reason: string;
  requiredPlanId: string;
  benefit: string;
  secondaryHref?: string;
  severity: 'soft' | 'blocked';
}

// ============================================================================
// Pure Adapter Functions
// ============================================================================

export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function adaptPlans(
  currentPlanId?: string,
  isAnnual = false
): AdaptedPlanCard[] {
  const planKeys: PlanId[] = ['FREE_DEVELOPER', 'TEAM_PRO', 'ENTERPRISE'];

  return planKeys.map((key) => {
    const p: PlanDefinition = PLANS[key];
    const isCurrent = currentPlanId === p.id;
    const isPopular = p.badge === 'MOST POPULAR';

    const monthlyPrice = p.pricing.monthlyInr;
    const annualPrice = p.pricing.yearlyInr;
    const annualSavings = monthlyPrice * 12 - annualPrice;
    const annualSavingsText = annualSavings > 0 ? `Save ${formatCurrencyINR(annualSavings)}/yr` : '';

    const featuresList = [
      { text: `${p.limits.maxVerifiedTargets} Monitored Target${p.limits.maxVerifiedTargets > 1 ? 's' : ''}`, enabled: true },
      { text: `${p.limits.maxMonthlyScans} Scans per month`, enabled: true },
      { text: `${p.limits.maxTeamMembers} Team member${p.limits.maxTeamMembers > 1 ? 's' : ''}`, enabled: true },
      { text: 'Deterministic vulnerability scanner (14 checks)', enabled: true },
      { text: 'Multi-framework code diffs & targeted fix verifier', enabled: true },
      { text: 'Continuous monitoring & regression alerts', enabled: p.features.continuousMonitoring },
      { text: 'CI/CD quality gates & OASIS SARIF v2.1.0', enabled: p.features.cicdIntegrations },
      { text: 'Tamper-evident compliance audit vault', enabled: p.features.complianceAuditVault },
      { text: 'Authenticated security scanning', enabled: false, comingSoon: true },
      { text: 'Repository & dependency analysis', enabled: false, comingSoon: true },
    ];

    let ctaLabel = 'Start Free Scan';
    let ctaVariant: 'brand' | 'secondary' | 'ghost' = 'secondary';

    if (p.id === 'FREE_DEVELOPER') {
      ctaLabel = isCurrent ? 'Your Current Plan' : 'Start Free Scan';
      ctaVariant = 'secondary';
    } else if (p.id === 'TEAM_PRO') {
      ctaLabel = isCurrent ? 'Your Current Plan' : 'Upgrade to Team Pro';
      ctaVariant = 'brand';
    } else if (p.id === 'ENTERPRISE') {
      ctaLabel = isCurrent ? 'Your Current Plan' : 'Talk to Security Team';
      ctaVariant = 'secondary';
    }

    return {
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      monthlyPrice,
      annualPrice,
      currency: p.pricing.currency,
      formattedMonthlyPrice: monthlyPrice === 0 ? '₹0' : `${formatCurrencyINR(monthlyPrice)}/mo`,
      formattedAnnualPrice: annualPrice === 0 ? '₹0' : `${formatCurrencyINR(Math.round(annualPrice / 12))}/mo`,
      annualSavingsText,
      highlighted: isPopular,
      limits: {
        apps: p.limits.maxVerifiedTargets,
        scans: p.limits.maxMonthlyScans,
        members: p.limits.maxTeamMembers,
      },
      features: featuresList,
      cta: {
        label: ctaLabel,
        href: `/pricing?plan=${p.id}&cycle=${isAnnual ? 'YEARLY' : 'MONTHLY'}`,
        variant: ctaVariant,
      },
    };
  });
}

export function adaptEntitlementError(
  errCode: string,
  errMsg?: string
): UpgradeNudgeData {
  if (errCode === 'TARGET_LIMIT_REACHED' || errMsg?.includes('verified target limit')) {
    return {
      attempted: 'Register Additional Target',
      reason: errMsg || 'Your current plan has reached its verified target limit.',
      requiredPlanId: 'TEAM_PRO',
      benefit: 'Monitor up to 5 verified targets with automated continuous perimeter scanning.',
      severity: 'blocked',
    };
  }

  if (errCode === 'SCAN_LIMIT_REACHED' || errMsg?.includes('monthly scan allocation')) {
    return {
      attempted: 'Launch Vulnerability Scan',
      reason: errMsg || 'You have used all included scans for your current billing cycle.',
      requiredPlanId: 'TEAM_PRO',
      benefit: 'Unlock 250 monthly scans, active vulnerability probes, and CI/CD quality gates.',
      severity: 'blocked',
    };
  }

  return {
    attempted: 'Access Advanced Capability',
    reason: errMsg || 'This feature requires an upgraded subscription tier.',
    requiredPlanId: 'TEAM_PRO',
    benefit: 'Get automated multi-framework fix verification, CI/CD gates, and monitoring alerts.',
    severity: 'soft',
  };
}

export function adaptArticlesToResources(
  articles: AcademyArticle[],
  limit = 6
): ResourceCardProps[] {
  if (!articles || !Array.isArray(articles)) return [];

  return articles.slice(0, limit).map((a) => toResourceCard(a));
}

export function toResourceCard(article: AcademyArticle): ResourceCardProps {
  return {
    id: article.id || article.slug,
    slug: article.slug,
    title: article.title,
    category: article.category?.replace(/_/g, ' ') || 'General',
    trackId: article.trackId,
    summary: article.summary,
    difficulty: article.difficulty,
    estimatedReadMinutes: article.estimatedReadMinutes,
    tags: article.tags,
    cweId: article.cweId,
    href: `/academy/${article.slug}`,
    readTime: `${article.estimatedReadMinutes} min read`,
    excerpt: article.summary,
  };
}

export function adaptSolutionsFromChecks(): SolutionItem[] {
  return [
    {
      id: 'sol-secrets',
      eyebrow: 'CREDENTIAL SAFETY',
      title: 'Exposed Secrets & API Keys in Client Bundles',
      description: 'Systematically detects raw Stripe secret keys, AWS tokens, and OpenAI credentials baked into client-side JS bundles by AI code tools.',
      features: ['Client bundle AST scanning', 'Deterministic regex signatures', 'Zero synthetic false positives'],
      badge: 'CRITICAL',
      accent: 'var(--sev-critical)',
      rulePrefix: 'ZX-SEC-*',
      ctaLabel: 'Inspect rule',
      ctaHref: '/academy/client-side-secret-leakage',
    },
    {
      id: 'sol-headers',
      eyebrow: 'PERIMETER HARDENING',
      title: 'Defensive Security Headers & Transport Encryption',
      description: 'Audits HSTS, CSP, X-Frame-Options, and TLS configurations to protect users from downgrade attacks and clickjacking.',
      features: ['RFC 6797 HSTS verification', 'Clickjacking header audit', 'Cleartext HTTP redirect check'],
      badge: 'HIGH',
      accent: 'var(--sev-high)',
      rulePrefix: 'ZX-HDR-*',
      ctaLabel: 'Inspect rule',
      ctaHref: '/academy/essential-security-headers',
    },
    {
      id: 'sol-injection',
      eyebrow: 'INPUT SANITIZATION',
      title: 'SQL Injection, XSS & Path Traversal Probes',
      description: 'Verifies server resistance to parameterized injection attacks, blind SQL payloads, and DOM hydration breakouts.',
      features: ['Active non-destructive SQLi probes', 'React hydration XSS detection', 'Ownership-gated active testing'],
      badge: 'CRITICAL',
      accent: 'var(--sev-critical)',
      rulePrefix: 'ZX-ACT-*',
      ctaLabel: 'Inspect rule',
      ctaHref: '/academy/sql-injection-modern-orms',
    },
    {
      id: 'sol-cors',
      eyebrow: 'API INTEGRITY',
      title: 'Overly Permissive CORS & Cookie Configurations',
      description: 'Flags wildcard CORS origins paired with credentials, null origin acceptance, and cookies missing Secure or HttpOnly flags.',
      features: ['Origin reflection tests', 'Cookie SameSite/Secure verification', 'Credential leakage prevention'],
      badge: 'MEDIUM',
      accent: 'var(--sev-medium)',
      rulePrefix: 'ZX-CORS-*',
      ctaLabel: 'Inspect rule',
      ctaHref: '/academy/overly-permissive-cors',
    },
  ];
}

export function toSolutionsCatalog(): SolutionItem[] {
  return adaptSolutionsFromChecks();
}

export function adaptStats(
  checkEnginesCount = 14,
  fixRecipesCount = 31,
  ownershipMethodsCount = 4,
  academyGuidesCount = 10
): StatItem[] {
  return [
    {
      value: checkEnginesCount,
      label: 'Deterministic Check Engines',
      description: 'Zero synthetic false positives across active and passive batteries',
    },
    {
      value: `${fixRecipesCount}+`,
      label: 'Multi-Framework Fix Recipes',
      description: 'Exact before/after patches for Next.js, Express, and Nginx',
    },
    {
      value: ownershipMethodsCount,
      label: 'Ownership Challenge Methods',
      description: 'Cryptographic DNS TXT, HTTP header, HTML meta, and file verification',
    },
    {
      value: academyGuidesCount,
      label: 'Interactive Security Playbooks',
      description: 'Curated developer guides covering AI coding pitfalls and defenses',
    },
  ];
}

export function toStatsRow(): StatItem[] {
  return adaptStats();
}

export function toLeaderboardRows(): LeaderboardRow[] {
  return [
    {
      id: 'lb-1',
      rank: 1,
      name: 'Client Bundle Secrets Leakage',
      category: 'Exposed Secrets',
      severity: 'CRITICAL',
      speedMs: 14,
      statusText: '100% Deterministic Detection',
      ruleCount: 3,
      verified: true,
      coveragePercent: 100,
      complianceRule: 'CWE-798 Hardcoded Credentials',
    },
    {
      id: 'lb-2',
      rank: 2,
      name: 'Blind & Error-Based SQL Injection',
      category: 'Injection Defenses',
      severity: 'CRITICAL',
      speedMs: 28,
      statusText: 'Active Probing With Redaction',
      ruleCount: 4,
      verified: true,
      coveragePercent: 98,
      complianceRule: 'CWE-89 SQL Injection',
    },
    {
      id: 'lb-3',
      rank: 3,
      name: 'Missing RFC 6797 Strict-Transport-Security',
      category: 'Security Headers',
      severity: 'HIGH',
      speedMs: 8,
      statusText: 'Passive Header Analysis',
      ruleCount: 6,
      verified: true,
      coveragePercent: 100,
      complianceRule: 'RFC 6797 HSTS Policy',
    },
    {
      id: 'lb-4',
      rank: 4,
      name: 'Overly Permissive CORS Origin Reflection',
      category: 'CORS & APIs',
      severity: 'MEDIUM',
      speedMs: 12,
      statusText: 'Origin Reflection Test',
      ruleCount: 2,
      verified: true,
      coveragePercent: 95,
      complianceRule: 'CWE-942 Permissive CORS',
    },
  ];
}
