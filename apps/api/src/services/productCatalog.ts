import { prisma } from '@codeforces/db';

export type ProductKind = 'course' | 'credit' | 'bundle';

export type ProductCatalogItem = {
  productId: string;
  title: string;
  description: string;
  amountPaise: number;
  currency: string;
  kind: ProductKind;
  /** For bundles: course product IDs unlocked on purchase */
  grantsProductIds?: string[];
};

/** Paid catalog / credits / bundles. Amounts are in paise (₹1 = 100). */
export const PRODUCT_CATALOG: Record<string, ProductCatalogItem> = {
  '1': {
    productId: '1',
    title: 'Salaam DSA',
    description: 'Full access to Salaam DSA course',
    amountPaise: 49900,
    currency: 'INR',
    kind: 'course',
  },
  '2': {
    productId: '2',
    title: 'Salaam Node.js',
    description: 'Full access to Salaam Node.js course',
    amountPaise: 49900,
    currency: 'INR',
    kind: 'course',
  },
  '3': {
    productId: '3',
    title: 'Salaam React',
    description: 'Full access to Salaam React course',
    amountPaise: 49900,
    currency: 'INR',
    kind: 'course',
  },
  '5': {
    productId: '5',
    title: 'System Design',
    description: 'Full access to System Design course',
    amountPaise: 69900,
    currency: 'INR',
    kind: 'course',
  },
  'ai-generate': {
    productId: 'ai-generate',
    title: 'AI Course Credit',
    description: 'Unlock AI course generation (1 credit)',
    amountPaise: 19900,
    currency: 'INR',
    kind: 'credit',
  },
  'bundle-fullstack': {
    productId: 'bundle-fullstack',
    title: 'Full-Stack Career Bundle',
    description: 'DSA + Node.js + React — best value path to ship full-stack apps',
    amountPaise: 99900,
    currency: 'INR',
    kind: 'bundle',
    grantsProductIds: ['1', '2', '3'],
  },
  'bundle-interview': {
    productId: 'bundle-interview',
    title: 'Interview Prep Bundle',
    description: 'DSA + System Design — structured prep for coding + HLD rounds',
    amountPaise: 99900,
    currency: 'INR',
    kind: 'bundle',
    grantsProductIds: ['1', '5'],
  },
  'bundle-frontend': {
    productId: 'bundle-frontend',
    title: 'Frontend Pro Bundle',
    description: 'React + System Design — UI engineering with architecture depth',
    amountPaise: 89900,
    currency: 'INR',
    kind: 'bundle',
    grantsProductIds: ['3', '5'],
  },
};

export function getProduct(productId: string): ProductCatalogItem | null {
  return PRODUCT_CATALOG[productId] ?? null;
}

export function listProducts(): ProductCatalogItem[] {
  return Object.values(PRODUCT_CATALOG);
}

export function listBundles(): ProductCatalogItem[] {
  return Object.values(PRODUCT_CATALOG).filter((p) => p.kind === 'bundle');
}

/** Product IDs that should be enrolled after a successful payment. */
export function enrollmentIdsForProduct(product: ProductCatalogItem): string[] {
  if (product.kind === 'bundle' && product.grantsProductIds?.length) {
    return Array.from(new Set([product.productId, ...product.grantsProductIds]));
  }
  return [product.productId];
}

/** Catalog course IDs that require a paid enrollment (not free tracks 4/6). */
export function isPremiumCourseProduct(courseId: string): boolean {
  return getProduct(courseId)?.kind === 'course';
}

export async function userHasEnrollment(userId: string, productId: string): Promise<boolean> {
  const row = await prisma.enrollment.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  return Boolean(row);
}

export async function userOwnsAllGrants(
  userId: string,
  productIds: string[],
): Promise<boolean> {
  if (productIds.length === 0) return false;
  const rows = await prisma.enrollment.findMany({
    where: { userId, productId: { in: productIds } },
    select: { productId: true },
  });
  const owned = new Set(rows.map((r) => r.productId));
  return productIds.every((id) => owned.has(id));
}

export async function listUserEnrollments(userId: string) {
  return prisma.enrollment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listUserPayments(userId: string) {
  return prisma.paymentOrder.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}
