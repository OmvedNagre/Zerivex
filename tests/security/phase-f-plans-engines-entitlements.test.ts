import { describe, it, expect } from 'vitest';
import {
  PLANS,
  PLAN_RANK,
  resolvePlanId,
} from '@/core/billing/types';
import {
  SCAN_ENGINES,
  ROADMAP_ENGINES,
  TOTAL_ENGINES_COUNT,
  enginesForPlan,
  planEnginePreview,
} from '@/core/scanner/engine-registry';
import {
  resolveEntitlementsFromPlan,
  resolveEntitlements,
} from '@/core/billing/entitlement-service';
import { SessionContext } from '@/core/auth/session-service';
import { adaptPlans, adaptEntitlementError } from '@/adapters/adapters';

describe('Phase F: Single Plan Config, Engine Registry & Entitlements (§F1–F5)', () => {
  describe('F1. Single Plan Config & Canonical Hierarchy', () => {
    it('defines the 4 canonical plans with strict PLAN_RANK hierarchy', () => {
      expect(PLAN_RANK.STARTER).toBe(1);
      expect(PLAN_RANK.PRO).toBe(2);
      expect(PLAN_RANK.TEAM).toBe(3);
      expect(PLAN_RANK.ENTERPRISE).toBe(4);

      expect(PLAN_RANK.STARTER).toBeLessThan(PLAN_RANK.PRO);
      expect(PLAN_RANK.PRO).toBeLessThan(PLAN_RANK.TEAM);
      expect(PLAN_RANK.TEAM).toBeLessThan(PLAN_RANK.ENTERPRISE);
    });

    it('resolves legacy aliases to the merged modern plans', () => {
      expect(resolvePlanId('FREE_DEVELOPER')).toBe('STARTER');
      expect(resolvePlanId('STARTER')).toBe('STARTER');
      expect(resolvePlanId('TEAM_PRO')).toBe('TEAM');
      expect(resolvePlanId('PRO')).toBe('PRO');
      expect(resolvePlanId('TEAM')).toBe('TEAM');
      expect(resolvePlanId('ENTERPRISE')).toBe('ENTERPRISE');
      expect(resolvePlanId(null)).toBe('STARTER');
      expect(resolvePlanId(undefined)).toBe('STARTER');
    });

    it('enforces Starter at ₹0 with 7 passive engines and 8 monthly scans', () => {
      const starter = PLANS.STARTER;
      expect(starter.pricing.monthlyInr).toBe(0);
      expect(starter.pricing.yearlyInr).toBe(0);
      expect(starter.limits.maxSites).toBe(1);
      expect(starter.limits.maxMonthlyScans).toBe(8);
      expect(starter.limits.maxTeamMembers).toBe(1);
      expect(starter.limits.historyDays).toBe(30);
      expect(starter.limits.crawl.enabled).toBe(false);
      expect(starter.limits.fixRetestDailyCapPerFinding).toBe(10);
      expect(starter.features.fixDiffs).toBe(true);
      expect(starter.features.fixRetests).toBe(true);
      expect(starter.features.activeVerifiedTests).toBe(false);
      expect(starter.features.ciGates).toBe(false);
    });

    it('enforces Pro at ₹1,499 with all 14 engines and active testing enabled', () => {
      const pro = PLANS.PRO;
      expect(pro.pricing.monthlyInr).toBe(1499);
      expect(pro.pricing.yearlyInr).toBe(14990);
      expect(pro.limits.maxSites).toBe(3);
      expect(pro.limits.maxMonthlyScans).toBe(50);
      expect(pro.limits.maxTeamMembers).toBe(3);
      expect(pro.limits.historyDays).toBe(90);
      expect(pro.limits.crawl.enabled).toBe(true);
      expect(pro.features.activeVerifiedTests).toBe(true);
      expect(pro.features.scheduledScans).toBe(true);
      expect(pro.features.ciGates).toBe(false);
    });

    it('enforces Team at ₹4,999 with CI/CD gates, SARIF and audit vault', () => {
      const team = PLANS.TEAM;
      expect(team.pricing.monthlyInr).toBe(4999);
      expect(team.pricing.yearlyInr).toBe(49990);
      expect(team.limits.maxSites).toBe(15);
      expect(team.limits.maxMonthlyScans).toBe(250);
      expect(team.limits.maxTeamMembers).toBe(10);
      expect(team.features.ciGates).toBe(true);
      expect(team.features.sarif).toBe(true);
      expect(team.features.webhooks).toBe(true);
      expect(team.features.apiKeys).toBe(true);
      expect(team.features.auditVault).toBe(true);
    });
  });

  describe('F2. Scanner Engine Registry Source of Truth', () => {
    it('defines exactly 14 canonical engines', () => {
      expect(SCAN_ENGINES).toHaveLength(14);
      expect(TOTAL_ENGINES_COUNT).toBe(14);
    });

    it('allocates exactly 7 passive engines to Starter', () => {
      const starterEngines = enginesForPlan('STARTER');
      expect(starterEngines).toHaveLength(7);
      expect(starterEngines.every((e) => e.class === 'PASSIVE')).toBe(true);
      expect(starterEngines.every((e) => e.minPlan === 'STARTER')).toBe(true);
      expect(starterEngines.map((e) => e.id)).toEqual([
        'check-tls',
        'check-headers',
        'check-cookies',
        'check-cors',
        'check-exposed-secrets',
        'check-security-txt',
        'check-ai-code-smells',
      ]);
    });

    it('allocates all 14 engines to Pro, Team and Enterprise', () => {
      expect(enginesForPlan('PRO')).toHaveLength(14);
      expect(enginesForPlan('TEAM')).toHaveLength(14);
      expect(enginesForPlan('ENTERPRISE')).toHaveLength(14);
    });

    it('keeps 4 active engines requiring verified ownership', () => {
      const activeEngines = SCAN_ENGINES.filter((e) => e.class === 'ACTIVE');
      expect(activeEngines).toHaveLength(4);
      expect(activeEngines.map((e) => e.id)).toEqual([
        'check-sqli',
        'check-xss',
        'check-open-redirect',
        'check-path-traversal',
      ]);
      expect(activeEngines.every((e) => e.needsVerifiedOwnership)).toBe(true);
      expect(activeEngines.every((e) => e.minPlan === 'PRO')).toBe(true);
    });

    it('maintains 3 roadmap engines strictly as COMING_SOON without counting them in 14', () => {
      expect(ROADMAP_ENGINES).toHaveLength(3);
      expect(ROADMAP_ENGINES.every((e) => e.status === 'COMING_SOON')).toBe(true);
      expect(ROADMAP_ENGINES.map((e) => e.id)).toEqual([
        'check-api-schema-fuzzing',
        'check-authenticated-sessions',
        'check-ai-repo-analysis',
      ]);
    });

    it('enforces precedence rule: PLAN FIRST over VERIFICATION in planEnginePreview', () => {
      // 1. Starter tier with unverified target:
      // Active engines are blocked by PLAN first, not verification!
      const starterPreview = planEnginePreview('STARTER', { targetVerified: false });
      const sqliOnStarter = starterPreview.find((p) => p.engine.id === 'check-sqli')!;
      expect(sqliOnStarter.status).toBe('LOCKED_BY_PLAN');
      expect(sqliOnStarter.lockedBy).toBe('PLAN');
      expect(sqliOnStarter.requiredPlan).toBe('PRO');
      expect(sqliOnStarter.alsoRequiresVerification).toBe(true);

      // 2. Pro tier with unverified target:
      // Active engines are blocked by VERIFICATION
      const proUnverifiedPreview = planEnginePreview('PRO', { targetVerified: false });
      const sqliOnProUnverified = proUnverifiedPreview.find((p) => p.engine.id === 'check-sqli')!;
      expect(sqliOnProUnverified.status).toBe('LOCKED_UNVERIFIED');
      expect(sqliOnProUnverified.lockedBy).toBe('VERIFICATION');
      expect(sqliOnProUnverified.requiredPlan).toBeUndefined();

      // 3. Pro tier with verified target:
      // Active engines are AVAILABLE
      const proVerifiedPreview = planEnginePreview('PRO', { targetVerified: true });
      const sqliOnProVerified = proVerifiedPreview.find((p) => p.engine.id === 'check-sqli')!;
      expect(sqliOnProVerified.status).toBe('AVAILABLE');
      expect(sqliOnProVerified.lockedBy).toBeNull();
    });
  });

  describe('F3. Central Entitlement Resolver', () => {
    it('resolves limits, features and engines for any plan tier synchronously', () => {
      const starterEnt = resolveEntitlementsFromPlan('STARTER');
      expect(starterEnt.planId).toBe('STARTER');
      expect(starterEnt.limits.maxMonthlyScans).toBe(8);
      expect(starterEnt.engineIds).toHaveLength(7);
      expect(starterEnt.features.activeVerifiedTests).toBe(false);

      const proEnt = resolveEntitlementsFromPlan('PRO');
      expect(proEnt.planId).toBe('PRO');
      expect(proEnt.limits.maxMonthlyScans).toBe(50);
      expect(proEnt.engineIds).toHaveLength(14);
      expect(proEnt.features.activeVerifiedTests).toBe(true);
      expect(proEnt.features.ciGates).toBe(false);

      const teamEnt = resolveEntitlementsFromPlan('TEAM');
      expect(teamEnt.planId).toBe('TEAM');
      expect(teamEnt.limits.maxMonthlyScans).toBe(250);
      expect(teamEnt.engineIds).toHaveLength(14);
      expect(teamEnt.features.ciGates).toBe(true);
      expect(teamEnt.features.auditVault).toBe(true);
    });

    it('resolves staff session overrides correctly', async () => {
      // 1. Staff Support session without preview plan inherits Pro
      const supportSession: SessionContext = {
        sessionId: 'sess-support-1',
        user: {
          id: 'user-support-1',
          email: 'support@example.test',
          displayName: 'Support Agent',
          avatarUrl: null,
          role: 'USER',
          status: 'ACTIVE',
        },
        organizationId: 'org-internal',
        organizationRole: 'ORG_MEMBER',
        expiresAt: new Date(Date.now() + 3600000),
        viaStaffPortal: true,
        staffRole: 'STAFF_SUPPORT',
        previewPlanId: null,
      };

      const supportEnt = await resolveEntitlements(null, supportSession);
      expect(supportEnt.isStaffOverride).toBe(true);
      expect(supportEnt.planId).toBe('PRO');
      expect(supportEnt.engineIds).toHaveLength(14);
      expect(supportEnt.features.ciGates).toBe(false);

      // 2. Staff Support previewing Starter
      const previewStarterSession: SessionContext = {
        ...supportSession,
        previewPlanId: 'STARTER',
      };
      const previewEnt = await resolveEntitlements(null, previewStarterSession);
      expect(previewEnt.isStaffOverride).toBe(true);
      expect(previewEnt.planId).toBe('STARTER');
      expect(previewEnt.engineIds).toHaveLength(7);
      expect(previewEnt.features.activeVerifiedTests).toBe(false);

      // 3. Staff Owner session receives Enterprise
      const ownerSession: SessionContext = {
        ...supportSession,
        staffRole: 'STAFF_OWNER',
        previewPlanId: null,
      };
      const ownerEnt = await resolveEntitlements(null, ownerSession);
      expect(ownerEnt.isStaffOverride).toBe(true);
      expect(ownerEnt.planId).toBe('ENTERPRISE');
      expect(ownerEnt.limits.maxSites).toBe(999999);
    });
  });

  describe('F4 & F5. UI Adapters & Quota Context Updates', () => {
    it('adapts plans dynamically without hardcoded pricing in JSX', () => {
      const adapted = adaptPlans('STARTER');
      expect(adapted).toHaveLength(4);

      const starterCard = adapted[0]!;
      const proCard = adapted[1]!;
      const teamCard = adapted[2]!;

      expect(starterCard.id).toBe('STARTER');
      expect(starterCard.formattedMonthlyPrice).toBe('₹0');
      expect(starterCard.cta.label).toBe('Your Current Plan');

      expect(proCard.id).toBe('PRO');
      expect(proCard.formattedMonthlyPrice).toBe('₹1,499/mo');
      expect(proCard.cta.label).toBe('Upgrade to Pro');
      expect(proCard.highlighted).toBe(true);

      expect(teamCard.id).toBe('TEAM');
      expect(teamCard.formattedMonthlyPrice).toBe('₹4,999/mo');
      expect(teamCard.cta.label).toBe('Upgrade to Team');
    });

    it('generates contextual upgrade nudge when hitting limits', () => {
      const scanNudge = adaptEntitlementError('SCAN_LIMIT_REACHED', 'reached monthly scan allocation');
      expect(scanNudge.attempted).toBe('Launch Vulnerability Scan');
      expect(scanNudge.requiredPlanId).toBe('PRO');
      expect(scanNudge.severity).toBe('blocked');
      expect(scanNudge.benefit).toContain('Unlock 50 monthly scans');

      const targetNudge = adaptEntitlementError('TARGET_LIMIT_REACHED', 'verified target limit');
      expect(targetNudge.attempted).toBe('Register Additional Target');
      expect(targetNudge.requiredPlanId).toBe('PRO');
      expect(targetNudge.benefit).toContain('Monitor up to 3 verified targets');
    });
  });
});
