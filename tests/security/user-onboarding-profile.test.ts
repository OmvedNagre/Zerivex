import { describe, it, expect } from 'vitest';
import { validateProfileInput } from '@/core/profile/profile-service';
import { adaptPersonaDefaults } from '@/adapters/dashboard-adapters';

describe('Phase B: User Onboarding & Profile Validation', () => {
  describe('Input Validation & Sanitization', () => {
    it('accepts valid profile update with whitelisted enum values', () => {
      const input = {
        displayName: 'Security Lead',
        persona: 'SOLO_BUILDER',
        goals: ['CHECK_APP', 'SETUP_CI_GATE'],
        builtWith: ['CURSOR', 'LOVABLE'],
        stack: ['NEXTJS'],
        teamSize: '1-5 engineers',
        onboardingCompleted: true,
      };

      const result = validateProfileInput(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized.displayName).toBe('Security Lead');
      expect(result.sanitized.persona).toBe('SOLO_BUILDER');
      expect(result.sanitized.goals).toEqual(['CHECK_APP', 'SETUP_CI_GATE']);
      expect(result.sanitized.builtWith).toEqual(['CURSOR', 'LOVABLE']);
      expect(result.sanitized.stack).toEqual(['NEXTJS']);
      expect(result.sanitized.onboardingCompleted).toBe(true);
    });

    it('rejects unknown or injected fields', () => {
      const input = {
        persona: 'STUDENT',
        isAdmin: true,
        role: 'SUPER_ADMIN',
        injectScript: '<script>alert(1)</script>',
      };

      const result = validateProfileInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('isAdmin'))).toBe(true);
      expect(result.errors.some((e) => e.includes('role'))).toBe(true);
      expect(result.errors.some((e) => e.includes('injectScript'))).toBe(true);
    });

    it('rejects non-whitelisted persona', () => {
      const input = {
        persona: 'UNAUTHORIZED_SUPER_PERSONA',
      };

      const result = validateProfileInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid persona'))).toBe(true);
    });

    it('rejects invalid goals and build tools', () => {
      const input = {
        goals: ['CHECK_APP', 'INVALID_GOAL_XYZ'],
        builtWith: ['CURSOR', 'UNAPPROVED_TOOL'],
        stack: ['UNKNOWN_STACK'],
      };

      const result = validateProfileInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid goal'))).toBe(true);
      expect(result.errors.some((e) => e.includes('Invalid tool'))).toBe(true);
      expect(result.errors.some((e) => e.includes('Invalid stack'))).toBe(true);
    });

    it('enforces string length constraints on display name and team size', () => {
      const input = {
        displayName: 'A'.repeat(101),
        teamSize: 'B'.repeat(51),
      };

      const result = validateProfileInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('displayName cannot exceed 100'))).toBe(true);
      expect(result.errors.some((e) => e.includes('teamSize cannot exceed 50'))).toBe(true);
    });

    it('safely handles skipping onboarding', () => {
      const input = {
        onboardingSkipped: true,
      };

      const result = validateProfileInput(input);
      expect(result.valid).toBe(true);
      expect(result.sanitized.onboardingSkipped).toBe(true);
    });
  });

  describe('Persona Defaults & Dashboard Adaptations', () => {
    it('maps STUDENT persona correctly', () => {
      const defaults = adaptPersonaDefaults('STUDENT');
      expect(defaults.expandedGroups).toContain('Protect');
      expect(defaults.expandedGroups).toContain('Learn');
      expect(defaults.collapsedGroups).toContain('Organization');
      expect(defaults.nextBestActionTone).toBe('learning-first');
      expect(defaults.surfacedAcademyTrack).toBe('ai-code-smells');
    });

    it('maps SOLO_BUILDER persona correctly', () => {
      const defaults = adaptPersonaDefaults('SOLO_BUILDER');
      expect(defaults.expandedGroups).toContain('Protect');
      expect(defaults.expandedGroups).toContain('Automate');
      expect(defaults.expandedGroups).toContain('Learn');
      expect(defaults.nextBestActionTone).toBe('action-first');
      expect(defaults.surfacedAcademyTrack).toBe('ai-code-smells');
    });

    it('maps FREELANCER_AGENCY persona correctly', () => {
      const defaults = adaptPersonaDefaults('FREELANCER_AGENCY');
      expect(defaults.promotedItems).toContain('agency');
      expect(defaults.nextBestActionTone).toBe('client-focused');
      expect(defaults.surfacedAcademyTrack).toBe('api-modern-web');
    });

    it('maps STARTUP_FOUNDER persona correctly', () => {
      const defaults = adaptPersonaDefaults('STARTUP_FOUNDER');
      expect(defaults.expandedGroups).toContain('Protect');
      expect(defaults.expandedGroups).toContain('Automate');
      expect(defaults.expandedGroups).toContain('Organization');
      expect(defaults.surfacedAcademyTrack).toBe('api-modern-web');
    });

    it('maps COMPANY_TEAM persona correctly', () => {
      const defaults = adaptPersonaDefaults('COMPANY_TEAM');
      expect(defaults.promotedItems).toContain('audit-vault');
      expect(defaults.promotedItems).toContain('team');
      expect(defaults.surfacedAcademyTrack).toBe('identity-rbac-tenancy');
    });

    it('falls back to default configuration when persona is null or unknown', () => {
      const defaults = adaptPersonaDefaults(null);
      expect(defaults.defaultFrameworkTab).toBe('nextjs');
      expect(defaults.surfacedAcademyTrack).toBe('ai-code-smells');
      expect(defaults.nextBestActionTone).toBe('action-first');
    });

    it('maps tech stack to default remediation framework tab', () => {
      expect(adaptPersonaDefaults(null, ['EXPRESS']).defaultFrameworkTab).toBe('express');
      expect(adaptPersonaDefaults(null, ['NGINX']).defaultFrameworkTab).toBe('nginx');
      expect(adaptPersonaDefaults(null, ['NEXTJS']).defaultFrameworkTab).toBe('nextjs');
      expect(adaptPersonaDefaults(null, ['OTHER']).defaultFrameworkTab).toBe('nextjs');
      expect(adaptPersonaDefaults(null, []).defaultFrameworkTab).toBe('nextjs');
    });
  });
});
