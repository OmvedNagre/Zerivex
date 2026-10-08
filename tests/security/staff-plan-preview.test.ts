import { describe, it, expect } from 'vitest';
import { can, StaffRole } from '@/core/staff/staff-permissions';
import { previewFlagsFor, isPreviewFlagActive, PREVIEW_FLAGS } from '@/core/staff/preview-flags';

describe('Phase D: Staff Perks & Plan Preview Controls (§D)', () => {
  describe('1. Plan Preview Role Boundaries (§D-1)', () => {
    it('STAFF_OWNER and STAFF_ADMIN can preview any plan tier', () => {
      const ownerSession = { role: 'STAFF_OWNER' as StaffRole };
      const adminSession = { role: 'STAFF_ADMIN' as StaffRole };

      expect(can(ownerSession, 'PLAN_PREVIEW_ANY')).toBe(true);
      expect(can(ownerSession, 'PLAN_PREVIEW_PRO')).toBe(true);

      expect(can(adminSession, 'PLAN_PREVIEW_ANY')).toBe(true);
      expect(can(adminSession, 'PLAN_PREVIEW_PRO')).toBe(true);
    });

    it('STAFF_SUPPORT is restricted to previewing up to Pro and cannot preview Enterprise', () => {
      const supportSession = { role: 'STAFF_SUPPORT' as StaffRole };

      expect(can(supportSession, 'PLAN_PREVIEW_PRO')).toBe(true);
      expect(can(supportSession, 'PLAN_PREVIEW_ANY')).toBe(false);
    });
  });

  describe('2. Internal Preview-Flag Scaffold (§D-2)', () => {
    it('ships with an empty flag list and builds no fake features', () => {
      expect(Object.keys(PREVIEW_FLAGS)).toHaveLength(0);
    });

    it('returns empty preview flags if user is not staff', () => {
      const customerSession = { isStaff: false, isInternalOrg: false };
      expect(previewFlagsFor(customerSession)).toEqual({});
    });

    it('returns empty preview flags if staff session is not operating on the internal org', () => {
      const externalSession = { isStaff: true, isInternalOrg: false };
      expect(previewFlagsFor(externalSession)).toEqual({});
    });

    it('denies inactive preview flags safely', () => {
      const internalStaffSession = { isStaff: true, isInternalOrg: true };
      expect(isPreviewFlagActive('non_existent_flag', internalStaffSession)).toBe(false);
      expect(isPreviewFlagActive('non_existent_flag', null)).toBe(false);
    });
  });
});
