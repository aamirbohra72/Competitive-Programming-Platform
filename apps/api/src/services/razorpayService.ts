import { randomUUID } from 'node:crypto';
import Razorpay from 'razorpay';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@codeforces/db';
import { AppError } from '../lib/errors';
import { withRetry } from '../lib/retry';
import {
  enrollmentIdsForProduct,
  getProduct,
  userHasEnrollment,
  userOwnsAllGrants,
} from './productCatalog';

export type FulfillPaymentResult = {
  ok: true;
  alreadyPaid: boolean;
  productId: string;
  productIds: string[];
};

function getRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID?.trim();
  const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!key_id || !key_secret) {
    throw new AppError('RAZORPAY_KEYS_MISSING', 503, 'Razorpay is not configured');
  }
  return new Razorpay({ key_id, key_secret });
}

function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): void {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) {
    throw new AppError('RAZORPAY_KEYS_MISSING', 503, 'Razorpay is not configured');
  }
  const payload = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (!timingSafeEqualString(expected, signature)) {
    throw new AppError('INVALID_SIGNATURE', 400, 'Payment signature verification failed');
  }
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): void {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new AppError(
      'RAZORPAY_WEBHOOK_SECRET_MISSING',
      503,
      'Razorpay webhook is not configured',
    );
  }
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (!timingSafeEqualString(expected, signature)) {
    throw new AppError('INVALID_SIGNATURE', 400, 'Payment signature verification failed');
  }
}

async function enrollUser(userId: string, orderId: string, enrollIds: string[]): Promise<void> {
  await prisma.$transaction(
    enrollIds.map((id) =>
      prisma.enrollment.upsert({
        where: { userId_productId: { userId, productId: id } },
        create: { userId, productId: id, orderId },
        update: {},
      }),
    ),
  );
}

function enrollIdsForOrder(productId: string): string[] {
  const product = getProduct(productId);
  return product ? enrollmentIdsForProduct(product) : [productId];
}

export async function fulfillPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature?: string | null;
  expectedUserId?: string;
}): Promise<FulfillPaymentResult> {
  const payment = await prisma.paymentOrder.findUnique({
    where: { razorpayOrderId: input.razorpayOrderId },
  });
  if (!payment || (input.expectedUserId && payment.userId !== input.expectedUserId)) {
    throw new AppError('ORDER_NOT_FOUND', 404, 'Payment order not found');
  }

  const enrollIds = enrollIdsForOrder(payment.productId);

  if (payment.status === 'PAID') {
    await enrollUser(payment.userId, payment.id, enrollIds);
    return {
      ok: true,
      alreadyPaid: true,
      productId: payment.productId,
      productIds: enrollIds,
    };
  }

  try {
    const claimed = await prisma.paymentOrder.updateMany({
      where: {
        id: payment.id,
        status: { in: ['CREATED', 'FAILED'] },
      },
      data: {
        status: 'PAID',
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.signature ?? payment.razorpaySignature,
      },
    });

    if (claimed.count === 0) {
      const latest = await prisma.paymentOrder.findUnique({ where: { id: payment.id } });
      if (latest?.status === 'PAID') {
        await enrollUser(payment.userId, payment.id, enrollIds);
        return {
          ok: true,
          alreadyPaid: true,
          productId: payment.productId,
          productIds: enrollIds,
        };
      }
      throw new AppError('ORDER_NOT_FULFILLABLE', 409, 'Payment could not be fulfilled');
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      await enrollUser(payment.userId, payment.id, enrollIds);
      return {
        ok: true,
        alreadyPaid: true,
        productId: payment.productId,
        productIds: enrollIds,
      };
    }
    throw err;
  }

  await enrollUser(payment.userId, payment.id, enrollIds);
  return {
    ok: true,
    alreadyPaid: false,
    productId: payment.productId,
    productIds: enrollIds,
  };
}

export async function markPaymentFailed(razorpayOrderId: string, razorpayPaymentId?: string) {
  await prisma.paymentOrder.updateMany({
    where: { razorpayOrderId, status: 'CREATED' },
    data: {
      status: 'FAILED',
      ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
    },
  });
}

export async function recordWebhookEvent(eventId: string, event: string): Promise<boolean> {
  try {
    const inserted = await prisma.$executeRaw`
      INSERT INTO "RazorpayWebhookEvent" ("id", "eventId", "event", "createdAt")
      VALUES (${randomUUID()}, ${eventId}, ${event}, NOW())
      ON CONFLICT ("eventId") DO NOTHING
    `;
    return Number(inserted) > 0;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return false;
    }
    throw err;
  }
}

export async function createPaymentOrder(userId: string, productId: string) {
  const product = getProduct(productId);
  if (!product) {
    throw new AppError('PRODUCT_NOT_FOUND', 404, 'Product not found');
  }

  if (await userHasEnrollment(userId, productId)) {
    throw new AppError('ALREADY_ENROLLED', 409, 'Already enrolled in this product');
  }

  if (product.kind === 'bundle' && product.grantsProductIds?.length) {
    if (await userOwnsAllGrants(userId, product.grantsProductIds)) {
      throw new AppError('ALREADY_ENROLLED', 409, 'Already enrolled in this product');
    }
  }

  const razorpay = getRazorpay();
  const receipt = `rcpt_${Date.now().toString(36)}`;
  const order = await withRetry(() =>
    razorpay.orders.create({
      amount: product.amountPaise,
      currency: product.currency,
      receipt,
      notes: {
        productId: product.productId,
        userId,
        kind: product.kind,
      },
    }),
  );

  const payment = await prisma.paymentOrder.create({
    data: {
      userId,
      productId: product.productId,
      productTitle: product.title,
      amountPaise: product.amountPaise,
      currency: product.currency,
      status: 'CREATED',
      razorpayOrderId: order.id,
      updatedAt: new Date(),
    },
  });

  return {
    orderId: order.id,
    amount: product.amountPaise,
    currency: product.currency,
    productId: product.productId,
    productTitle: product.title,
    keyId: process.env.RAZORPAY_KEY_ID!,
    paymentDbId: payment.id,
    grantsProductIds: product.grantsProductIds ?? [],
  };
}

export async function verifyPayment(input: {
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<FulfillPaymentResult> {
  verifyCheckoutSignature(
    input.razorpayOrderId,
    input.razorpayPaymentId,
    input.razorpaySignature,
  );
  return fulfillPayment({
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
    expectedUserId: input.userId,
  });
}

type RazorpayWebhookBody = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
      };
    };
  };
  created_at?: number;
};

export async function handleRazorpayWebhook(
  rawBody: Buffer,
  signature: string,
  eventHeader?: string,
): Promise<{ ok: true; duplicate?: boolean; ignored?: boolean }> {
  verifyWebhookSignature(rawBody, signature);

  let parsed: RazorpayWebhookBody;
  try {
    parsed = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookBody;
  } catch {
    throw new AppError('INVALID_SIGNATURE', 400, 'Invalid webhook payload');
  }

  const event = parsed.event || 'unknown';
  const entity = parsed.payload?.payment?.entity;
  const paymentId = entity?.id;
  const orderId = entity?.order_id;
  const eventId =
    eventHeader?.trim() ||
    (paymentId ? `${event}:${paymentId}:${parsed.created_at ?? ''}` : `${event}:${rawBody.length}`);

  // Fulfill first (idempotent). Recording the event after means a failed
  // attempt is retried by Razorpay instead of being skipped as a duplicate.
  if (event === 'payment.captured' || event === 'order.paid') {
    if (!orderId || !paymentId) {
      await recordWebhookEvent(eventId, event);
      return { ok: true, ignored: true };
    }
    await fulfillPayment({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
    });
    const inserted = await recordWebhookEvent(eventId, event);
    return { ok: true, duplicate: !inserted };
  }

  if (event === 'payment.failed') {
    if (orderId) {
      await markPaymentFailed(orderId, paymentId);
    }
    const inserted = await recordWebhookEvent(eventId, event);
    return { ok: true, duplicate: !inserted };
  }

  await recordWebhookEvent(eventId, event);
  return { ok: true, ignored: true };
}
