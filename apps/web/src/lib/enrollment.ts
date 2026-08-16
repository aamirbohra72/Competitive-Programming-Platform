/**
 * Local enrollment cache keyed by product/course id.
 * Source of truth is API `/payments/enrollments`; localStorage unlocks course UI immediately.
 */

const enrolledKey = (productId: string) => `enrolled:course:${productId}`;

/** Course product IDs that map 1:1 to /learn/:id routes. */
export const COURSE_PRODUCT_IDS = new Set(['1', '2', '3', '5']);

export function isLocallyEnrolled(productId: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(enrolledKey(productId)) === '1';
}

export function markLocalEnrollment(productId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(enrolledKey(productId), '1');
  window.dispatchEvent(
    new CustomEvent('enrollment:updated', { detail: { productId } }),
  );
}

export function markLocalEnrollments(productIds: string[]): void {
  if (typeof window === 'undefined') return;
  for (const id of productIds) {
    localStorage.setItem(enrolledKey(id), '1');
  }
  window.dispatchEvent(
    new CustomEvent('enrollment:updated', { detail: { productIds } }),
  );
}

export function clearLocalEnrollment(productId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(enrolledKey(productId));
}

export function learnPathForProduct(productId: string): string | null {
  if (!COURSE_PRODUCT_IDS.has(productId)) return null;
  return `/learn/${productId}`;
}
