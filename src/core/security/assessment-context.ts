import { AsyncLocalStorage } from 'node:async_hooks';

export interface AssessmentScope {
  targetUrl: string;
  pathOnly?: boolean;
  signal?: AbortSignal;
}

interface AssessmentState extends AssessmentScope {
  successfulRequests: number;
  failures: number;
}

export class AssessmentIncompleteError extends Error {
  constructor(readonly partialFindings: unknown[]) {
    super('Assessment incomplete: a request failed or no endpoint was successfully assessed');
  }
}

const assessments = new AsyncLocalStorage<AssessmentState>();

/** A scan may inspect only its registered origin and, for URL_PATH, its subtree. */
export function assertAssessmentUrl(rawUrl: string, scope: AssessmentScope | undefined = assessments.getStore()): void {
  if (!scope) return;
  scope.signal?.throwIfAborted();
  const target = new URL(scope.targetUrl);
  const candidate = new URL(rawUrl);
  if (candidate.origin !== target.origin) {
    throw new Error('Assessment request left the authorized origin');
  }
  if (scope.pathOnly) {
    const base = decodeURIComponent(target.pathname).replace(/\/+$/, '') || '/';
    const path = decodeURIComponent(candidate.pathname);
    if (path.includes('\\') || path.split('/').includes('..') || /%[0-9a-f]{2}/i.test(path)) {
      throw new Error('Ambiguous encoded assessment path');
    }
    if (base !== '/' && path !== base && !path.startsWith(`${base}/`)) {
      throw new Error('Assessment request left the authorized URL path');
    }
  }
}

export function assessmentSignal(): AbortSignal | undefined {
  return assessments.getStore()?.signal;
}

export function recordAssessmentRequest(success: boolean): void {
  const state = assessments.getStore();
  if (!state) return;
  if (success) state.successfulRequests++;
  else state.failures++;
}

/** Empty results after swallowed network errors or circuit-breaker exits are inconclusive. */
export async function runAssessment<T extends unknown[]>(
  scope: AssessmentScope,
  run: () => Promise<T>,
): Promise<T> {
  const state: AssessmentState = { ...scope, successfulRequests: 0, failures: 0 };
  return assessments.run(state, async () => {
    const result = await run();
    scope.signal?.throwIfAborted();
    if (state.failures > 0 || (state.successfulRequests === 0 && result.length === 0)) {
      throw new AssessmentIncompleteError(result);
    }
    return result;
  });
}

export async function withinAssessmentScope<T>(scope: AssessmentScope, run: () => Promise<T>): Promise<T> {
  return assessments.run({ ...scope, successfulRequests: 0, failures: 0 }, run);
}
