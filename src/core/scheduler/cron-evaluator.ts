/**
 * Deterministic Cron Evaluator & Next-Run-Time Calculator
 * Supports standard 5-part cron expressions: (minute hour day-of-month month day-of-week)
 */

export type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM';

export const CRON_PRESETS: Record<Exclude<ScheduleFrequency, 'CUSTOM'>, string> = {
  DAILY: '0 2 * * *',       // 02:00 UTC daily
  WEEKLY: '0 3 * * 1',      // 03:00 UTC every Monday
  BIWEEKLY: '0 3 1,15 * *', // 03:00 UTC on the 1st and 15th
  MONTHLY: '0 4 1 * *',     // 04:00 UTC on 1st of month
};

/**
 * Normalizes frequency preset to standard cron expression.
 */
export function normalizeFrequencyToCron(frequency: ScheduleFrequency, customCron?: string): string {
  if (frequency === 'CUSTOM') {
    if (!customCron || !isValidCron(customCron)) {
      throw new Error(`Invalid custom cron expression: "${customCron}"`);
    }
    return customCron.trim();
  }

  const preset = CRON_PRESETS[frequency];
  if (!preset) {
    throw new Error(`Unsupported schedule frequency: "${frequency}"`);
  }
  return preset;
}

/**
 * Validates a standard 5-field cron expression.
 */
export function isValidCron(cron: string): boolean {
  if (!cron || typeof cron !== 'string') return false;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [min, hour, dom, mon, dow] = parts;
  return (
    isValidField(min!, 0, 59) &&
    isValidField(hour!, 0, 23) &&
    isValidField(dom!, 1, 31) &&
    isValidField(mon!, 1, 12) &&
    isValidField(dow!, 0, 7)
  );
}

function isValidField(field: string, min: number, max: number): boolean {
  if (field === '*') return true;

  // Step: */N or 1-5/2
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    return !isNaN(step) && step > 0 && step <= max;
  }

  // Lists: 1,2,3
  const items = field.split(',');
  for (const item of items) {
    // Range: 1-5 or 1-5/2
    if (item.includes('-')) {
      const [rangePart, stepPart] = item.split('/');
      const [startStr, endStr] = rangePart!.split('-');
      const start = parseInt(startStr!, 10);
      const end = parseInt(endStr!, 10);
      if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
        return false;
      }
      if (stepPart !== undefined) {
        const step = parseInt(stepPart, 10);
        if (isNaN(step) || step <= 0) return false;
      }
    } else {
      const val = parseInt(item, 10);
      if (isNaN(val) || val < min || val > max) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Evaluates whether a given value matches a cron field specification.
 */
function matchesField(val: number, field: string): boolean {
  if (field === '*') return true;

  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    return val % step === 0;
  }

  const items = field.split(',');
  for (const item of items) {
    if (item.includes('-')) {
      const [rangePart, stepPart] = item.split('/');
      const [startStr, endStr] = rangePart!.split('-');
      const start = parseInt(startStr!, 10);
      const end = parseInt(endStr!, 10);
      const step = stepPart ? parseInt(stepPart, 10) : 1;

      if (val >= start && val <= end && (val - start) % step === 0) {
        return true;
      }
    } else {
      if (parseInt(item, 10) === val) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Computes the next occurrence of a cron expression starting strictly after `fromDate`.
 * Works deterministically in UTC.
 */
export function getNextRunDate(cronExpr: string, fromDate?: Date): Date {
  if (!isValidCron(cronExpr)) {
    throw new Error(`Invalid cron expression: "${cronExpr}"`);
  }

  const [minField, hourField, domField, monField, dowField] = cronExpr.trim().split(/\s+/) as [string, string, string, string, string];

  // Start at least 1 minute after fromDate (or now)
  const current = new Date(fromDate ? fromDate.getTime() : Date.now());
  current.setUTCSeconds(0, 0);
  current.setUTCMinutes(current.getUTCMinutes() + 1);

  // Maximum search horizon: 5 years (approx 5 * 366 days = 1830 days = 2,635,200 minutes)
  const maxIterations = 60 * 24 * 366 * 5;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    const month = current.getUTCMonth() + 1; // 1-12
    if (!matchesField(month, monField)) {
      // Advance to start of next month
      current.setUTCMonth(current.getUTCMonth() + 1, 1);
      current.setUTCHours(0, 0, 0, 0);
      continue;
    }

    const dom = current.getUTCDate(); // 1-31
    const dow = current.getUTCDay();   // 0-6 (0 is Sunday)
    // In cron standard: if both dom and dow are restricted (not *), matching either or both depends on standard.
    // Standard vixie cron matches if either matches when both are non-wildcards. If one is *, matches the other.
    const domMatch = matchesField(dom, domField);
    const dowMatch = matchesField(dow, dowField) || (dow === 0 && matchesField(7, dowField));

    let dayMatches = false;
    if (domField === '*' && dowField === '*') {
      dayMatches = true;
    } else if (domField === '*') {
      dayMatches = dowMatch;
    } else if (dowField === '*') {
      dayMatches = domMatch;
    } else {
      // Both specified: either matches
      dayMatches = domMatch || dowMatch;
    }

    if (!dayMatches) {
      // Advance to next day 00:00 UTC
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(0, 0, 0, 0);
      continue;
    }

    const hour = current.getUTCHours(); // 0-23
    if (!matchesField(hour, hourField)) {
      // Advance to next hour :00
      current.setUTCHours(current.getUTCHours() + 1, 0, 0, 0);
      continue;
    }

    const min = current.getUTCMinutes(); // 0-59
    if (!matchesField(min, minField)) {
      current.setUTCMinutes(current.getUTCMinutes() + 1);
      continue;
    }

    // Found match
    return current;
  }

  throw new Error(`Unable to compute next run date for cron "${cronExpr}" within 5-year search horizon`);
}
