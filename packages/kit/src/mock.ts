import type { ApiError } from './types.js';

/**
 * Scaffolding for kit functions whose backend endpoint doesn't exist yet.
 * Every function that uses this is tagged with the restheart tracking issue
 * it depends on (github.com/SoftInstigate/restheart#648) — replace the body
 * with a real `apiFetch` call once that issue's sub-issue lands, no signature
 * changes expected.
 */
export function mockDelay(ms = 350): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function mockError(status: number, message: string): ApiError {
  return { status, message };
}
